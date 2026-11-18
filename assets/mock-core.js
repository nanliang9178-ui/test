/*!
 * 天枢点单 · 静态演示版数据核心
 * 纯前端 Mock：拦截 /api/* 请求，使用 localStorage 持久化，无需后端即可完整体验点单流程。
 * 数据种子参考 apps/api/prisma/seed.ts。
 */
(function () {
  'use strict';

  var DB_KEY = 'ts_demo_db_v1';

  /* ---------- 基础工具 ---------- */
  function uid(prefix) {
    return (prefix || 'x') + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  }

  function svgPic(text, from, to) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + from + '"/><stop offset="1" stop-color="' + to + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="240" height="240" fill="url(#g)"/>' +
      '<text x="120" y="152" font-size="104" text-anchor="middle">' + text + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function orderNo(seq) {
    var d = new Date();
    var day = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return day + String(90000000 + seq);
  }

  function minutesAgoText(minutes) {
    return new Date(Date.now() - minutes * 60000).toISOString();
  }

  var STATUS_TEXT = {
    UNPAID: '待支付',
    PENDING: '待接单',
    PREPARING: '制作中',
    READY: '待取餐',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
  };
  var PAY_TEXT = { UNPAID: '未支付', PAID: '已支付', REFUNDING: '退款中', REFUNDED: '已退款', CLOSED: '已关闭' };

  /* ---------- 菜单种子 ---------- */
  var CATEGORY_SEED = [
    { name: '招牌必点', icon: '🔥', promoLabel: '店长推荐', promoTitle: '招牌必点' },
    { name: '经典热菜', icon: '🍲', promoLabel: '下饭神器', promoTitle: '经典热菜' },
    { name: '凉菜小食', icon: '🥗', promoLabel: '开胃小菜', promoTitle: '凉菜小食' },
    { name: '主食', icon: '🍜' },
    { name: '饮品', icon: '🧋', promoLabel: '解辣必备', promoTitle: '手作饮品' },
  ];

  var PRODUCT_SEED = [
    // 招牌必点
    { cat: 0, name: '巷子口酸菜鱼', desc: '现杀黑鱼片，酸爽开胃，2-3 人份', emoji: '🐟', from: '#FFE1CE', to: '#FFF6EE', price: 6800, originalPrice: 7800, sales: 326, tags: '招牌,热销', unit: '份', specGroups: [
      { name: '份量', required: true, multiple: false, options: [
        { name: '小份', priceDelta: 0, defaultSelected: true },
        { name: '大份', priceDelta: 2000 },
      ] },
      { name: '辣度', required: true, multiple: false, options: [
        { name: '微辣', priceDelta: 0 },
        { name: '中辣', priceDelta: 0, defaultSelected: true },
        { name: '特辣', priceDelta: 0 },
      ] },
      { name: '加料', required: false, multiple: false, options: [
        { name: '不加', priceDelta: 0, defaultSelected: true },
        { name: '加豆皮', priceDelta: 500 },
        { name: '加宽粉', priceDelta: 600 },
      ] },
    ] },
    { cat: 0, name: '干锅牛蛙', desc: '鲜活牛蛙现炒，麻辣鲜香', emoji: '🐸', from: '#FFE6D8', to: '#FFF7F1', price: 8800, sales: 218, tags: '招牌', unit: '份', specGroups: [
      { name: '辣度', required: true, multiple: false, options: [
        { name: '微辣', priceDelta: 0 },
        { name: '中辣', priceDelta: 0, defaultSelected: true },
        { name: '变态辣', priceDelta: 0 },
      ] },
    ] },
    { cat: 0, name: '脆皮烧鸡（半只）', desc: '果木炭火现烤，皮脆肉嫩', emoji: '🍗', from: '#FFE7C9', to: '#FFF8EC', price: 5800, sales: 402, tags: '热销', unit: '份', specGroups: [
      { name: '口味', required: true, multiple: false, options: [
        { name: '原味', priceDelta: 0, defaultSelected: true },
        { name: '蒜香', priceDelta: 300 },
        { name: '藤椒', priceDelta: 300 },
      ] },
    ] },
    // 经典热菜
    { cat: 1, name: '麻婆豆腐', desc: '郫县豆瓣 + 汉源花椒，下饭神器', emoji: '🥘', from: '#FFDCC9', to: '#FFF5EB', price: 2600, sales: 512, tags: '招牌', unit: '份', specGroups: [] },
    { cat: 1, name: '手撕包菜', desc: '大火爆炒，锅气十足', emoji: '🥬', from: '#E3F3D8', to: '#F8FBF4', price: 1800, sales: 388, tags: '', unit: '份', specGroups: [] },
    { cat: 1, name: '水煮牛肉', desc: '嫩牛肉片配秘制红汤', emoji: '🥩', from: '#FFD9CF', to: '#FFF3EF', price: 6200, sales: 176, tags: '热销', unit: '份', specGroups: [] },
    { cat: 1, name: '蒜蓉时蔬', desc: '每日新鲜直采，清爽解腻', emoji: '🥦', from: '#E1F0D6', to: '#F7FBF3', price: 1600, sales: 264, tags: '', unit: '份', soldOut: true, specGroups: [] },
    // 凉菜小食
    { cat: 2, name: '口水鸡', desc: '冰镇三黄鸡，红油秘制', emoji: '🍗', from: '#FFE3D0', to: '#FFF7F0', price: 3200, sales: 198, tags: '', unit: '份', specGroups: [] },
    { cat: 2, name: '凉拌木耳', desc: '爽脆开胃，酸辣适口', emoji: '🍄', from: '#EDE3DA', to: '#FAF6F2', price: 1500, sales: 233, tags: '', unit: '份', specGroups: [] },
    { cat: 2, name: '手工锅贴（6 只）', desc: '现包现煎，底部金黄酥脆', emoji: '🥟', from: '#FFEFC9', to: '#FFFBF0', price: 2200, sales: 445, tags: '热销', unit: '份', specGroups: [] },
    // 主食
    { cat: 3, name: '招牌酸汤肥牛面', desc: '现熬骨汤，手工面', emoji: '🍜', from: '#FFEBD2', to: '#FFF9F1', price: 2800, sales: 367, tags: '招牌', unit: '碗', specGroups: [
      { name: '面量', required: true, multiple: false, options: [
        { name: '正常', priceDelta: 0, defaultSelected: true },
        { name: '加面', priceDelta: 400 },
      ] },
      { name: '辣度', required: true, multiple: false, options: [
        { name: '不辣', priceDelta: 0 },
        { name: '微辣', priceDelta: 0, defaultSelected: true },
        { name: '中辣', priceDelta: 0 },
      ] },
    ] },
    { cat: 3, name: '猪油拌饭', desc: '现炼猪油 + 酱油膏，简单却上瘾', emoji: '🍚', from: '#F5EBDD', to: '#FEFBF7', price: 1200, sales: 289, tags: '', unit: '碗', specGroups: [] },
    // 饮品
    { cat: 4, name: '冰镇酸梅汤（壶）', desc: '古法熬制，解辣必备', emoji: '🍹', from: '#F3DFE8', to: '#FDF7FB', price: 1800, sales: 320, tags: '', unit: '壶', specGroups: [] },
    { cat: 4, name: '鲜榨西瓜汁', desc: '当日现榨，不加水不加糖', emoji: '🍉', from: '#FFE0DE', to: '#FFF6F5', price: 1600, sales: 210, tags: '新品', unit: '杯', specGroups: [] },
    { cat: 4, name: '手打柠檬茶', desc: '香水柠檬 + 鸭屎香茶底', emoji: '🍋', from: '#F7F2C9', to: '#FDFCF1', price: 1400, sales: 275, tags: '新品', unit: '杯', specGroups: [] },
  ];

  var TABLE_SEED = [
    { area: '大厅', prefix: 'A', count: 8, seats: 4 },
    { area: '靠窗', prefix: 'C', count: 4, seats: 2 },
    { area: '包间', prefix: 'B', count: 3, seats: 8 },
  ];

  /* ---------- 构造种子数据库 ---------- */
  function buildSeed() {
    var db = {};

    db.tenant = { id: 't-demo', code: 'demo', name: '椒香里·川味小馆', status: 'ACTIVE', plan: 'PRO', expireAt: new Date(Date.now() + 365 * 864e5).toISOString() };
    db.brand = {
      logoUrl: svgPic('🍲', '#FFE2D2', '#FFF4EA'),
      coverUrl: svgPic('🏮', '#FFD9C2', '#FFF1E4'),
      primaryColor: '#FF5A1F',
      accentColor: '#F2B544',
      slogan: '一勺红油，半城烟火',
      announcement: '本店所有菜品现点现做，出餐约 15 分钟，感谢等待～',
      servicePhone: '13800138000',
      copyright: '© 2026 椒香里餐饮 · 由天枢点单提供技术支持',
      banners: [
        { url: svgPic('🌶️', '#FFDCC6', '#FFF0E4'), link: '' },
        { url: svgPic('🥘', '#FFE6CE', '#FFF6EA'), link: '' },
      ],
    };
    db.store = {
      id: 's-demo',
      name: '椒香里·川味小馆（万象城店）',
      address: '成都市锦江区红星路三段 1 号 3F-08',
      phone: '13800138000',
      businessHours: '10:00-22:00',
      openStatus: true,
      autoAccept: false,
      packingFee: 200,
      minOrderAmount: 1500,
      deliveryFee: 300,
      deliveryMinAmount: 2000,
      deliveryRange: '3 公里内配送，满 20 元起送',
      deliveryEta: 35,
      fullReduceThreshold: 8800,
      fullReduceAmount: 1000,
      notice: '堂食扫码点单，出餐口取餐；外卖 3 公里内配送。',
    };

    // 桌位：A01 作为演示桌码 scene=demo
    db.tables = [];
    var ti = 0;
    TABLE_SEED.forEach(function (group) {
      for (var i = 1; i <= group.count; i += 1) {
        var name = group.prefix + String(i).padStart(2, '0');
        db.tables.push({
          id: 'tb-' + name,
          name: name,
          area: group.area,
          seats: group.seats,
          sceneCode: ti === 0 ? 'demo' : 'scene' + name.toLowerCase(),
          qrCodeUrl: '/test/assets/qr/table-' + (ti === 0 ? 'demo' : 'scene' + name.toLowerCase()) + '.png',
          qrContent: 'https://nanliang9178-ui.github.io/test/t/' + (ti === 0 ? 'demo' : 'scene' + name.toLowerCase()),
        });
        ti += 1;
      }
    });

    // 分类与菜品
    db.categories = [];
    db.products = [];
    CATEGORY_SEED.forEach(function (cat, ci) {
      var cid = 'cat-' + (ci + 1);
      db.categories.push({
        id: cid,
        name: cat.name,
        icon: cat.icon || null,
        promoLabel: cat.promoLabel || null,
        promoTitle: cat.promoTitle || null,
        sort: ci,
        status: 'ACTIVE',
      });
    });
    PRODUCT_SEED.forEach(function (p, pi) {
      var pid = 'p-' + String(pi + 1).padStart(2, '0');
      var groups = (p.specGroups || []).map(function (g, gi) {
        return {
          id: pid + '-g' + (gi + 1),
          name: g.name,
          required: g.required !== false,
          multiple: !!g.multiple,
          sort: gi,
          options: g.options.map(function (o, oi) {
            return {
              id: pid + '-g' + (gi + 1) + '-o' + (oi + 1),
              name: o.name,
              priceDelta: o.priceDelta || 0,
              sort: oi,
              defaultSelected: !!o.defaultSelected,
            };
          }),
        };
      });
      db.products.push({
        id: pid,
        categoryId: 'cat-' + (p.cat + 1),
        name: p.name,
        description: p.desc,
        imageUrl: svgPic(p.emoji, p.from, p.to),
        price: p.price,
        originalPrice: p.originalPrice || null,
        unit: p.unit || '份',
        tags: p.tags || '',
        monthlySales: p.sales || 0,
        stockEnabled: false,
        stock: 999,
        soldOut: !!p.soldOut,
        status: 'ON_SALE',
        sort: pi,
        specGroups: groups,
      });
    });

    // 员工 / 平台账号
    db.staff = [
      { id: 'st-1', username: 'demo', name: '王老板', role: 'OWNER', password: 'demo888', status: 'ACTIVE', lastLoginAt: minutesAgoText(30), createdAt: minutesAgoText(60 * 24 * 300) },
      { id: 'st-2', username: 'staff', name: '小李', role: 'STAFF', password: 'staff888', status: 'ACTIVE', lastLoginAt: minutesAgoText(90), createdAt: minutesAgoText(60 * 24 * 120) },
      { id: 'st-3', username: 'manager', name: '张店长', role: 'MANAGER', password: 'manager888', status: 'ACTIVE', lastLoginAt: null, createdAt: minutesAgoText(60 * 24 * 60) },
    ];
    db.platformUsers = [{ id: 'pu-1', username: 'admin', name: '平台运营', role: 'SUPER_ADMIN', password: 'admin888' }];

    db.payConfig = {
      appId: '',
      appSecretMasked: '',
      mchId: '',
      serialNo: '',
      apiV3KeyMasked: '',
      privateKeyMasked: '',
      hasPrivateKey: false,
      enabled: false,
      verifiedAt: null,
      statusMsg: null,
      notifyUrl: 'https://your-domain.com/api/pay/notify',
      mockAllowed: true,
      ready: false,
    };
    db.miniprogram = {
      appId: '',
      appSecretMasked: '',
      hasAppSecret: false,
      envVersion: 'release',
      configured: false,
      homePage: 'pages/shop/index',
    };

    // 平台商户列表（演示数据，仅展示用）
    db.platformTenants = [
      { id: 't-demo', code: 'demo', name: '椒香里·川味小馆', contactName: '王老板', contactPhone: '13800138000', status: 'ACTIVE', plan: 'PRO', expireAt: db.tenant.expireAt, createdAt: minutesAgoText(60 * 24 * 300), storeName: db.store.name, openStatus: true, orderCount: 0, staffCount: 3, gmv: 0 },
      { id: 't-shuxiang', code: 'shuxiang', name: '蜀香源·冒菜', contactName: '李女士', contactPhone: '13900139000', status: 'ACTIVE', plan: 'BASIC', expireAt: new Date(Date.now() + 120 * 864e5).toISOString(), createdAt: minutesAgoText(60 * 24 * 90), storeName: '蜀香源·冒菜（春熙路店）', openStatus: true, orderCount: 268, staffCount: 2, gmv: 1864000 },
      { id: 't-yizhancha', code: 'yizhancha', name: '一盏茶·新中式茶饮', contactName: '陈先生', contactPhone: '13700137000', status: 'ACTIVE', plan: 'FLAGSHIP', expireAt: new Date(Date.now() + 20 * 864e5).toISOString(), createdAt: minutesAgoText(60 * 24 * 45), storeName: '一盏茶（太古里店）', openStatus: false, orderCount: 96, staffCount: 4, gmv: 894000 },
    ];

    // 演示订单
    db.orders = [];
    db.seq = 1;
    db.pickup = 0;
    var statusPlan = [
      { status: 'PENDING', payStatus: 'PAID', minutes: 3, type: 'DELIVERY' },
      { status: 'PENDING', payStatus: 'PAID', minutes: 6, type: 'DINE_IN' },
      { status: 'PREPARING', payStatus: 'PAID', minutes: 12, type: 'DINE_IN' },
      { status: 'PREPARING', payStatus: 'PAID', minutes: 18, type: 'DINE_IN' },
      { status: 'READY', payStatus: 'PAID', minutes: 26, type: 'DINE_IN' },
      { status: 'COMPLETED', payStatus: 'PAID', minutes: 48, type: 'DINE_IN' },
      { status: 'COMPLETED', payStatus: 'PAID', minutes: 76, type: 'DINE_IN' },
      { status: 'COMPLETED', payStatus: 'PAID', minutes: 132, type: 'DINE_IN' },
      { status: 'COMPLETED', payStatus: 'PAID', minutes: 1560, type: 'DINE_IN' },
      { status: 'COMPLETED', payStatus: 'PAID', minutes: 2880, type: 'DINE_IN' },
      { status: 'CANCELLED', payStatus: 'REFUNDED', minutes: 96, type: 'DINE_IN' },
    ];
    var customers = [
      { name: '小满', phone: '13800138001' },
      { name: '阿哲', phone: '13800138002' },
      { name: '橙子', phone: '13800138003' },
      { name: '果冻', phone: '13800138004' },
    ];
    statusPlan.forEach(function (plan, idx) {
      var table = db.tables[idx % db.tables.length];
      var customer = customers[idx % customers.length];
      var p1 = db.products[idx % db.products.length];
      var p2 = db.products[(idx + 3) % db.products.length];
      var qty1 = 1 + (idx % 2);
      var itemAmount = p1.price * qty1 + p2.price;
      var discount = itemAmount >= db.store.fullReduceThreshold ? db.store.fullReduceAmount : 0;
      var isDelivery = plan.type === 'DELIVERY';
      var deliveryFee = isDelivery ? db.store.deliveryFee : 0;
      var packingFee = isDelivery ? db.store.packingFee : 0;
      var total = itemAmount - discount + deliveryFee + packingFee;
      var createdAt = minutesAgoText(plan.minutes);
      db.pickup += 1;
      db.seq += 1;
      db.orders.push({
        id: 'o-seed-' + (idx + 1),
        orderNo: orderNo(db.seq),
        tableId: isDelivery ? null : table.id,
        tableName: isDelivery ? null : table.name,
        type: plan.type,
        status: plan.status,
        payStatus: plan.payStatus,
        customerName: customer.name,
        peopleCount: isDelivery ? null : 2 + (idx % 3),
        remark: idx % 3 === 0 ? '少辣，谢谢' : null,
        receiverName: isDelivery ? '周女士' : null,
        receiverPhone: isDelivery ? '13800138066' : null,
        address: isDelivery ? '锦江区红星路三段 1 号 IFS 写字楼 A 座 1802 室' : null,
        deliveryFee: deliveryFee,
        deliveryEta: isDelivery ? 35 : null,
        itemAmount: itemAmount,
        discountAmount: discount,
        packingFee: packingFee,
        totalAmount: total,
        paidAmount: plan.payStatus === 'PAID' ? total : 0,
        pickupNo: db.pickup,
        payChannel: plan.payStatus === 'PAID' ? 'MOCK' : null,
        createdAt: createdAt,
        paidAt: plan.payStatus === 'PAID' ? createdAt : null,
        cancelReason: plan.status === 'CANCELLED' ? '顾客取消' : null,
        clientId: null,
        items: [
          { id: uid('oi'), productId: p1.id, productName: p1.name, imageUrl: p1.imageUrl, unitPrice: p1.price, quantity: qty1, amount: p1.price * qty1, specText: '份量:小份 / 辣度:中辣', remark: null },
          { id: uid('oi'), productId: p2.id, productName: p2.name, imageUrl: p2.imageUrl, unitPrice: p2.price, quantity: 1, amount: p2.price, specText: null, remark: null },
        ],
      });
    });

    // 近 7 日历史订单：让「近 7 日营业额趋势」有数据，且昨日营业额合理
    // 目标：今日 ¥750、昨日约 ¥690 → 较昨日约 +8.7%（避免出现 999%）
    var historyPlan = [
      { minutes: 1505, picks: [[1, 2], [0, 1]] },
      { minutes: 1540, picks: [[2, 2], [5, 1]] },
      { minutes: 1585, picks: [[3, 2], [4, 2], [6, 1]] },
      { minutes: 1615, picks: [[7, 1], [8, 1], [9, 1], [11, 1], [12, 1]] },
      { minutes: 1650, picks: [[9, 1], [6, 1]] },
      { minutes: 2900, picks: [[1, 3]] },
      { minutes: 4340, picks: [[0, 4]] },
      { minutes: 5780, picks: [[2, 3], [5, 1]] },
      { minutes: 7220, picks: [[1, 2], [0, 1], [5, 1]] },
      { minutes: 8660, picks: [[4, 3], [11, 2]] },
    ];
    historyPlan.forEach(function (plan, idx) {
      var table = db.tables[(idx + 2) % db.tables.length];
      var customer = customers[(idx + 1) % customers.length];
      var itemAmount = 0;
      var items = plan.picks.map(function (pick) {
        var p = db.products[pick[0]];
        var qty = pick[1];
        var amount = p.price * qty;
        itemAmount += amount;
        return {
          id: uid('oi'),
          productId: p.id,
          productName: p.name,
          imageUrl: p.imageUrl,
          unitPrice: p.price,
          quantity: qty,
          amount: amount,
          specText: '份量:小份 / 辣度:中辣',
          remark: null,
        };
      });
      var discount = itemAmount >= db.store.fullReduceThreshold ? db.store.fullReduceAmount : 0;
      var total = itemAmount - discount;
      var createdAt = minutesAgoText(plan.minutes);
      db.pickup += 1;
      db.seq += 1;
      db.orders.push({
        id: 'o-hist-' + (idx + 1),
        orderNo: orderNo(db.seq),
        tableId: table.id,
        tableName: table.name,
        type: 'DINE_IN',
        status: 'COMPLETED',
        payStatus: 'PAID',
        customerName: customer.name,
        peopleCount: 2 + (idx % 3),
        remark: null,
        receiverName: null,
        receiverPhone: null,
        address: null,
        deliveryFee: 0,
        deliveryEta: null,
        itemAmount: itemAmount,
        discountAmount: discount,
        packingFee: 0,
        totalAmount: total,
        paidAmount: total,
        pickupNo: db.pickup,
        payChannel: 'MOCK',
        createdAt: createdAt,
        paidAt: createdAt,
        cancelReason: null,
        clientId: null,
        items: items,
      });
    });

    return db;
  }

  /* ---------- 状态管理 ---------- */
  var state = null;

  function load() {
    if (state) return state;
    var raw = null;
    try {
      raw = window.localStorage.getItem(DB_KEY);
    } catch (e) {
      raw = null;
    }
    if (raw) {
      try {
        state = JSON.parse(raw);
        return state;
      } catch (e) {
        state = null;
      }
    }
    state = buildSeed();
    save();
    return state;
  }

  function save() {
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify(state));
    } catch (e) {
      /* 隐私模式下忽略持久化 */
    }
  }

  function reset() {
    state = buildSeed();
    save();
    return state;
  }

  /* ---------- 视图映射 ---------- */
  function h5Product(p) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      originalPrice: p.originalPrice,
      unit: p.unit,
      tags: (p.tags || '').split(',').filter(Boolean),
      monthlySales: p.monthlySales,
      soldOut: !!p.soldOut,
      specGroups: (p.specGroups || []).map(function (g) {
        return {
          id: g.id,
          name: g.name,
          required: !!g.required,
          multiple: !!g.multiple,
          options: g.options.map(function (o) {
            return { id: o.id, name: o.name, priceDelta: o.priceDelta, defaultSelected: !!o.defaultSelected };
          }),
        };
      }),
    };
  }

  function adminProduct(p, db) {
    var cat = db.categories.filter(function (c) { return c.id === p.categoryId; })[0];
    return {
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      originalPrice: p.originalPrice,
      unit: p.unit,
      tags: p.tags || '',
      monthlySales: p.monthlySales,
      stockEnabled: !!p.stockEnabled,
      stock: p.stock,
      soldOut: !!p.soldOut,
      status: p.status,
      sort: p.sort,
      category: cat ? { id: cat.id, name: cat.name } : null,
      specGroups: (p.specGroups || []).map(function (g) {
        return {
          id: g.id,
          name: g.name,
          required: !!g.required,
          multiple: !!g.multiple,
          sort: g.sort,
          options: g.options.map(function (o) {
            return { id: o.id, name: o.name, priceDelta: o.priceDelta, sort: o.sort, defaultSelected: !!o.defaultSelected };
          }),
        };
      }),
    };
  }

  function orderBase(o) {
    var itemCount = (o.items || []).reduce(function (sum, item) { return sum + item.quantity; }, 0);
    return {
      id: o.id,
      orderNo: o.orderNo,
      tableName: o.tableName,
      type: o.type,
      status: o.status,
      statusText: STATUS_TEXT[o.status] || o.status,
      payStatus: o.payStatus,
      payStatusText: PAY_TEXT[o.payStatus] || o.payStatus,
      pickupNo: o.pickupNo,
      itemAmount: o.itemAmount,
      discountAmount: o.discountAmount,
      packingFee: o.packingFee,
      deliveryFee: o.deliveryFee,
      deliveryEta: o.deliveryEta,
      totalAmount: o.totalAmount,
      remark: o.remark,
      receiverName: o.receiverName,
      receiverPhone: o.receiverPhone,
      address: o.address,
      createdAt: o.createdAt,
      items: o.items || [],
      itemCount: itemCount,
      allowedActions: allowedActions(o),
    };
  }

  function h5Order(o) {
    var base = orderBase(o);
    return base;
  }

  function adminOrder(o, db) {
    var base = orderBase(o);
    base.customerName = o.customerName;
    base.peopleCount = o.peopleCount;
    base.paidAmount = o.paidAmount || 0;
    base.payChannel = o.payChannel;
    base.paidAt = o.paidAt;
    base.cancelReason = o.cancelReason;
    base.shopName = db.store.name;
    return base;
  }

  function allowedActions(o) {
    var paid = o.payStatus === 'PAID';
    if (o.status === 'UNPAID' || o.status === 'PENDING') {
      return { accept: o.status === 'PENDING' && paid, reject: true };
    }
    if (o.status === 'PREPARING') return { ready: true, reject: true };
    if (o.status === 'READY') return { complete: true };
    return {};
  }

  /* ---------- 点单域逻辑 ---------- */
  function findProduct(db, id) {
    return db.products.filter(function (p) { return p.id === id; })[0] || null;
  }

  function specTextOf(group, option) {
    return group.name + ':' + option.name;
  }

  function createOrder(payload, table, clientId) {
    var db = load();
    var items = [];
    var itemAmount = 0;

    (payload.items || []).forEach(function (line) {
      var product = findProduct(db, line.productId);
      if (!product) throw error('菜品已下架，请重新选择');
      var unitPrice = product.price;
      var texts = [];
      (product.specGroups || []).forEach(function (group) {
        var validIds = (line.specOptionIds || []).filter(function (id) {
          return group.options.some(function (o) { return o.id === id; });
        });
        group.options.forEach(function (option) {
          if (validIds.indexOf(option.id) >= 0) {
            unitPrice += option.priceDelta || 0;
            texts.push(specTextOf(group, option));
          }
        });
      });
      var quantity = Math.max(1, Number(line.quantity) || 1);
      var amount = unitPrice * quantity;
      itemAmount += amount;
      items.push({
        id: uid('oi'),
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        unitPrice: unitPrice,
        quantity: quantity,
        amount: amount,
        specText: texts.length ? texts.join(' / ') : null,
        remark: line.remark || null,
      });
    });

    if (!items.length) throw error('购物车为空');

    var store = db.store;
    var type = payload.type === 'DELIVERY' ? 'DELIVERY' : 'DINE_IN';
    var discount = itemAmount >= store.fullReduceThreshold ? store.fullReduceAmount : 0;
    var deliveryFee = type === 'DELIVERY' ? store.deliveryFee : 0;
    var packingFee = type === 'DELIVERY' ? store.packingFee : 0;
    var total = itemAmount - discount + deliveryFee + packingFee;

    db.seq += 1;
    db.pickup += 1;
    var order = {
      id: uid('o'),
      orderNo: orderNo(db.seq),
      tableId: type === 'DINE_IN' && table ? table.id : null,
      tableName: type === 'DINE_IN' && table ? table.name : null,
      type: type,
      status: 'PENDING',
      payStatus: 'UNPAID',
      customerName: '顾客',
      peopleCount: type === 'DINE_IN' ? payload.peopleCount || null : null,
      remark: payload.remark || null,
      receiverName: payload.receiverName || null,
      receiverPhone: payload.receiverPhone || null,
      address: payload.address || null,
      deliveryFee: deliveryFee,
      deliveryEta: type === 'DELIVERY' ? store.deliveryEta : null,
      itemAmount: itemAmount,
      discountAmount: discount,
      packingFee: packingFee,
      totalAmount: total,
      paidAmount: 0,
      pickupNo: db.pickup,
      payChannel: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      cancelReason: null,
      clientId: clientId || null,
      items: items,
    };
    db.orders.unshift(order);
    save();
    return order;
  }

  function pickTable(db, scene) {
    if (!scene) return db.tables[0] || null;
    var found = db.tables.filter(function (t) { return t.sceneCode === scene; })[0];
    return found || db.tables[0] || null;
  }

  /* ---------- 错误 ---------- */
  function error(message, status) {
    var err = new Error(message);
    err.status = status || 400;
    err.isMockError = true;
    return err;
  }

  /* ---------- fetch 拦截 ---------- */
  function install(handler) {
    var original = window.fetch ? window.fetch.bind(window) : null;

    window.fetch = function (input, init) {
      init = init || {};
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var parsed;
      try {
        parsed = new URL(url, window.location.href);
      } catch (e) {
        return original ? original(input, init) : Promise.reject(e);
      }

      if (parsed.pathname.indexOf('/api/') !== 0) {
        return original ? original(input, init) : Promise.reject(new Error('fetch unavailable'));
      }

      var method = (init.method || 'GET').toUpperCase();
      var body = null;
      var rawBody = init.body;
      if (typeof rawBody === 'string') {
        try { body = JSON.parse(rawBody); } catch (e) { body = null; }
      }

      var ctx = {
        method: method,
        path: parsed.pathname.slice(4), // 去掉 /api 前缀
        query: parsed.searchParams,
        body: body,
        form: rawBody && typeof FormData !== 'undefined' && rawBody instanceof FormData ? rawBody : null,
        headers: init.headers || {},
        db: load(),
      };

      function respond(payload, status) {
        return new Response(JSON.stringify(payload), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      return Promise.resolve()
        .then(function () { return handler(ctx); })
        .then(function (data) { return respond({ code: 0, data: data }); })
        .catch(function (err) {
          if (!err || !err.isMockError) console.error('[mock] 处理失败', ctx.method, ctx.path, err);
          var status = (err && err.status) || 400;
          var message = (err && err.message) || '请求失败';
          if (status === 401) return respond({ code: 401, message: '请先登录' }, 401);
          return respond({ code: 1, message: message }, status === 0 ? 400 : status);
        });
    };

    // 让页面能一键重置演示数据
    window.TSMockReset = function () {
      reset();
      return load();
    };
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve) {
      if (!file) return resolve('');
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { resolve(''); };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 导出 ---------- */
  window.TSMock = {
    DB_KEY: DB_KEY,
    load: load,
    save: save,
    reset: reset,
    install: install,
    error: error,
    svgPic: svgPic,
    uid: uid,
    h5Product: h5Product,
    adminProduct: adminProduct,
    h5Order: h5Order,
    adminOrder: adminOrder,
    orderBase: orderBase,
    allowedActions: allowedActions,
    createOrder: createOrder,
    findProduct: findProduct,
    pickTable: pickTable,
    readFileAsDataUrl: readFileAsDataUrl,
    STATUS_TEXT: STATUS_TEXT,
    PAY_TEXT: PAY_TEXT,
  };
})();
