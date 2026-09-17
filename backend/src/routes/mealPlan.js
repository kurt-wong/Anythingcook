/** 周计划路由 */
const express = require('express');
const fs = require('fs-extra');
const { FILES, readJson, writeJson } = require('../lib/store');
const { ok, fail, asyncHandler } = require('../lib/respond');
const { getWeekStart } = require('../lib/dates');
const { generateWeeklyPlan } = require('../lib/mealPlanner');

const router = express.Router();

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

function emptyWeekPlan(weekStart) {
  const days = {};
  for (const key of DAY_KEYS) {
    days[key] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  }
  return { weekStart, days };
}

/**
 * 获取当周计划（无则返回空模板）
 * H2：getWeekStart 现返回本地时区的本周一
 */
router.get('/meal-plan', asyncHandler(async (req, res) => {
  const weekStart = getWeekStart();
  if (await fs.pathExists(FILES.mealPlan)) {
    const plan = await readJson(FILES.mealPlan, null);
    if (plan && plan.weekStart === weekStart && plan.days) {
      // 向后兼容：补全缺失的餐次字段
      for (const key of DAY_KEYS) {
        if (plan.days[key]) {
          for (const meal of MEAL_TYPES) {
            if (!Array.isArray(plan.days[key][meal])) {
              plan.days[key][meal] = [];
            }
          }
        }
      }
      return ok(res, { data: plan });
    }
  }
  return ok(res, { data: emptyWeekPlan(weekStart) });
}));

/**
 * 智能生成一周食谱（基于库存 + 健康配比）
 * body: { seed?: number } 可选随机种子
 * 返回生成的计划（不自动保存，前端确认后 PUT 保存）
 */
router.post('/meal-plan/generate', asyncHandler(async (req, res) => {
  const { seed } = req.body || {};
  const plan = await generateWeeklyPlan({ seed });
  return ok(res, {
    data: plan,
    message: `已生成本周食谱，库存匹配率 ${plan.summary.stockMatchRate}%`,
  });
}));

/**
 * 保存周计划（整周覆盖）
 * body: { days: { mon: { lunch: [recipeId], dinner: [recipeId] }, ... } }
 */
router.put('/meal-plan', asyncHandler(async (req, res) => {
  const { days } = req.body;
  if (!days || typeof days !== 'object') {
    return fail(res, 400, '请提供 days 字段');
  }
  const weekStart = getWeekStart();
  const plan = emptyWeekPlan(weekStart);
  for (const key of DAY_KEYS) {
    if (days[key] && typeof days[key] === 'object') {
      for (const meal of MEAL_TYPES) {
        plan.days[key][meal] = Array.isArray(days[key][meal]) ? days[key][meal] : [];
      }
    }
  }
  await writeJson(FILES.mealPlan, plan);
  return ok(res, { data: plan, message: '周计划已保存' });
}));

/**
 * 向指定天/餐添加一道菜（食客可修改食谱）
 * body: { day: "mon", meal: "lunch", recipeId: "xxx" }
 */
router.post('/meal-plan/dish', asyncHandler(async (req, res) => {
  const { day, meal, recipeId } = req.body || {};
  if (!DAY_KEYS.includes(day)) return fail(res, 400, '无效的日期');
  if (!MEAL_TYPES.includes(meal)) return fail(res, 400, '无效的餐次');
  if (!recipeId || typeof recipeId !== 'string') return fail(res, 400, '请提供 recipeId');

  const weekStart = getWeekStart();
  let plan = null;
  if (await fs.pathExists(FILES.mealPlan)) {
    plan = await readJson(FILES.mealPlan, null);
  }
  if (!plan || plan.weekStart !== weekStart || !plan.days) {
    plan = emptyWeekPlan(weekStart);
  }
  if (!Array.isArray(plan.days[day][meal])) {
    plan.days[day][meal] = [];
  }
  if (!plan.days[day][meal].includes(recipeId)) {
    plan.days[day][meal].push(recipeId);
  }
  await writeJson(FILES.mealPlan, plan);
  return ok(res, { data: plan, message: '已添加菜品' });
}));

/**
 * 从指定天/餐移除一道菜
 * body: { day: "mon", meal: "lunch", recipeId: "xxx" }
 */
router.delete('/meal-plan/dish', asyncHandler(async (req, res) => {
  const { day, meal, recipeId } = req.body || {};
  if (!DAY_KEYS.includes(day)) return fail(res, 400, '无效的日期');
  if (!MEAL_TYPES.includes(meal)) return fail(res, 400, '无效的餐次');
  if (!recipeId) return fail(res, 400, '请提供 recipeId');

  const weekStart = getWeekStart();
  let plan = null;
  if (await fs.pathExists(FILES.mealPlan)) {
    plan = await readJson(FILES.mealPlan, null);
  }
  if (!plan || plan.weekStart !== weekStart || !plan.days) {
    return fail(res, 404, '本周暂无计划');
  }
  if (Array.isArray(plan.days[day]?.[meal])) {
    plan.days[day][meal] = plan.days[day][meal].filter(id => id !== recipeId);
  }
  await writeJson(FILES.mealPlan, plan);
  return ok(res, { data: plan, message: '已移除菜品' });
}));

module.exports = router;
