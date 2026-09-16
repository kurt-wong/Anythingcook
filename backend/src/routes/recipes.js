/** 菜谱相关路由：/api/recipes* /api/tags /api/methods /api/tools */
const express = require('express');
const { FILES, readJson } = require('../lib/store');
const { ok, fail, asyncHandler, parseIntClamped, arr } = require('../lib/respond');
const { scoreRecipe } = require('../lib/match');
const { loadRecipes } = require('../lib/recipesCache');

const router = express.Router();

async function getLastUpdated() {
  return readJson(FILES.lastUpdated, null);
}

/**
 * 获取所有菜谱
 */
router.get('/recipes', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const { tag, difficulty, method, tool, search } = req.query;

  let filtered = [...recipes];

  if (tag) {
    filtered = filtered.filter(r => arr(r.tags).includes(tag));
  }
  if (difficulty) {
    filtered = filtered.filter(r => r.difficulty === difficulty);
  }
  if (method) {
    filtered = filtered.filter(r => arr(r.methods).includes(method));
  }
  if (tool) {
    filtered = filtered.filter(r => arr(r.tools).includes(tool));
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r =>
      r.name.toLowerCase().includes(q) ||
      arr(r.stuff).some(s => s.toLowerCase().includes(q)) ||
      arr(r.tags).some(t => t.toLowerCase().includes(q))
    );
  }

  return ok(res, {
    data: filtered,
    total: filtered.length,
    lastUpdated: await getLastUpdated(),
  });
}));

/**
 * 获取随机菜谱
 * query: count=1, tag, difficulty, preferStock=1（优先库存能做的菜）
 */
router.get('/recipes/random', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const { tag, difficulty, preferStock } = req.query;
  const count = parseIntClamped(req.query.count, 1, 1, 50);

  let filtered = [...recipes];

  if (tag) {
    filtered = filtered.filter(r => arr(r.tags).includes(tag));
  }
  if (difficulty) {
    filtered = filtered.filter(r => r.difficulty === difficulty);
  }

  // preferStock=1：优先从库存能做的菜中抽取，无可做菜时回退全库
  if (preferStock === '1' || preferStock === 'true') {
    const ingredients = await readJson(FILES.ingredients, {});
    const available = Object.keys(ingredients).filter(
      name => ingredients[name].count > 0
    );
    if (available.length > 0) {
      const cookable = [];
      for (const r of filtered) {
        const { score } = await scoreRecipe(r.stuff, available);
        if (score > 0) cookable.push(r);
      }
      if (cookable.length > 0) filtered = cookable;
    }
  }

  const randomRecipes = [];
  const maxCount = Math.min(count, filtered.length);
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.floor(Math.random() * filtered.length);
    randomRecipes.push(filtered[idx]);
    filtered.splice(idx, 1);
  }

  return ok(res, { data: randomRecipes, total: randomRecipes.length });
}));

/**
 * 根据食材库存推荐菜谱（只算主料，调味品不参与评分）
 * query: count=5
 */
router.get('/recipes/recommend', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const ingredients = await readJson(FILES.ingredients, {});
  const count = parseIntClamped(req.query.count, 5, 1, 100);

  const available = Object.keys(ingredients).filter(
    name => ingredients[name].count > 0
  );
  if (available.length === 0) {
    return ok(res, { data: [], message: '请先添加食材库存' });
  }

  const scored = [];
  for (const recipe of recipes) {
    const { matched, missing, score } = await scoreRecipe(recipe.stuff, available);
    if (score > 0) {
      scored.push({ ...recipe, matched, missing, score });
    }
  }

  const recommended = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count);

  return ok(res, { data: recommended, total: recommended.length });
}));

/**
 * 获取单个菜谱详情
 */
router.get('/recipes/:id', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const recipe = recipes.find(r => r.id === req.params.id);
  if (!recipe) {
    return fail(res, 404, '菜谱不存在');
  }
  return ok(res, { data: recipe });
}));

/**
 * 获取所有可用的标签
 */
router.get('/tags', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const tags = [...new Set(recipes.flatMap(r => arr(r.tags)))].sort();
  return ok(res, { data: tags });
}));

/**
 * 获取所有可用的烹饪方式
 */
router.get('/methods', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const methods = [...new Set(recipes.flatMap(r => arr(r.methods)))].sort();
  return ok(res, { data: methods });
}));

/**
 * 获取所有可用的工具
 */
router.get('/tools', asyncHandler(async (req, res) => {
  const recipes = await loadRecipes();
  const tools = [...new Set(recipes.flatMap(r => arr(r.tools)))].sort();
  return ok(res, { data: tools });
}));

module.exports = router;
