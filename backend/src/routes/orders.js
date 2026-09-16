/** 订单管理路由 */
const express = require('express');
const { FILES, readJson, updateJson } = require('../lib/store');
const { ok, fail, asyncHandler } = require('../lib/respond');
const { todayStr, inferMealType } = require('../lib/dates');
const { deductibleKeys } = require('../lib/match');
const { loadRecipes } = require('../lib/recipesCache');

const router = express.Router();

const VALID_STATUSES = ['pending', 'cooking', 'completed'];
const MAX_QUANTITY = 99;
const MAX_NAME_LEN = 20;
const MAX_ITEMS = 50;

/**
 * 校验并规范化订单入参。返回 { error } 或 { guestName, items }。
 * H4：quantity 必须是 1–99 的整数，负数/NaN/0 一律拒绝（负数曾会反向加库存）。
 */
function validateOrderBody(body) {
  const guestName = typeof body.guestName === 'string' ? body.guestName.trim() : '';
  if (!guestName || guestName.length > MAX_NAME_LEN) {
    return { error: `请提供食客名称（1–${MAX_NAME_LEN} 字）` };
  }

  const { items } = body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { error: '请提供点菜单' };
  }
  if (items.length > MAX_ITEMS) {
    return { error: `一次最多点 ${MAX_ITEMS} 道菜` };
  }

  const normalized = [];
  for (const item of items) {
    const recipeId = typeof item.recipeId === 'string' ? item.recipeId : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!recipeId || !name) {
      return { error: '点菜单项缺少菜谱 ID 或菜名' };
    }
    const quantity = item.quantity;
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return { error: `数量必须是 1–${MAX_QUANTITY} 的整数` };
    }
    normalized.push({ recipeId, name, quantity });
  }
  return { guestName, items: normalized };
}

/**
 * 创建新订单（食客点菜）
 */
router.post('/orders', asyncHandler(async (req, res) => {
  const result = validateOrderBody(req.body || {});
  if (result.error) {
    return fail(res, 400, result.error);
  }

  const newOrder = {
    id: `order-${Date.now()}`,
    guestName: result.guestName,
    items: result.items,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await updateJson(FILES.orders, [], (orders) => {
    orders.push(newOrder);
    return orders;
  });

  return ok(res, { data: newOrder, message: '点菜成功' });
}));

/**
 * 获取所有订单
 * query: status=pending/cooking/completed（可选）
 */
router.get('/orders', asyncHandler(async (req, res) => {
  const { status } = req.query;
  let orders = await readJson(FILES.orders, []);

  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return ok(res, { data: orders, total: orders.length });
}));

/**
 * 完成订单时的副作用：扣库存 + 写饮食日志
 * H3：date 用本地日期，mealType 用本地小时
 * B：calories 乘 quantity；只扣主料（调味品不扣）
 */
async function completeOrderSideEffects(order) {
  const recipes = await loadRecipes();

  await updateJson(FILES.ingredients, {}, async (ingredients) => {
    for (const item of order.items) {
      const recipe = recipes.find(r => r.id === item.recipeId);
      if (!recipe || !Array.isArray(recipe.stuff)) continue;
      // 只扣主料，调味品视为常备
      const keys = await deductibleKeys(recipe.stuff, ingredients);
      for (const key of keys) {
        ingredients[key].count = Math.max(
          0,
          (ingredients[key].count || 0) - (item.quantity || 1)
        );
      }
    }
    return ingredients;
  });

  await updateJson(FILES.dietLog, [], (dietLogs) => {
    const now = new Date();
    const today = todayStr(); // H3：本地日期
    const mealType = inferMealType(now);

    for (const item of order.items) {
      const recipe = recipes.find(r => r.id === item.recipeId);
      const qty = item.quantity || 1;
      dietLogs.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        mealType,
        recipeId: item.recipeId,
        recipeName: item.name,
        quantity: qty, // B：记录份数
        calories: recipe?.calories ? recipe.calories * qty : null, // B：热量按份数折算
        guestName: order.guestName,
        orderId: order.id,
        source: 'order',
        createdAt: now.toISOString(),
      });
    }
    return dietLogs;
  });
}

/**
 * 更新订单状态
 * body: { status: 'cooking' | 'completed' }
 */
router.put('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return fail(res, 400, '无效的订单状态');
  }

  const orders = await readJson(FILES.orders, []);
  const order = orders.find(o => o.id === id);
  if (!order) {
    return fail(res, 404, '订单不存在');
  }

  // 先做副作用（由"当前不是 completed"保证幂等），再更新状态
  if (status === 'completed' && order.status !== 'completed') {
    await completeOrderSideEffects(order);
  }

  const updated = await updateJson(FILES.orders, [], (list) => {
    const target = list.find(o => o.id === id);
    if (target) target.status = status;
    return list;
  });

  const result = Array.isArray(updated) ? updated.find(o => o.id === id) : null;
  return ok(res, { data: result || { ...order, status }, message: '订单状态更新成功' });
}));

/**
 * 删除订单
 */
router.delete('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const orders = await readJson(FILES.orders, []);
  if (!orders.some(o => o.id === id)) {
    return fail(res, 404, '订单不存在');
  }

  await updateJson(FILES.orders, [], (list) =>
    list.filter(o => o.id !== id)
  );

  return ok(res, { message: '订单删除成功' });
}));

module.exports = router;
module.exports.validateOrderBody = validateOrderBody;
