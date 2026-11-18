/*!
 * 天枢点单 · 商户后台（Admin）静态 Mock 接口
 * 对应真实后端 apps/api 的 /api/auth/*、/api/admin/*、/api/platform/*
 */
(function () {
  'use strict';

  var M = window.TSMock;
  if (!M) {
    console.error('[mock-admin] 缺少 mock-core.js');
    return;
  }

  function dayKey(date) {
    var d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function startOfDay(offsetDays) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (offsetDays || 0));
    return d;
  }

  function monthDay(date) {
    var d = new Date(date);
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function findTenant(db, id) {
    return db.platformTenants.filter(function (t) { return t.id === id; })[0] || null;
  }

  function tenantRow(db, t) {
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      contactName: t.contactName,
      contactPhone: t.contactPhone,
      status: t.status,
      plan: t.plan,
      expireAt: t.expireAt,
      createdAt: t.createdAt,
      storeName: t.storeName,
      openStatus: t.openStatus,
      orderCount: t.orderCount,
      staffCount: t.staffCount,
      gmv: t.gmv,
    };
  }

  function findOrder(db, id) {
    var order = db.orders.filter(function (o) { return o.id === id; })[0] || null;
    if (!order) throw M.error('订单不存在', 404);
    return order;
  }

  function findProduct(db, id) {
    var product = db.products.filter(function (p) { return p.id === id; })[0] || null;
    if (!product) throw M.error('菜品不存在', 404);
    return product;
  }

  function normalizeSpecGroups(productId, groups) {
    return (groups || []).map(function (group, gi) {
      var gid = productId + '-g' + (gi + 1) + '-' + M.uid('s');
      return {
        id: gid,
        name: group.name,
        required: group.required !== false,
        multiple: !!group.multiple,
        sort: gi,
        options: (group.options || []).map(function (option, oi) {
          return {
            id: gid + '-o' + (oi + 1),
            name: option.name,
            priceDelta: Number(option.priceDelta) || 0,
            sort: oi,
            defaultSelected: !!option.defaultSelected,
          };
        }),
      };
    });
  }

  function sessionStaff(ctx) {
    var auth = '';
    if (ctx.headers && typeof ctx.headers === 'object') {
      auth = ctx.headers.Authorization || ctx.headers.authorization || '';
    }
    var token = String(auth).replace(/^Bearer\s+/i, '');
    if (token.indexOf('mock-staff-') !== 0) return null;
    var username = token.slice('mock-staff-'.length);
    var db = ctx.db;
    return db.staff.filter(function (s) { return s.username === username; })[0] || null;
  }

  function sessionPlatform(ctx) {
    var auth = '';
    if (ctx.headers && typeof ctx.headers === 'object') {
      auth = ctx.headers.Authorization || ctx.headers.authorization || '';
    }
    var token = String(auth).replace(/^Bearer\s+/i, '');
    return token === 'mock-platform' ? ctx.db.platformUsers[0] : null;
  }

  function meOfStaff(db, staff) {
    return {
      type: 'staff',
      name: staff.name,
      username: staff.username,
      role: staff.role,
      tenant: { id: db.tenant.id, code: db.tenant.code, name: db.tenant.name, status: db.tenant.status, plan: db.tenant.plan, expireAt: db.tenant.expireAt },
      brand: db.brand,
      store: db.store,
    };
  }

  function meOfPlatform(db) {
    return { type: 'platform', name: db.platformUsers[0].name, username: db.platformUsers[0].username, role: db.platformUsers[0].role };
  }

  function overviewOf(db) {
    var now = new Date();
    var todayStart = startOfDay(0);
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var daily = [];
    for (var i = 6; i >= 0; i -= 1) {
      var day = startOfDay(-i);
      var next = startOfDay(-i + 1);
      var amount = 0;
      var count = 0;
      db.orders.forEach(function (o) {
        var created = new Date(o.createdAt);
        if (created >= day && created < next && o.payStatus === 'PAID' && o.status !== 'CANCELLED') {
          amount += o.totalAmount;
          count += 1;
        }
      });
      daily.push({ date: monthDay(day), amount: amount, count: count });
    }
    var hours = [];
    for (var h = 0; h < 24; h += 1) hours.push({ hour: h, amount: 0, count: 0 });
    var categories = {};
    db.orders.forEach(function (o) {
      var created = new Date(o.createdAt);
      if (created < monthStart || o.payStatus !== 'PAID' || o.status === 'CANCELLED') return;
      hours[created.getHours()].amount += o.totalAmount;
      hours[created.getHours()].count += 1;
      (o.items || []).forEach(function (item) {
        var product = db.products.filter(function (p) { return p.id === item.productId; })[0];
        var category = product ? db.categories.filter(function (c) { return c.id === product.categoryId; })[0] : null;
        var key = category ? category.name : '其他';
        if (!categories[key]) categories[key] = { name: key, amount: 0, quantity: 0 };
        categories[key].amount += item.amount;
        categories[key].quantity += item.quantity;
      });
    });
    var summary = { amount: 0, count: 0, avgPrice: 0, itemCount: 0 };
    db.orders.forEach(function (o) {
      var created = new Date(o.createdAt);
      if (created < monthStart || o.payStatus !== 'PAID' || o.status === 'CANCELLED') return;
      summary.amount += o.totalAmount;
      summary.count += 1;
      (o.items || []).forEach(function (item) { summary.itemCount += item.quantity; });
    });
    summary.avgPrice = summary.count ? Math.round(summary.amount / summary.count) : 0;
    return {
      range: { from: monthDay(monthStart), to: monthDay(now) },
      summary: summary,
      daily: daily,
      hours: hours,
      categories: Object.keys(categories).map(function (k) { return categories[k]; }),
      _todayStart: todayStart.getTime(),
    };
  }

  function dashboardOf(db) {
    var todayStart = startOfDay(0);
    var yesterdayStart = startOfDay(-1);
    var today = { amount: 0, count: 0, avgPrice: 0, pendingCount: 0, refundCount: 0, compareRate: null };
    var yesterdayAmount = 0;
    var topMap = {};
    var trend = [];

    db.orders.forEach(function (o) {
      var created = new Date(o.createdAt);
      var isPaid = o.payStatus === 'PAID';
      if (created >= todayStart) {
        if (isPaid && o.status !== 'CANCELLED') {
          today.amount += o.totalAmount;
          today.count += 1;
          (o.items || []).forEach(function (item) {
            if (!topMap[item.productName]) topMap[item.productName] = { name: item.productName, quantity: 0, amount: 0 };
            topMap[item.productName].quantity += item.quantity;
            topMap[item.productName].amount += item.amount;
          });
        }
        if (o.status === 'PENDING') today.pendingCount += 1;
        if (o.payStatus === 'REFUNDED') today.refundCount += 1;
      } else if (created >= yesterdayStart && created < todayStart && isPaid && o.status !== 'CANCELLED') {
        yesterdayAmount += o.totalAmount;
      }
    });
    today.avgPrice = today.count ? Math.round(today.amount / today.count) : 0;
    today.compareRate = yesterdayAmount > 0 ? Math.round(((today.amount - yesterdayAmount) / yesterdayAmount) * 1000) / 10 : null;

    for (var i = 6; i >= 0; i -= 1) {
      var day = startOfDay(-i);
      var next = startOfDay(-i + 1);
      var amount = 0;
      var count = 0;
      db.orders.forEach(function (o) {
        var created = new Date(o.createdAt);
        if (created >= day && created < next && o.payStatus === 'PAID' && o.status !== 'CANCELLED') {
          amount += o.totalAmount;
          count += 1;
        }
      });
      trend.push({ date: monthDay(day), amount: amount, count: count });
    }

    var topProducts = Object.keys(topMap)
      .map(function (k) { return topMap[k]; })
      .sort(function (a, b) { return b.quantity - a.quantity; })
      .slice(0, 5);

    return { today: today, yesterdayAmount: yesterdayAmount, trend: trend, topProducts: topProducts };
  }

  function countsOf(db) {
    var counts = { ALL: 0, UNPAID: 0, PENDING: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 };
    db.orders.forEach(function (o) {
      counts.ALL += 1;
      if (counts[o.status] === undefined) counts[o.status] = 0;
      counts[o.status] += 1;
      if (o.payStatus === 'UNPAID' && o.status !== 'CANCELLED') counts.UNPAID += 1;
    });
    return counts;
  }

  function listOrders(db, query) {
    var status = query.get('status') || 'ALL';
    var keyword = (query.get('keyword') || '').trim();
    var dateFrom = query.get('dateFrom');
    var pageSize = Number(query.get('pageSize') || 20);
    var page = Number(query.get('page') || 1);

    var filtered = db.orders.filter(function (o) {
      if (status !== 'ALL') {
        if (status === 'UNPAID') {
          if (o.payStatus !== 'UNPAID' || o.status === 'CANCELLED') return false;
        } else if (o.status !== status) return false;
      }
      if (keyword && String(o.orderNo).indexOf(keyword) < 0 && String(o.tableName || '').indexOf(keyword) < 0) return false;
      if (dateFrom) {
        var created = new Date(o.createdAt);
        if (created < new Date(dateFrom + 'T00:00:00')) return false;
      }
      return true;
    });
    filtered.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var list = filtered.slice((page - 1) * pageSize, page * pageSize).map(function (o) { return M.adminOrder(o, db); });
    return { list: list, counts: countsOf(db), total: filtered.length };
  }

  M.install(function (ctx) {
    var db = ctx.db;
    var path = ctx.path;
    var method = ctx.method;
    var body = ctx.body || {};

    /* ================= 登录与身份 ================= */
    if (path === '/auth/login' && method === 'POST') {
      var staff = db.staff.filter(function (s) { return s.username === String(body.username || '').trim(); })[0];
      if (!staff || staff.password !== body.password) throw M.error('账号或密码错误', 400);
      if (body.tenantCode && String(body.tenantCode).trim() && String(body.tenantCode).trim() !== db.tenant.code) {
        throw M.error('商户编码不存在', 400);
      }
      staff.lastLoginAt = new Date().toISOString();
      M.save();
      return { token: 'mock-staff-' + staff.username, user: { id: staff.id, name: staff.name, role: staff.role } };
    }

    if (path === '/auth/platform/login' && method === 'POST') {
      var platformUser = db.platformUsers.filter(function (u) { return u.username === String(body.username || '').trim(); })[0];
      if (!platformUser || platformUser.password !== body.password) throw M.error('账号或密码错误', 400);
      return { token: 'mock-platform', user: { id: platformUser.id, name: platformUser.name, role: platformUser.role } };
    }

    if (path === '/auth/me' && method === 'GET') {
      var platform = sessionPlatform(ctx);
      if (platform) return meOfPlatform(db);
      var staffSession = sessionStaff(ctx);
      if (staffSession) return meOfStaff(db, staffSession);
      throw M.error('登录状态已失效，请重新登录', 401);
    }

    /* ================= 上传 ================= */
    if (path === '/admin/upload' && method === 'POST') {
      var file = ctx.form && ctx.form.get('file');
      return M.readFileAsDataUrl(file).then(function (dataUrl) {
        if (!dataUrl) throw M.error('未收到文件');
        return { url: dataUrl, absoluteUrl: dataUrl };
      });
    }

    /* ================= 看板与统计 ================= */
    if (path === '/admin/stats/dashboard' && method === 'GET') {
      return dashboardOf(db);
    }
    if (path === '/admin/stats/overview' && method === 'GET') {
      var ov = overviewOf(db);
      delete ov._todayStart;
      return ov;
    }

    /* ================= 订单 ================= */
    if (path === '/admin/orders' && method === 'GET') {
      return listOrders(db, ctx.query);
    }

    var orderAction = path.match(/^\/admin\/orders\/([^/]+)\/(accept|ready|complete|cancel|reject|refund)$/);
    if (orderAction && method === 'POST') {
      var order = findOrder(db, decodeURIComponent(orderAction[1]));
      var action = orderAction[2];
      if (action === 'accept') {
        order.status = 'PREPARING';
        order.acceptAt = new Date().toISOString();
      } else if (action === 'ready') {
        order.status = 'READY';
        order.readyAt = new Date().toISOString();
      } else if (action === 'complete') {
        order.status = 'COMPLETED';
        order.completeAt = new Date().toISOString();
      } else if (action === 'cancel' || action === 'reject') {
        order.status = 'CANCELLED';
        order.cancelReason = body.reason || '商家取消';
        if (order.payStatus === 'PAID') order.payStatus = 'REFUNDED';
      } else if (action === 'refund') {
        order.payStatus = 'REFUNDED';
      }
      M.save();
      return M.adminOrder(order, db);
    }

    var orderDetail = path.match(/^\/admin\/orders\/([^/]+)$/);
    if (orderDetail && method === 'GET') {
      return M.adminOrder(findOrder(db, decodeURIComponent(orderDetail[1])), db);
    }

    /* ================= 菜单分类 ================= */
    if (path === '/admin/menu/categories' && method === 'GET') {
      return db.categories
        .slice()
        .sort(function (a, b) { return a.sort - b.sort; })
        .map(function (category) {
          var count = db.products.filter(function (p) { return p.categoryId === category.id; }).length;
          return {
            id: category.id,
            name: category.name,
            icon: category.icon,
            promoLabel: category.promoLabel,
            promoTitle: category.promoTitle,
            sort: category.sort,
            status: category.status,
            _count: { products: count },
          };
        });
    }

    if (path === '/admin/menu/categories' && method === 'POST') {
      var newCategory = {
        id: M.uid('cat-'),
        name: body.name || '未命名分类',
        icon: body.icon || null,
        promoLabel: body.promoLabel || null,
        promoTitle: body.promoTitle || null,
        sort: db.categories.length,
        status: 'ACTIVE',
      };
      db.categories.push(newCategory);
      M.save();
      return newCategory;
    }

    var categoryItem = path.match(/^\/admin\/menu\/categories\/([^/]+)$/);
    if (categoryItem) {
      var catId = decodeURIComponent(categoryItem[1]);
      var category = db.categories.filter(function (c) { return c.id === catId; })[0];
      if (!category) throw M.error('分类不存在', 404);
      if (method === 'PUT') {
        category.name = body.name || category.name;
        category.icon = body.icon !== undefined ? body.icon : category.icon;
        category.promoLabel = body.promoLabel !== undefined ? body.promoLabel : category.promoLabel;
        category.promoTitle = body.promoTitle !== undefined ? body.promoTitle : category.promoTitle;
        M.save();
        return category;
      }
      if (method === 'DELETE') {
        db.categories = db.categories.filter(function (c) { return c.id !== catId; });
        db.products = db.products.filter(function (p) { return p.categoryId !== catId; });
        M.save();
        return { success: true };
      }
    }

    /* ================= 菜品 ================= */
    if (path === '/admin/menu/products' && method === 'GET') {
      return db.products
        .slice()
        .sort(function (a, b) { return a.sort - b.sort; })
        .map(function (p) { return M.adminProduct(p, db); });
    }

    if (path === '/admin/menu/products' && method === 'POST') {
      var productId = M.uid('p-');
      var created = {
        id: productId,
        categoryId: body.categoryId,
        name: body.name || '未命名菜品',
        description: body.description || null,
        imageUrl: body.imageUrl || M.svgPic('🍽️', '#FFE8DA', '#FFF8F1'),
        price: Number(body.price) || 0,
        originalPrice: body.originalPrice ? Number(body.originalPrice) : null,
        unit: body.unit || '份',
        tags: body.tags || '',
        monthlySales: 0,
        stockEnabled: !!body.stockEnabled,
        stock: Number(body.stock) || 0,
        soldOut: !!body.soldOut,
        status: body.status || 'ON_SALE',
        sort: db.products.length,
        specGroups: normalizeSpecGroups(productId, body.specGroups),
      };
      db.products.push(created);
      M.save();
      return M.adminProduct(created, db);
    }

    var productAvailability = path.match(/^\/admin\/menu\/products\/([^/]+)\/availability$/);
    if (productAvailability && method === 'PATCH') {
      var availProduct = findProduct(db, decodeURIComponent(productAvailability[1]));
      if (body.soldOut !== undefined) availProduct.soldOut = !!body.soldOut;
      if (body.status !== undefined) availProduct.status = body.status;
      M.save();
      return M.adminProduct(availProduct, db);
    }

    var productDuplicate = path.match(/^\/admin\/menu\/products\/([^/]+)\/duplicate$/);
    if (productDuplicate && method === 'POST') {
      var source = findProduct(db, decodeURIComponent(productDuplicate[1]));
      var copyId = M.uid('p-');
      var copy = JSON.parse(JSON.stringify(source));
      copy.id = copyId;
      copy.name = source.name + '（复制）';
      copy.sort = db.products.length;
      copy.specGroups = normalizeSpecGroups(copyId, copy.specGroups);
      db.products.push(copy);
      M.save();
      return M.adminProduct(copy, db);
    }

    var productItem = path.match(/^\/admin\/menu\/products\/([^/]+)$/);
    if (productItem) {
      var targetProduct = findProduct(db, decodeURIComponent(productItem[1]));
      if (method === 'PUT') {
        targetProduct.categoryId = body.categoryId || targetProduct.categoryId;
        targetProduct.name = body.name || targetProduct.name;
        targetProduct.description = body.description !== undefined ? body.description : targetProduct.description;
        targetProduct.imageUrl = body.imageUrl !== undefined ? body.imageUrl : targetProduct.imageUrl;
        targetProduct.price = body.price !== undefined ? Number(body.price) : targetProduct.price;
        targetProduct.originalPrice = body.originalPrice !== undefined ? (body.originalPrice ? Number(body.originalPrice) : null) : targetProduct.originalPrice;
        targetProduct.unit = body.unit || targetProduct.unit;
        targetProduct.tags = body.tags !== undefined ? body.tags : targetProduct.tags;
        targetProduct.stockEnabled = body.stockEnabled !== undefined ? !!body.stockEnabled : targetProduct.stockEnabled;
        targetProduct.stock = body.stock !== undefined ? Number(body.stock) : targetProduct.stock;
        targetProduct.soldOut = body.soldOut !== undefined ? !!body.soldOut : targetProduct.soldOut;
        targetProduct.status = body.status || targetProduct.status;
        if (body.specGroups) targetProduct.specGroups = normalizeSpecGroups(targetProduct.id, body.specGroups);
        M.save();
        return M.adminProduct(targetProduct, db);
      }
      if (method === 'DELETE') {
        db.products = db.products.filter(function (p) { return p.id !== targetProduct.id; });
        M.save();
        return { success: true };
      }
    }

    /* ================= 桌码 ================= */
    if (path === '/admin/tables' && method === 'GET') {
      var areas = [];
      db.tables.forEach(function (t) { if (areas.indexOf(t.area) < 0) areas.push(t.area); });
      return { list: db.tables, areas: areas, total: db.tables.length, publicBaseUrl: window.location.origin + '/test/t/' };
    }

    if (path === '/admin/tables/batch' && method === 'POST') {
      var count = Math.min(50, Math.max(1, Number(body.count) || 1));
      var prefix = body.prefix || 'A';
      var area = body.area || '大厅';
      var seats = Number(body.seats) || 4;
      var startIndex = db.tables.filter(function (t) { return t.area === area; }).length;
      for (var i = 1; i <= count; i += 1) {
        var name = prefix + String(startIndex + i).padStart(2, '0');
        db.tables.push({
          id: 'tb-' + M.uid(''),
          name: name,
          area: area,
          seats: seats,
          sceneCode: 'scene' + name.toLowerCase() + M.uid(''),
          qrCodeUrl: null,
          qrContent: window.location.origin + '/test/t/scene' + name.toLowerCase(),
        });
      }
      M.save();
      return { success: true, count: count };
    }

    var tableItem = path.match(/^\/admin\/tables\/([^/]+)$/);
    if (tableItem) {
      var tableId = decodeURIComponent(tableItem[1]);
      var table = db.tables.filter(function (t) { return t.id === tableId; })[0];
      if (!table) throw M.error('桌位不存在', 404);
      if (method === 'PUT') {
        table.name = body.name || table.name;
        table.area = body.area || table.area;
        table.seats = body.seats !== undefined ? Number(body.seats) : table.seats;
        M.save();
        return table;
      }
      if (method === 'DELETE') {
        db.tables = db.tables.filter(function (t) { return t.id !== tableId; });
        M.save();
        return { success: true };
      }
    }

    /* ================= 店铺与品牌 ================= */
    if (path === '/admin/store') {
      if (method === 'GET') return db.store;
      if (method === 'PUT') {
        Object.keys(body).forEach(function (key) {
          if (body[key] !== undefined && key in db.store) db.store[key] = body[key];
        });
        if (body.openStatus !== undefined) db.store.openStatus = !!body.openStatus;
        M.save();
        return db.store;
      }
    }

    if (path === '/admin/store/brand' && method === 'PUT') {
      Object.keys(body).forEach(function (key) { if (body[key] !== undefined) db.brand[key] = body[key]; });
      M.save();
      return db.brand;
    }

    /* ================= 支付与小程序配置 ================= */
    if (path === '/admin/pay/config') {
      if (method === 'GET') return db.payConfig;
      if (method === 'PUT') {
        var config = db.payConfig;
        ['appId', 'mchId', 'serialNo'].forEach(function (key) {
          if (body[key] !== undefined) config[key] = body[key];
        });
        if (body.appSecret) config.appSecretMasked = String(body.appSecret).slice(0, 2) + '****' + String(body.appSecret).slice(-4);
        if (body.apiV3Key) config.apiV3KeyMasked = '****' + String(body.apiV3Key).slice(-4);
        if (body.privateKey) {
          config.privateKeyMasked = '-----BEGIN PRIVATE KEY----- ****';
          config.hasPrivateKey = true;
        }
        if (body.enabled !== undefined) config.enabled = !!body.enabled;
        config.ready = !!(config.appId && config.mchId && config.hasPrivateKey);
        config.verifiedAt = config.verifiedAt || null;
        config.statusMsg = config.ready ? '配置已保存，可点击「测试连接」验证商户号连通性' : '配置不完整，请补全 AppID / 商户号 / API 私钥';
        M.save();
        return config;
      }
    }

    if (path === '/admin/pay/config/test' && method === 'POST') {
      var payReady = db.payConfig.appId && db.payConfig.mchId && db.payConfig.hasPrivateKey;
      if (!payReady) throw M.error('支付配置不完整，无法测试连接');
      db.payConfig.verifiedAt = new Date().toISOString();
      db.payConfig.statusMsg = '证书解析成功（演示环境模拟）';
      M.save();
      return { success: true, certCount: 1, message: '连接成功（演示环境模拟，未发起真实请求）' };
    }

    if (path === '/admin/pay/miniprogram') {
      if (method === 'GET') return db.miniprogram;
      if (method === 'PUT') {
        ['appId', 'envVersion', 'homePage'].forEach(function (key) {
          if (body[key] !== undefined) db.miniprogram[key] = body[key];
        });
        if (body.appSecret) {
          db.miniprogram.appSecretMasked = String(body.appSecret).slice(0, 2) + '****' + String(body.appSecret).slice(-4);
          db.miniprogram.hasAppSecret = true;
        }
        db.miniprogram.configured = !!(db.miniprogram.appId && db.miniprogram.hasAppSecret);
        M.save();
        return db.miniprogram;
      }
    }

    /* ================= 员工 ================= */
    if (path === '/admin/staff') {
      if (method === 'GET') {
        return db.staff.map(function (s) {
          return { id: s.id, username: s.username, name: s.name, role: s.role, status: s.status, lastLoginAt: s.lastLoginAt, createdAt: s.createdAt };
        });
      }
      if (method === 'POST') {
        if (db.staff.some(function (s) { return s.username === body.username; })) throw M.error('账号已存在');
        var createdStaff = {
          id: M.uid('st-'),
          username: body.username,
          name: body.name,
          role: body.role || 'STAFF',
          password: body.password || '123456',
          status: 'ACTIVE',
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
        };
        db.staff.push(createdStaff);
        M.save();
        return { id: createdStaff.id, username: createdStaff.username, name: createdStaff.name, role: createdStaff.role, status: createdStaff.status, createdAt: createdStaff.createdAt, lastLoginAt: null };
      }
    }

    var staffPassword = path.match(/^\/admin\/staff\/([^/]+)\/password$/);
    if (staffPassword && method === 'POST') {
      var pwdStaff = db.staff.filter(function (s) { return s.id === decodeURIComponent(staffPassword[1]); })[0];
      if (!pwdStaff) throw M.error('员工不存在', 404);
      pwdStaff.password = body.password || pwdStaff.password;
      M.save();
      return { success: true };
    }

    var staffItem = path.match(/^\/admin\/staff\/([^/]+)$/);
    if (staffItem) {
      var staffId = decodeURIComponent(staffItem[1]);
      var staffTarget = db.staff.filter(function (s) { return s.id === staffId; })[0];
      if (!staffTarget) throw M.error('员工不存在', 404);
      if (method === 'PUT') {
        staffTarget.name = body.name || staffTarget.name;
        staffTarget.role = body.role || staffTarget.role;
        if (body.status !== undefined) staffTarget.status = body.status;
        M.save();
        return { id: staffTarget.id, username: staffTarget.username, name: staffTarget.name, role: staffTarget.role, status: staffTarget.status, createdAt: staffTarget.createdAt, lastLoginAt: staffTarget.lastLoginAt };
      }
      if (method === 'DELETE') {
        if (staffTarget.username === 'demo') throw M.error('演示老板账号不可删除');
        db.staff = db.staff.filter(function (s) { return s.id !== staffId; });
        M.save();
        return { success: true };
      }
    }

    /* ================= 平台端 ================= */
    if (path === '/platform/overview' && method === 'GET') {
      var activeCount = db.platformTenants.filter(function (t) { return t.status === 'ACTIVE'; }).length;
      var expiring = db.platformTenants.filter(function (t) {
        if (!t.expireAt) return false;
        var diff = new Date(t.expireAt).getTime() - Date.now();
        return diff > 0 && diff < 30 * 864e5;
      }).length;
      return {
        tenants: { total: db.platformTenants.length, active: activeCount, expiring: expiring },
        today: { gmv: db.orders.reduce(function (sum, o) { return sum + (o.payStatus === 'PAID' ? o.totalAmount : 0); }, 0), orders: db.orders.length },
        recentTenants: db.platformTenants.slice(0, 5).map(function (t) {
          return { id: t.id, code: t.code, name: t.name, status: t.status, storeName: t.storeName, orders: t.orderCount, createdAt: t.createdAt, expireAt: t.expireAt };
        }),
      };
    }

    if (path === '/platform/tenants' && method === 'GET') {
      var kw = (ctx.query.get('keyword') || '').trim();
      var tstatus = ctx.query.get('status') || 'ALL';
      var rows = db.platformTenants.filter(function (t) {
        if (tstatus !== 'ALL' && t.status !== tstatus) return false;
        if (kw && t.name.indexOf(kw) < 0 && t.code.indexOf(kw) < 0) return false;
        return true;
      });
      return { list: rows.map(function (t) { return tenantRow(db, t); }), total: rows.length };
    }

    if (path === '/platform/tenants' && method === 'POST') {
      var code = String(body.name || 'tenant').slice(0, 2) + M.uid('');
      var createdTenant = {
        id: M.uid('t-'),
        code: body.ownerUsername ? body.ownerUsername : code,
        name: body.name,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        status: 'ACTIVE',
        plan: body.plan || 'BASIC',
        expireAt: body.expireAt ? new Date(body.expireAt).toISOString() : new Date(Date.now() + 365 * 864e5).toISOString(),
        createdAt: new Date().toISOString(),
        storeName: body.storeName || body.name,
        openStatus: false,
        orderCount: 0,
        staffCount: 1,
        gmv: 0,
      };
      db.platformTenants.push(createdTenant);
      M.save();
      return { loginCode: createdTenant.code, ownerUsername: createdTenant.code };
    }

    var tenantItem = path.match(/^\/platform\/tenants\/([^/]+)$/);
    if (tenantItem) {
      var tenantId = decodeURIComponent(tenantItem[1]);
      var tenant = findTenant(db, tenantId);
      if (!tenant) throw M.error('商户不存在', 404);
      if (method === 'GET') {
        var detail = tenantRow(db, tenant);
        detail.brand = { primaryColor: db.brand.primaryColor, logoUrl: db.brand.logoUrl, slogan: db.brand.slogan };
        detail.store = { name: tenant.storeName, address: db.store.address, businessHours: db.store.businessHours, openStatus: tenant.openStatus };
        detail.staff = db.staff.map(function (s) { return { id: s.id, username: s.username, name: s.name, role: s.role, status: s.status }; });
        detail.stats = { gmv: tenant.gmv, todayOrders: dashboardOf(db).today.count, orderCount: tenant.orderCount };
        detail.paymentConfig = tenant.id === db.tenant.id ? { appId: db.payConfig.appId, mchId: db.payConfig.mchId, enabled: db.payConfig.enabled, verifiedAt: db.payConfig.verifiedAt } : null;
        return detail;
      }
      if (method === 'PUT') {
        if (body.status !== undefined) tenant.status = body.status;
        if (body.plan !== undefined) tenant.plan = body.plan;
        if (body.expireAt !== undefined) tenant.expireAt = body.expireAt;
        M.save();
        return tenantRow(db, tenant);
      }
    }

    var ownerPassword = path.match(/^\/platform\/tenants\/([^/]+)\/owner-password$/);
    if (ownerPassword && method === 'POST') {
      var owner = db.staff.filter(function (s) { return s.role === 'OWNER'; })[0];
      if (owner) owner.password = body.password || owner.password;
      M.save();
      return { success: true };
    }

    throw M.error('演示接口不存在：' + method + ' ' + path, 404);
  });
})();
