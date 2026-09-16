/**
 * 食材精确匹配 + 调味品分池。
 *
 * 判定逻辑（修复 BUG #1/#2）：
 *   旧：只在 ingredientCategoryMap 的 54 个词里找 → 95% 的食材被误判为调味品
 *   新：不在 seasonings.json 白名单里的都是主料（宁可多算主料，不可漏算）
 *
 * 别名感知（修复 BUG #2）：
 *   isMainIngredient 检查别名表，"番茄" 的规范名 "西红柿" 在 categoryMap 中 → 是主料
 */
const path = require('path');
const { readJson, FILES } = require('./store');

// ---------------------------------------------------------------------------
// 归一化
// ---------------------------------------------------------------------------

function normalizeIngredient(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/的用量为.*$/, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '');
}

// ---------------------------------------------------------------------------
// 调味品白名单（懒加载）
// ---------------------------------------------------------------------------

let seasoningSet = null;

async function loadSeasonings() {
  if (seasoningSet) return seasoningSet;
  const file = path.join(__dirname, '../data/seasonings.json');
  const data = await readJson(file, { list: [] });
  seasoningSet = new Set(data.list || []);
  return seasoningSet;
}

// ---------------------------------------------------------------------------
// 别名表（懒加载）
// ---------------------------------------------------------------------------

let aliasMap = null;

async function loadAliases() {
  if (aliasMap) return aliasMap;
  const file = path.join(__dirname, '../data/ingredientAlias.json');
  aliasMap = await readJson(file, {});
  return aliasMap;
}

/** 获取 name 的所有等价形式（自身 + 归一化 + 别名双向） */
async function getEquivalents(name) {
  const norm = normalizeIngredient(name);
  const aliases = await loadAliases();
  const result = new Set([name]);
  if (norm) result.add(norm);

  // 别名表：name → 规范名
  const canonical = aliases[name] || aliases[norm];
  if (canonical) result.add(canonical);

  // 别名表反向：规范名 → name
  for (const [canon, alts] of Object.entries(aliases)) {
    if (Array.isArray(alts) && (alts.includes(name) || alts.includes(norm))) {
      result.add(canon);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 主料判定（修复 BUG #1：反转逻辑 + 别名感知）
// ---------------------------------------------------------------------------

/**
 * 判断是否为主料。
 * 规则：不在调味品白名单里的一律是主料。
 * 别名感知：先展开等价形式，任一形式不在白名单里 → 是主料。
 */
async function isMainIngredient(name) {
  const seasonings = await loadSeasonings();
  const equivalents = await getEquivalents(name);
  // 任一等价形式不在调味品白名单 → 视为主料
  for (const eq of equivalents) {
    if (!seasonings.has(eq)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 库存匹配
// ---------------------------------------------------------------------------

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

  // 3. 别名：itemName 的等价形式在库存里
  const equivalents = await getEquivalents(itemName);
  for (const eq of equivalents) {
    if (keySet.has(eq)) return eq;
  }

  // 4. 反向：库存键的等价形式包含 itemName
  for (const key of keySet) {
    const keyEquivs = await getEquivalents(key);
    if (keyEquivs.has(itemName) || (normItem && keyEquivs.has(normItem))) {
      return key;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 评分（只算主料）
// ---------------------------------------------------------------------------

/**
 * 计算菜谱对当前库存的匹配情况。
 * 调味品不参与评分；所有非调味品的用料都参与。
 * LOW #1 修复：matched 推入归一化形式，不推原始噪音（如"鸡蛋的用量为"→"鸡蛋"）
 * LOW #2 修复：无主料的菜谱返回 score=0（如螺蛳粉 stuff=["水"]），不再拿满分
 * 返回 { matched, missing, score }
 */
async function scoreRecipe(recipeStuff, availableKeys) {
  const stuff = Array.isArray(recipeStuff) ? recipeStuff : [];
  const mainStuff = [];
  for (const item of stuff) {
    if (await isMainIngredient(item)) mainStuff.push(item);
  }

  // 无主料的菜谱：score=0（LOW #2：不再走"纯调味品"分支拿满分）
  if (mainStuff.length === 0) {
    return { matched: [], missing: [], score: 0 };
  }

  const matched = [];
  const missing = [];
  for (const item of mainStuff) {
    const hit = await findIngredientMatch(availableKeys, item);
    if (hit) matched.push(normalizeIngredient(item) || item); // LOW #1：推归一化形式
    else missing.push(normalizeIngredient(item) || item);
  }

  return { matched, missing, score: matched.length / mainStuff.length };
}

// ---------------------------------------------------------------------------
// 库存扣减（只扣主料）
// ---------------------------------------------------------------------------

async function deductibleKeys(recipeStuff, ingredients) {
  const stuff = Array.isArray(recipeStuff) ? recipeStuff : [];
  const availableKeys = Object.keys(ingredients);
  const result = [];
  for (const item of stuff) {
    if (!(await isMainIngredient(item))) continue;
    const hit = await findIngredientMatch(availableKeys, item);
    if (hit && ingredients[hit] && ingredients[hit].count > 0) {
      result.push(hit);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// 测试辅助
// ---------------------------------------------------------------------------

function _resetCache() {
  seasoningSet = null;
  aliasMap = null;
}

module.exports = {
  normalizeIngredient,
  isMainIngredient,
  findIngredientMatch,
  scoreRecipe,
  deductibleKeys,
  _resetCache,
};
