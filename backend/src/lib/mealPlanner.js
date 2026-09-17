/**
 * 周食谱智能生成 —— 基于库存的健康配比周计划。
 *
 * 算法（KISS，不引入 AI）：
 * 1. 按 category/tags 把菜谱分池：早餐 / 正餐（荤/素/主食/水产/汤） / 加餐
 * 2. 用 lib/match.js 给每道菜打库存匹配分（只算主料）
 * 3. 逐天填充：早餐 1 道；午/晚餐各 2–3 道保证荤素搭配；加餐可选
 * 4. 约束：整周不重复；蛋白来源轮换（同类肉不连续两天）；匹配度优先
 * 5. 无库存时回退：按 category 均匀随机，仍保证荤素搭配
 */
const { scoreRecipe } = require('./match');
const { loadRecipes } = require('./recipesCache');
const { readJson, FILES } = require('./store');
const { getWeekStart } = require('./dates');

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** 正餐池的 category 白名单 */
const MAIN_CATS = new Set(['荤菜', '素菜', '主食', '水产', '汤与粥', '家常菜', '川菜']);
/** 早餐池 */
const BREAKFAST_CATS = new Set(['早餐']);
/** 加餐池 */
const SNACK_CATS = new Set(['甜品', '饮品']);

/** 荤菜/水产 → 蛋白来源标签（用于轮换） */
function proteinSource(recipe) {
  const cat = recipe.category || '';
  if (cat === '水产') return '水产';
  const tags = recipe.tags || [];
  if (tags.includes('水产')) return '水产';
  const stuff = recipe.stuff || [];
  if (stuff.some(s => /鸡|鸭|鹅/.test(s))) return '禽';
  if (stuff.some(s => /猪|五花|里脊|排骨|腊肠|腊肉|火腿/.test(s))) return '猪';
  if (stuff.some(s => /牛/.test(s))) return '牛';
  if (stuff.some(s => /羊/.test(s))) return '羊';
  if (stuff.some(s => /虾|鱼|扇贝|龙虾|蟹|蛤|蚝|鱿鱼/.test(s))) return '水产';
  if (cat === '荤菜') return '其他荤';
  return null;
}

/** 判断菜谱是素菜 */
function isVeg(recipe) {
  const cat = recipe.category || '';
  if (cat === '素菜') return true;
  const tags = recipe.tags || [];
  if (tags.includes('素菜')) return true;
  return false;
}

/** 判断菜谱是主食 */
function isStaple(recipe) {
  const cat = recipe.category || '';
  if (cat === '主食') return true;
  const tags = recipe.tags || [];
  return tags.includes('主食');
}

/** 加权随机选一个（score 越高概率越大），从 pool 中排除 used */
function pickWeighted(pool, used, rng) {
  const available = pool.filter(r => !used.has(r.id));
  if (available.length === 0) return null;
  const weights = available.map(r => ((r._matchScore || 0) + 0.15));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < available.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return available[i];
  }
  return available[available.length - 1];
}

/**
 * 生成一周食谱。
 * @param {object} opts - { seed?: number } 可选随机种子（便于测试）
 * @returns {{ weekStart: string, days: object, summary: object }}
 */
async function generateWeeklyPlan(opts = {}) {
  const recipes = await loadRecipes();
  const ingredients = await readJson(FILES.ingredients, {});
  const availableKeys = Object.keys(ingredients).filter(k => ingredients[k].count > 0);

  // 给每道菜打库存匹配分
  const scored = [];
  for (const r of recipes) {
    const { score } = await scoreRecipe(r.stuff, availableKeys);
    scored.push({ ...r, _matchScore: score });
  }

  // 分池
  const breakfastPool = [];
  const meatPool = [];
  const vegPool = [];
  const staplePool = [];
  const soupPool = [];
  const snackPool = [];
  const otherPool = []; // 无 category 且无明确 tag 的菜，不默认归素

  for (const r of scored) {
    const cat = r.category || '';
    const tags = r.tags || [];
    const isBreakfast = BREAKFAST_CATS.has(cat) || tags.includes('早餐') || tags.includes('早饭');
    if (isBreakfast) { breakfastPool.push(r); continue; }
    if (SNACK_CATS.has(cat) || tags.includes('零食') || tags.includes('小吃')) { snackPool.push(r); continue; }
    if (MAIN_CATS.has(cat) || tags.some(t => MAIN_CATS.has(t))) {
      if (cat === '荤菜' || cat === '水产') {
        meatPool.push(r);
      } else if (isVeg(r)) {
        vegPool.push(r);
      } else if (isStaple(r)) {
        staplePool.push(r);
      } else if (cat === '汤与粥') {
        soupPool.push(r);
      } else {
        meatPool.push(r);
      }
      continue;
    }
    // 无 category 的菜谱：按 tags 粗分，无明确 tag 的归 otherPool
    if (tags.includes('荤菜') || tags.includes('下饭')) meatPool.push(r);
    else if (tags.includes('素菜')) vegPool.push(r);
    else if (tags.includes('主食')) staplePool.push(r);
    else if (tags.includes('汤') || tags.includes('粥')) soupPool.push(r);
    else otherPool.push(r); // BUG #3 修复：不默认归素
  }

  // 按匹配度排序（无库存时同分靠名称稳定排序）
  const byScore = (a, b) => b._matchScore - a._matchScore || a.name.localeCompare(b.name, 'zh-CN');
  [breakfastPool, meatPool, vegPool, staplePool, soupPool, snackPool, otherPool].forEach(p => p.sort(byScore));

  // 简单可复现 RNG（mulberry32）
  const seed = opts.seed ?? Date.now();
  let s = seed >>> 0;
  const rng = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const used = new Set();
  const days = {};
  const lastProtein = { lunch: null, dinner: null };
  let totalPicked = 0;
  let matchedPicked = 0;

  const take = (pool) => {
    const r = pickWeighted(pool, used, rng);
    if (r) {
      used.add(r.id);
      totalPicked++;
      if (r._matchScore > 0) matchedPicked++;
    }
    return r;
  };

  /** 组一餐：三菜一汤（3 道菜 + 1 道汤） */
  const buildMeal = (mealType) => {
    const ids = [];
    // 菜1：荤菜（避开昨天同蛋白，只选有蛋白的）
    const meatWithProtein = meatPool.filter(r => proteinSource(r) !== null);
    const meatCandidates = meatWithProtein.filter(r => proteinSource(r) !== lastProtein[mealType]);
    const meat = pickWeighted(meatCandidates.length ? meatCandidates : meatWithProtein, used, rng);
    if (meat) {
      used.add(meat.id);
      totalPicked++;
      if (meat._matchScore > 0) matchedPicked++;
      ids.push(meat.id);
      lastProtein[mealType] = proteinSource(meat);
    }
    // 菜2：素菜（优先 vegPool，回退 otherPool 有蛋白的）
    const veg = take(vegPool) || (() => {
      const withProtein = otherPool.filter(r => proteinSource(r) !== null);
      const r = pickWeighted(withProtein, used, rng);
      if (r) {
        used.add(r.id);
        totalPicked++;
        if (r._matchScore > 0) matchedPicked++;
      }
      return r;
    })();
    if (veg) ids.push(veg.id);
    // 菜3：荤素混合（从剩余池加权随机）
    const mixPool = [...meatPool, ...vegPool, ...otherPool].filter(r => !used.has(r.id));
    const mix = pickWeighted(mixPool, used, rng);
    if (mix) {
      used.add(mix.id);
      totalPicked++;
      if (mix._matchScore > 0) matchedPicked++;
      ids.push(mix.id);
    }
    // 汤：必选
    const soup = take(soupPool);
    if (soup) ids.push(soup.id);
    return ids;
  };

  for (const day of DAY_KEYS) {
    const breakfast = [];
    const b = take(breakfastPool);
    if (b) breakfast.push(b.id);

    const lunch = buildMeal('lunch');
    const dinner = buildMeal('dinner');

    const snack = [];
    if (rng() < 0.4) {
      const sn = take(snackPool);
      if (sn) snack.push(sn.id);
    }

    days[day] = { breakfast, lunch, dinner, snack };
  }

  return {
    weekStart: getWeekStart(),
    days,
    summary: {
      totalDishes: totalPicked,
      stockMatched: matchedPicked,
      stockMatchRate: totalPicked > 0 ? Math.round((matchedPicked / totalPicked) * 100) : 0,
      poolSizes: {
        breakfast: breakfastPool.length,
        meat: meatPool.length,
        veg: vegPool.length,
        staple: staplePool.length,
        soup: soupPool.length,
        snack: snackPool.length,
        other: otherPool.length,
      },
    },
  };
}

module.exports = { generateWeeklyPlan };
