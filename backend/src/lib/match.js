/**
 * 食材精确匹配（替代旧的子串模糊匹配）。
 *
 * 旧算法 key.includes(item) 会把 "盐" 误匹配 "盐酥鸡"。
 * 新算法：精确 → 归一化 → 别名表，宁可漏匹配不可错匹配。
 *
 * 调味品分池：不在 ingredientCategoryMap 六大主料分类里的食材视为调味品，
 * 不参与推荐评分，也不扣减库存（CookLikeHOC 的配料/主料分离思路）。
 */
const path = require('path');
const { readJson, FILES } = require('./store');

/** 常见同步残留与格式噪音 */
function normalizeIngredient(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/的用量为.*$/, '')   // "食用油的用量为" → "食用油"
    .replace(/（[^）]*）/g, '')    // 去中文括号注释
    .replace(/\([^)]*\)/g, '')    // 去英文括号注释
    .replace(/\s+/g, '');
}

/** 主料分类集合（缓存） */
let mainIngredientSet = null;

async function loadMainIngredients() {
  if (mainIngredientSet) return mainIngredientSet;
  const catMap = await readJson(FILES.ingredientCategoryMap, {});
  mainIngredientSet = new Set();
  for (const items of Object.values(catMap)) {
    if (Array.isArray(items)) items.forEach(i => mainIngredientSet.add(i));
  }
  return mainIngredientSet;
}

/** 测试用：重置缓存 */
function _resetCache() {
  mainIngredientSet = null;
}

/** 判断是否为主料（在 categoryMap 中）。不在 → 视为调味品 */
async function isMainIngredient(name) {
  const set = await loadMainIngredients();
  const norm = normalizeIngredient(name);
  return set.has(name) || set.has(norm);
}

/** 别名表（懒加载） */
let aliasMap = null;

async function loadAliases() {
  if (aliasMap) return aliasMap;
  const file = path.join(__dirname, '../data/ingredientAlias.json');
  aliasMap = await readJson(file, {});
  return aliasMap;
}

/**
 * 在 availableKeys 中查找与 itemName 对应的库存键。
 * 精确 → 归一化 → 别名（双向）。找不到返回 null。
 */
async function findIngredientMatch(availableKeys, itemName) {
  if (!itemName) return null;
  const keySet = availableKeys instanceof Set ? availableKeys : new Set(availableKeys);

  // 1. 精确匹配
  if (keySet.has(itemName)) return itemName;

  // 2. 归一化匹配
  const normItem = normalizeIngredient(itemName);
  if (normItem && keySet.has(normItem)) return normItem;
  for (const key of keySet) {
    if (normalizeIngredient(key) === normItem) return key;
  }

  // 3. 别名表：itemName 的规范名在库存里
  const aliases = await loadAliases();
  const canonical = aliases[itemName] || aliases[normItem];
  if (canonical && keySet.has(canonical)) return canonical;

  // 4. 别名表反向：库存键的别名包含 itemName
  for (const [canon, alts] of Object.entries(aliases)) {
    if (Array.isArray(alts) && alts.includes(itemName) && keySet.has(canon)) return canon;
  }

  return null;
}

/**
 * 计算菜谱对当前库存的匹配情况（只算主料）。
 * 返回 { matched: [主料名], missing: [主料名], score: 0-1 }
 * 调味品不参与评分。
 */
async function scoreRecipe(recipeStuff, availableKeys) {
  const stuff = Array.isArray(recipeStuff) ? recipeStuff : [];
  const mainStuff = [];
  for (const item of stuff) {
    if (await isMainIngredient(item)) mainStuff.push(item);
  }

  if (mainStuff.length === 0) {
    // 纯调味品菜谱（罕见）：视为可做
    return { matched: [], missing: [], score: 1 };
  }

  const matched = [];
  const missing = [];
  for (const item of mainStuff) {
    const hit = await findIngredientMatch(availableKeys, item);
    if (hit) matched.push(item);
    else missing.push(item);
  }

  return { matched, missing, score: matched.length / mainStuff.length };
}

/**
 * 扣减库存：返回需要扣减的库存键列表（只含主料）。
 * 调味品不扣。
 */
async function deductibleKeys(recipeStuff, ingredients) {
  const stuff = Array.isArray(recipeStuff) ? recipeStuff : [];
  const availableKeys = Object.keys(ingredients);
  const result = [];
  for (const item of stuff) {
    if (!(await isMainIngredient(item))) continue; // 调味品不扣
    const hit = await findIngredientMatch(availableKeys, item);
    if (hit && ingredients[hit] && ingredients[hit].count > 0) {
      result.push(hit);
    }
  }
  return result;
}

module.exports = {
  normalizeIngredient,
  isMainIngredient,
  findIngredientMatch,
  scoreRecipe,
  deductibleKeys,
  _resetCache,
};
