/** 食材库存与做菜扣减路由 */
const express = require('express');
const { FILES, readJson, updateJson } = require('../lib/store');
const { ok, fail, asyncHandler } = require('../lib/respond');

const router = express.Router();

async function loadRecipes() {
  return readJson(FILES.recipes, []);
}

/**
 * 获取所有食材库存
 */
router.get('/ingredients', asyncHandler(async (req, res) => {
  const ingredients = await readJson(FILES.ingredients, {});
  return ok(res, { data: ingredients });
}));

/**
 * 添加或更新食材（支持批量，累加 count）
 * body: { items: [{ name: "鸡蛋", count: 3 }, ...] }
 */
router.post('/ingredients', asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return fail(res, 400, '请提供食材列表 items');
  }

  const data = await updateJson(FILES.ingredients, {}, (ingredients) => {
    for (const item of items) {
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) continue;
      const count = parseInt(item.count, 10);
      const add = Number.isNaN(count) ? 1 : Math.max(0, count);
      if (ingredients[name]) {
        ingredients[name].count = (ingredients[name].count || 0) + add;
      } else {
        ingredients[name] = { count: add, addedAt: new Date().toISOString() };
      }
    }
    return ingredients;
  });

  return ok(res, { data, message: '食材添加成功' });
}));

/**
 * 获取所有菜谱中出现过的食材列表（用于自动补全）
 */
router.get('/ingredients/suggestions', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const allStuff = new Set();
  recipes.forEach(r => {
    if (Array.isArray(r.stuff)) r.stuff.forEach(s => allStuff.add(s));
  });
  return ok(res, { data: [...allStuff].sort() });
}));

/**
 * 获取所有食材及其库存状态（含分类）
 * 返回: [{ name, count, category }, ...]
 */
router.get('/ingredients/all', asyncHandler(async (req, res) => {
  const ingredients = await readJson(FILES.ingredients, {});
  const categoryMap = await readJson(FILES.ingredientCategoryMap, {});

  const ingredientToCategory = {};
  for (const [category, list] of Object.entries(categoryMap)) {
    if (Array.isArray(list)) {
      list.forEach(item => { ingredientToCategory[item] = category; });
    }
  }

  const all = Object.keys(ingredients).map(name => ({
    name,
    count: ingredients[name]?.count || 0,
    category: ingredientToCategory[name] || '其他',
  })).sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category, 'zh-CN');
    }
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  return ok(res, { data: all });
}));

/**
 * 批量更新食材库存（覆盖 count，非累加）
 * body: { items: [{ name: "鸡蛋", count: 5 }, ...] }
 */
router.post('/ingredients/batch', asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return fail(res, 400, '请提供食材列表');
  }

  const data = await updateJson(FILES.ingredients, {}, (ingredients) => {
    for (const item of items) {
      if (item.name && typeof item.count === 'number' && Number.isFinite(item.count)) {
        const count = Math.max(0, Math.floor(item.count));
        // M3：归零保留键，与"清空全部"语义一致
        if (ingredients[item.name]) {
          ingredients[item.name].count = count;
        } else {
          ingredients[item.name] = { count, addedAt: new Date().toISOString() };
        }
      }
    }
    return ingredients;
  });

  return ok(res, { data });
}));

/**
 * 更新单个食材数量
 * body: { count: 5 }
 * M2：直接使用 Express 已解码的 req.params.name，不做二次 decodeURIComponent
 */
router.put('/ingredients/:name', asyncHandler(async (req, res) => {
  const name = req.params.name;
  const { count } = req.body;

  let exists = false;
  const data = await updateJson(FILES.ingredients, {}, (ingredients) => {
    if (!ingredients[name]) return ingredients;
    exists = true;
    const n = parseInt(count, 10);
    ingredients[name].count = Number.isNaN(n) ? 0 : Math.max(0, n);
    // M3：归零保留键
    return ingredients;
  });

  if (!exists) {
    return fail(res, 404, '食材不存在');
  }
  return ok(res, { data, message: '食材更新成功' });
}));

/**
 * 删除食材
 */
router.delete('/ingredients/:name', asyncHandler(async (req, res) => {
  const name = req.params.name; // M2：不再二次解码

  const data = await updateJson(FILES.ingredients, {}, (ingredients) => {
    delete ingredients[name];
    return ingredients;
  });

  return ok(res, { data, message: '食材删除成功' });
}));

/**
 * 清空所有食材（count 置 0，保留标签）
 */
router.delete('/ingredients', asyncHandler(async (req, res) => {
  const data = await updateJson(FILES.ingredients, {}, (ingredients) => {
    for (const name of Object.keys(ingredients)) {
      ingredients[name].count = 0;
    }
    return ingredients;
  });
  return ok(res, { data, message: '库存已清零' });
}));

/**
 * 做菜：扣减食材库存
 * body: { recipeId: "cook-xxx" }
 * M3：扣到 0 保留键（count:0），食材不会从列表消失
 */
router.post('/cook', asyncHandler(async (req, res) => {
  const { recipeId } = req.body;
  if (!recipeId) {
    return fail(res, 400, '请提供 recipeId');
  }

  const recipes = await loadRecipes();
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) {
    return fail(res, 404, '菜谱不存在');
  }

  const stuff = Array.isArray(recipe.stuff) ? recipe.stuff : [];
  const consumed = [];
  const notFound = [];

  await updateJson(FILES.ingredients, {}, (ingredients) => {
    for (const item of stuff) {
      const matchKey = Object.keys(ingredients).find(key =>
        key.includes(item) || item.includes(key)
      );
      if (matchKey && ingredients[matchKey].count > 0) {
        ingredients[matchKey].count = Math.max(0, ingredients[matchKey].count - 1);
        consumed.push(matchKey);
      } else {
        notFound.push(item);
      }
    }
    return ingredients;
  });

  return ok(res, {
    data: { consumed, notFound },
    message: `已扣减 ${consumed.length} 种食材`,
  });
}));

module.exports = router;
