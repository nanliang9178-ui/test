/*!
 * 天枢点单 · 顾客端点单（H5）静态 Mock 接口
 * 对应真实后端 apps/api 的 /api/h5/* 与 /api/client/* 路由
 */
(function () {
  'use strict';

  var M = window.TSMock;
  if (!M) {
    console.error('[mock-h5] 缺少 mock-core.js');
    return;
  }

  function findOrder(db, id) {
    var order = db.orders.filter(function (o) { return o.id === id; })[0] || null;
    if (!order) throw M.error('订单不存在', 404);
    return order;
  }

  M.install(function (ctx) {
    var db = ctx.db;
    var path = ctx.path;
    var method = ctx.method;

    /* ---------- 登录 ---------- */
    if (path === '/h5/login' && method === 'POST') {
      var scene = (ctx.body && ctx.body.scene) || ctx.query.get('scene') || '';
      var table = M.pickTable(db, scene);
      if (!table) throw M.error('桌码无效，请重新扫码');
      return {
        token: 'mock-h5-' + ((ctx.body && ctx.body.clientId) || 'browser'),
        tenant: { id: db.tenant.id, code: db.tenant.code, name: db.tenant.name },
        table: table,
      };
    }

    /* ---------- 门店信息 ---------- */
    if (path === '/client/bootstrap' && method === 'GET') {
      var scene2 = ctx.query.get('scene') || '';
      var table2 = M.pickTable(db, scene2);
      if (!table2) throw M.error('桌码无效，请重新扫码');
      return {
        tenant: { id: db.tenant.id, code: db.tenant.code, name: db.tenant.name },
        brand: db.brand,
        store: db.store,
        table: table2,
        wechat: { appId: '', mock: true },
      };
    }

    /* ---------- 菜单 ---------- */
    if (path === '/client/menu' && method === 'GET') {
      return db.categories
        .filter(function (c) { return c.status === 'ACTIVE'; })
        .sort(function (a, b) { return a.sort - b.sort; })
        .map(function (category) {
          return {
            id: category.id,
            name: category.name,
            icon: category.icon,
            promoLabel: category.promoLabel,
            promoTitle: category.promoTitle,
            products: db.products
              .filter(function (p) { return p.categoryId === category.id && p.status === 'ON_SALE'; })
              .sort(function (a, b) { return a.sort - b.sort; })
              .map(M.h5Product),
          };
        });
    }

    /* ---------- 订单列表 ---------- */
    if (path === '/client/orders' && method === 'GET') {
      var pageSize = Number(ctx.query.get('pageSize') || 50);
      var page = Number(ctx.query.get('page') || 1);
      var list = db.orders
        .slice()
        .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })
        .slice((page - 1) * pageSize, page * pageSize)
        .map(M.h5Order);
      return { list: list, total: db.orders.length };
    }

    /* ---------- 下单 ---------- */
    if (path === '/client/orders' && method === 'POST') {
      var payload = ctx.body || {};
      var table3 = payload.tableId
        ? db.tables.filter(function (t) { return t.id === payload.tableId; })[0]
        : M.pickTable(db, 'demo');
      var order = M.createOrder(payload, table3 || null, payload.clientId || null);
      return M.h5Order(order);
    }

    /* ---------- 支付 / 取消 / 催单 ---------- */
    var actionMatch = path.match(/^\/client\/orders\/([^/]+)\/(pay|cancel|remind)$/);
    if (actionMatch) {
      var id = decodeURIComponent(actionMatch[1]);
      var action = actionMatch[2];
      var target = findOrder(db, id);

      if (action === 'pay' && method === 'POST') {
        target.payStatus = 'PAID';
        target.paidAmount = target.totalAmount;
        target.paidAt = new Date().toISOString();
        target.payChannel = 'MOCK';
        if (target.status === 'UNPAID') target.status = 'PENDING';
        M.save();
        return { mock: true, order: M.h5Order(target) };
      }

      if (action === 'cancel' && method === 'POST') {
        target.status = 'CANCELLED';
        target.cancelReason = (ctx.body && ctx.body.reason) || '顾客取消';
        if (target.payStatus === 'PAID') target.payStatus = 'REFUNDED';
        M.save();
        return M.h5Order(target);
      }

      if (action === 'remind' && method === 'POST') {
        return { success: true, message: '已提醒商家，请稍候' };
      }
    }

    /* ---------- 订单详情 ---------- */
    var detailMatch = path.match(/^\/client\/orders\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      return M.h5Order(findOrder(db, decodeURIComponent(detailMatch[1])));
    }

    throw M.error('演示接口不存在：' + method + ' ' + path, 404);
  });
})();
