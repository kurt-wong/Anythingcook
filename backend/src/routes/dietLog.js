/** 饮食记录路由 */
const express = require('express');
const { FILES, readJson, updateJson } = require('../lib/store');
const { ok, fail, asyncHandler, parseIntClamped } = require('../lib/respond');
const { todayStr, daysAgoStr } = require('../lib/dates');

const router = express.Router();

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * 获取饮食记录（按日期，默认本地今天）
 * query: date=YYYY-MM-DD
 */
router.get('/diet-log', asyncHandler(async (req, res) => {
  const date = req.query.date || todayStr(); // H3：本地日期
  const logs = await readJson(FILES.dietLog, []);
  const filtered = logs.filter(log => log.date === date);
  return ok(res, { data: filtered, total: filtered.length });
}));

/**
 * 获取营养汇总
 * query: days=7（近 N 天，默认 7 天）
 */
router.get('/diet-log/summary', asyncHandler(async (req, res) => {
  const days = parseIntClamped(req.query.days, 7, 1, 365);
  const logs = await readJson(FILES.dietLog, []);

  const cutoffStr = daysAgoStr(days); // H3：本地日期

  const recent = logs.filter(log => log.date >= cutoffStr);

  let totalCalories = 0;
  let totalDishes = 0;
  const byDate = {};
  const byMealType = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };

  for (const log of recent) {
    const cal = log.calories || 0;
    totalCalories += cal;
    totalDishes++;
    if (!byDate[log.date]) byDate[log.date] = { calories: 0, dishes: 0 };
    byDate[log.date].calories += cal;
    byDate[log.date].dishes++;
    if (byMealType[log.mealType] !== undefined) byMealType[log.mealType]++;
  }

  const dailyAverage =
    totalDishes > 0
      ? Math.round(totalCalories / Math.max(days, Object.keys(byDate).length))
      : 0;

  return ok(res, {
    data: {
      totalCalories,
      totalDishes,
      dailyAverage,
      byDate,
      byMealType,
      days,
    },
  });
}));

/**
 * 手动添加饮食记录
 * body: { recipeId, recipeName, calories, mealType, guestName }
 */
router.post('/diet-log', asyncHandler(async (req, res) => {
  const { recipeId, recipeName, calories, mealType, guestName } = req.body;
  if (!recipeName || typeof recipeName !== 'string') {
    return fail(res, 400, '请提供 recipeName');
  }
  if (mealType && !MEAL_TYPES.includes(mealType)) {
    return fail(res, 400, '无效的餐次类型');
  }

  const now = new Date();
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: todayStr(), // H3：本地日期
    mealType: mealType || 'snack',
    recipeId: recipeId || null,
    recipeName: recipeName.trim(),
    calories: typeof calories === 'number' && calories > 0 ? calories : null,
    guestName: guestName || null,
    orderId: null,
    source: 'manual',
    createdAt: now.toISOString(),
  };

  await updateJson(FILES.dietLog, [], (logs) => {
    logs.push(newLog);
    return logs;
  });

  return ok(res, { data: newLog, message: '饮食记录已添加' });
}));

/**
 * 删除饮食记录
 */
router.delete('/diet-log/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const logs = await readJson(FILES.dietLog, []);
  if (!logs.some(log => log.id === id)) {
    return fail(res, 404, '记录不存在');
  }
  await updateJson(FILES.dietLog, [], (list) => list.filter(log => log.id !== id));
  return ok(res, { message: '记录已删除' });
}));

module.exports = router;
