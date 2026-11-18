/*
 * 天枢点单 · 跨设备实时同步（演示版）
 * ---------------------------------------------------------------
 * 静态站点没有后端，订单原本只存在各自浏览器的 localStorage 里，
 * 手机下单后商户后台看不到。这里用公开的 MQTT 服务器做一层「共享数据 + 广播」：
 *
 *   1. 订单（而不是整份配置）以 retained 消息保存在 MQTT 主题上：跨设备共享、断线重连还在；
 *   2. 每次改动先发一条小体积事件（order:new / order:updated，几 KB，秒级到达），
 *      再发一份完整订单快照（供新设备/断线设备补齐）；
 *   3. 商户后台把 MQTT 消息模拟成 socket.io 事件，于是「实时在线」、新单提示音、
 *      订单列表自动刷新都真的工作；顾客端也会同步到「已接单/制作中」等状态。
 *
 * 连不上服务器时自动退回家里的本机模式（轮询），页面功能不受影响。
 */
(function () {
  'use strict';
  if (window.TSLiveSync) return;

  var CFG = {
    broker: 'wss://broker.emqx.io:8084/mqtt',
    namespace: 'dsh-tianshu-order-demo/v3/',
    dbKey: 'ts_demo_db_v1',
    versionKey: 'ts_demo_db_v1__v3',
    republishDelayMs: 1500,
  };
  var TOPIC_STATE = CFG.namespace + 'state';
  var TOPIC_EVENT = CFG.namespace + 'event';

  var client = null;
  var connected = false;
  var hasRemote = false;
  var status = 'idle';
  var log = [];
  var listeners = {};
  var lastDb = null;

  function remember(line) {
    log.push(new Date().toISOString().slice(11, 23) + ' ' + line);
    if (log.length > 120) log.shift();
  }

  function readLocal() {
    try {
      var raw = window.localStorage.getItem(CFG.dbKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeLocal(db) {
    try {
      window.localStorage.setItem(CFG.dbKey, JSON.stringify(db));
    } catch (e) {
      /* ignore */
    }
  }

  function readVersion() {
    try {
      var v = parseInt(window.localStorage.getItem(CFG.versionKey) || '0', 10);
      return isNaN(v) ? 0 : v;
    } catch (e) {
      return 0;
    }
  }

  function writeVersion(v) {
    try {
      window.localStorage.setItem(CFG.versionKey, String(v));
    } catch (e) {
      /* ignore */
    }
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function emit(evt, payload) {
    var list = listeners[evt] || [];
    for (var i = 0; i < list.length; i += 1) {
      try {
        list[i](payload);
      } catch (e) {
        remember('handler error ' + evt + ': ' + e.message);
      }
    }
  }

  function reloadMock() {
    try {
      if (window.TSMock && typeof window.TSMock.reload === 'function') {
        window.TSMock.reload();
      }
    } catch (e) {
      /* ignore */
    }
  }

  function ordersOf(db) {
    return (db && db.orders) || [];
  }

  function orderMap(orders) {
    var map = {};
    (orders || []).forEach(function (o) {
      if (o && o.id) map[o.id] = o;
    });
    return map;
  }

  function nextVersion() {
    return Math.max(Date.now(), readVersion() + 1);
  }

  /** 订单「新鲜度」：取最近一次状态变化的时间戳（降序比较） */
  function stampOf(o) {
    if (!o) return 0;
    var raw = o.cancelAt || o.completeAt || o.readyAt || o.acceptAt || o.paidAt || o.updatedAt || o.createdAt || '';
    var t = Date.parse(raw);
    return isNaN(t) ? 0 : t;
  }

  function sameOrder(a, b) {
    if (!a || !b) return false;
    return a.status === b.status && a.payStatus === b.payStatus && stampOf(a) === stampOf(b);
  }

  /** 订单按 id 合并：同一单取「更新更晚」的一方，其余取并集，结果按时间倒序 */
  function mergeOrders(localOrders, remoteOrders) {
    var map = orderMap(remoteOrders);
    (localOrders || []).forEach(function (o) {
      if (!o || !o.id) return;
      var current = map[o.id];
      if (!current || stampOf(o) > stampOf(current)) map[o.id] = o;
    });
    var list = Object.keys(map).map(function (k) {
      return map[k];
    });
    list.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return list;
  }

  function diffOrders(prev, next) {
    var prevMap = orderMap(ordersOf(prev));
    var events = [];
    ordersOf(next).forEach(function (o) {
      var before = prevMap[o.id];
      if (!before) events.push(['order:new', o]);
      else if (before.status !== o.status || before.payStatus !== o.payStatus) events.push(['order:updated', o]);
    });
    return events;
  }

  var republishTimer = null;

  function scheduleRepublish() {
    if (republishTimer) return;
    republishTimer = window.setTimeout(function () {
      republishTimer = null;
      publish(readLocal() || {}, 'merge');
    }, CFG.republishDelayMs);
  }

  /** 把一批订单合并进本机数据库，并广播变化 */
  function applyOrders(remoteOrders, version, source) {
    var local = readLocal() || {};
    var before = clone(local);
    local.orders = mergeOrders(local.orders, remoteOrders);
    writeLocal(local);
    if (version && version > readVersion()) writeVersion(version);
    reloadMock();
    var mergedIds = orderMap(local.orders);
    var remoteIds = orderMap(remoteOrders);
    var localOnly = Object.keys(mergedIds).filter(function (id) {
      return !remoteIds[id];
    });
    var freshLocal = localOnly.filter(function (id) {
      var created = Date.parse((mergedIds[id] && mergedIds[id].createdAt) || '');
      return !isNaN(created) && Date.now() - created < 120000; // 只回传 2 分钟内新建的本地订单，避免历史种子数据来回刷
    });
    if (freshLocal.length && source !== 'local') {
      // 本机有远端还没有的新订单（例如两处同时下单）→ 回传合并后的完整状态，保证大家最终一致
      remember('merge keeps ' + freshLocal.length + ' fresh local order(s) → republish');
      scheduleRepublish();
    }
    var events = diffOrders(before, local);
    lastDb = clone({ orders: local.orders });
    if (events.length) {
      remember('adopt ' + source + ' v=' + version + ' orders=' + local.orders.length + ' events=' + events.length);
      events.forEach(function (item) {
        emit(item[0], item[1]);
      });
      emit('db:update', { version: readVersion(), source: source });
      try {
        window.dispatchEvent(new CustomEvent('ts-live-sync', { detail: { version: readVersion(), source: source } }));
      } catch (e) {
        /* ignore */
      }
    }
    return events;
  }

  function publish(db, why) {
    if (!connected || !client) return;
    var version = nextVersion();
    writeVersion(version);
    var orders = ordersOf(db || readLocal());
    var prev = lastDb || clone({ orders: orders });
    var events = diffOrders(prev, { orders: orders });
    var slim = JSON.stringify({ __v: version, orders: orders });

    events.forEach(function (item) {
      var payload = JSON.stringify({ __v: version, type: item[0], order: item[1] });
      client.publish(TOPIC_EVENT, payload, { qos: 0, retain: false });
    });
    client.publish(TOPIC_STATE, slim, { qos: 0, retain: true }, function (err) {
      if (err) remember('publish error: ' + err.message);
      else remember('publish v=' + version + ' (' + (why || 'update') + ') events=' + events.length + ' ' + slim.length + 'B');
    });
    lastDb = clone({ orders: orders });
  }

  function handleEvent(text) {
    var evt;
    try {
      evt = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (!evt || !evt.order || !evt.order.id) return;
    var local = readLocal() || {};
    var current = orderMap(local.orders)[evt.order.id];
    if (current && sameOrder(current, evt.order)) return; // 自己发的回声或重复
    if (current && stampOf(current) > stampOf(evt.order)) return; // 本机状态更新，忽略旧事件
    remember('event ' + evt.type + ' v=' + evt.__v + ' ' + (evt.order.orderNo || evt.order.id));
    var pending = (local.orders || []).filter(function (o) {
      return o.id !== evt.order.id;
    });
    pending.push(evt.order);
    applyOrders(pending, evt.__v, 'event');
  }

  function handleState(text) {
    var state;
    try {
      state = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (!state || !state.orders) return;
    var remoteVersion = state.__v || 0;
    var localVersion = readVersion();
    remember('state v=' + remoteVersion + ' ' + text.length + 'B (local v=' + localVersion + ')');
    hasRemote = true;
    applyOrders(state.orders, Math.max(remoteVersion, localVersion), 'state');
  }

  function setStatus(next) {
    status = next;
    remember('status=' + next);
  }

  function connect() {
    if (!window.mqtt || typeof window.mqtt.connect !== 'function') {
      setStatus('unavailable');
      return;
    }
    setStatus('connecting');
    try {
      client = window.mqtt.connect(CFG.broker, {
        clientId: 'ts-web-' + Math.random().toString(36).slice(2, 10),
        keepalive: 30,
        connectTimeout: 10000,
        reconnectPeriod: 3000,
        clean: true,
      });
    } catch (e) {
      setStatus('error');
      return;
    }

    client.on('connect', function () {
      connected = true;
      setStatus('online');
      client.subscribe([TOPIC_STATE, TOPIC_EVENT], { qos: 0 }, function (err) {
        if (err) {
          remember('subscribe failed: ' + err.message);
          return;
        }
        emit('connect');
        // 订阅后先记住「当前已知的订单」，之后本地新增/变更才能算出正确的增量事件
        lastDb = clone({ orders: ordersOf(readLocal() || {}) });
      });
    });

    client.on('message', function (topic, payload) {
      var text = payload && payload.toString ? payload.toString() : '';
      if (topic === TOPIC_STATE) handleState(text);
      else if (topic === TOPIC_EVENT) handleEvent(text);
    });

    client.on('close', function () {
      if (connected) {
        connected = false;
        emit('disconnect');
        setStatus('offline');
      }
    });

    client.on('reconnect', function () {
      setStatus('connecting');
    });

    client.on('error', function (err) {
      remember('mqtt error: ' + (err && err.message));
    });
  }

  /* ---------- 模拟 socket.io（后台 bundle 会调用 window.TSSocketIo） ---------- */
  var shim = null;

  function makeShim() {
    return {
      get connected() {
        return connected;
      },
      get id() {
        return client && client.options ? client.options.clientId : 'ts-mock';
      },
      on: function (evt, fn) {
        listeners[evt] = listeners[evt] || [];
        if (listeners[evt].indexOf(fn) < 0) listeners[evt].push(fn);
        return this;
      },
      once: function (evt, fn) {
        var self = this;
        function wrap(payload) {
          self.off(evt, wrap);
          fn(payload);
        }
        return this.on(evt, wrap);
      },
      off: function (evt, fn) {
        var list = listeners[evt];
        if (!list) return this;
        if (!fn) {
          listeners[evt] = [];
          return this;
        }
        var i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
        return this;
      },
      emit: function (evt) {
        emit(evt, arguments[1]);
        return this;
      },
      connect: function () {
        if (!connected) connect();
        return this;
      },
      disconnect: function () {
        if (client) client.end(true);
        connected = false;
        return this;
      },
      removeAllListeners: function (evt) {
        if (evt) listeners[evt] = [];
        else listeners = {};
        return this;
      },
    };
  }

  window.TSSocketIo = function () {
    if (!shim) shim = makeShim();
    return shim;
  };

  /* ---------- 对外接口 ---------- */
  window.TSOnDbSave = function (db) {
    if (!db) return;
    if (!connected) return;
    publish(db, 'local-save');
  };

  window.TSRealtime = {
    get status() {
      return status;
    },
    get connected() {
      return connected;
    },
    get hasRemote() {
      return hasRemote;
    },
    get version() {
      return readVersion();
    },
    get log() {
      return log.slice();
    },
    reconnect: connect,
  };

  lastDb = readLocal();
  window.setTimeout(connect, 30);
})();
