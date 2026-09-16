/**
 * 双源菜谱合并同步
 *
 * 源 A（主力）: proj.kitchen API —— 步骤、克数用量、小贴士、分类、难度、工具
 * 源 B（补充）: YunYouJun/cook CSV —— B站视频号 bv、标签、烹饪方式
 *
 * 合并规则：菜名归一化（去括号后缀）后匹配。A 为主记录；命中 B 则附加 bv/tags/methods；
 * 仅存在于 B 的菜保留为轻量记录。图片按本地 images/ 目录探测关联，零下载。
 * 卡路里从 HowToCook GitHub markdown 尽力提取（可用 SYNC_SKIP_CALORIES=1 跳过）。
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { parse } = require('csv-parse/sync');

const DATA_DIR = path.join(__dirname, '../data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');
const LAST_UPDATED_FILE = path.join(DATA_DIR, 'last_updated.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

const PROJ_KITCHEN_API = 'https://proj.kitchen/api/recipes';
const COOK_CSV_URL = 'https://raw.githubusercontent.com/YunYouJun/cook/main/app/data/recipe.csv';
const HOWTOCOOK_README_URL = 'https://raw.githubusercontent.com/Anduin2017/HowToCook/master/README.md';
const HOWTOCOOK_RAW_BASE = 'https://raw.githubusercontent.com/Anduin2017/HowToCook/master';

// 可选代理（拉取 GitHub raw 用，与现有脚本一致）
const PROXY_URL = process.env.HTTP_PROXY || process.env.http_proxy || '';
const REQUEST_DELAY_MS = 300;

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(IMAGES_DIR);

// ---------------------------------------------------------------------------
// 纯函数（供单测使用）
// ---------------------------------------------------------------------------

/**
 * 菜名归一化：去掉中英文括号后缀（如"宫保鸡丁（鸡胸肉版）" -> "宫保鸡丁"），trim
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * 在本地图片文件名集合中探测菜谱图片，返回文件名（含扩展名）或 null
 * 依次尝试：原始名、归一化名、拼音 id
 */
function matchLocalImage(name, apiId, imageFileSet) {
  const candidates = [];
  const base = normalizeName(name);
  if (name) candidates.push(name);
  if (base && base !== name) candidates.push(base);
  if (apiId) candidates.push(apiId);

  for (const candidate of candidates) {
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const file = candidate + ext;
      if (imageFileSet.has(file)) return file;
    }
  }
  return null;
}

/**
 * 双源合并。primary = proj.kitchen 记录数组，secondary = cook CSV 记录数组
 * 返回统一 schema 的菜谱数组
 */
function mergeRecipes(primary, secondary) {
  const byNormalized = new Map();
  for (const item of secondary) {
    const key = normalizeName(item.name);
    if (key && !byNormalized.has(key)) byNormalized.set(key, item);
  }

  const usedSecondary = new Set();
  const merged = primary.map((p) => {
    const key = normalizeName(p.name);
    const match = byNormalized.get(key);
    const recipe = {
      id: p.id,
      name: p.name,
      stuff: p.stuff || [],
      ingredients: p.ingredients || [],
      steps: p.steps || [],
      tips: p.tips || '',
      calories: p.calories ?? null,
      difficulty: p.difficulty || '中等',
      category: p.category || '',
      tools: p.tools || [],
      tags: p.tags && p.tags.length ? p.tags : p.category ? [p.category] : [],
      methods: p.methods || [],
      bv: '',
      source: 'howtocook',
      imageUrl: p.imageUrl || null,
    };
    if (match) {
      usedSecondary.add(match);
      if (match.bv) recipe.bv = match.bv;
      if (match.tags && match.tags.length) {
        recipe.tags = [...new Set([...recipe.tags, ...match.tags])];
      }
      if (match.methods && match.methods.length) recipe.methods = match.methods;
    }
    return recipe;
  });

  // 仅存在于 cook 源的菜保留为轻量记录
  for (const item of secondary) {
    if (usedSecondary.has(item)) continue;
    merged.push({
      id: item.id,
      name: item.name,
      stuff: item.stuff || [],
      ingredients: [],
      steps: [],
      tips: '',
      calories: null,
      difficulty: item.difficulty || '普通',
      category: '',
      tools: item.tools || [],
      tags: item.tags || [],
      methods: item.methods || [],
      bv: item.bv || '',
      source: 'cook',
      imageUrl: null,
    });
  }

  return merged;
}

// ---------------------------------------------------------------------------
// 网络与 IO
// ---------------------------------------------------------------------------

function axiosConfig() {
  const config = { timeout: 15000, headers: { 'User-Agent': 'Amazing-Food-App/2.0' } };
  if (PROXY_URL) {
    try {
      const u = new URL(PROXY_URL);
      config.proxy = { host: u.hostname, port: parseInt(u.port, 10) || 80 };
    } catch (e) {
      // 代理地址无效则直连
    }
  }
  return config;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 源 A：proj.kitchen 列表 + 详情
 */
async function fetchProjKitchen() {
  console.log('[A] 拉取 proj.kitchen 菜谱列表...');
  const listRes = await axios.get(PROJ_KITCHEN_API, { timeout: 15000 });
  const list = listRes.data;
  console.log(`[A] 列表共 ${list.length} 道`);

  const recipes = [];
  let failCount = 0;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    try {
      const detailRes = await axios.get(
        `${PROJ_KITCHEN_API}/${encodeURIComponent(item.id)}`,
        { timeout: 10000 }
      );
      const d = detailRes.data;
      recipes.push({
        id: `howtocook-${d.id}`,
        apiId: d.id,
        name: d.name,
        stuff: (d.ingredients || []).map((ing) =>
          typeof ing === 'string' ? ing : ing.name
        ),
        ingredients: d.ingredients || [],
        steps: d.steps || [],
        tips: d.tips || '',
        difficulty: d.difficulty || '中等',
        category: d.category || '',
        tools: d.tools || [],
      });
    } catch (e) {
      failCount++;
      console.error(`[A] 详情失败 [${item.id}]: ${e.message}`);
    }
    if (i < list.length - 1) await delay(REQUEST_DELAY_MS);
    if ((i + 1) % 50 === 0) {
      console.log(`[A] 进度 ${i + 1}/${list.length}（失败 ${failCount}）`);
    }
  }
  console.log(`[A] 完成：成功 ${recipes.length}，失败 ${failCount}`);
  return recipes;
}

/**
 * 源 B：YunYouJun/cook CSV
 */
async function fetchCookCsv() {
  console.log('[B] 拉取 cook CSV...');
  const res = await axios.get(COOK_CSV_URL, { timeout: 15000 });
  const records = parse(res.data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  const recipes = records
    .map((r) => ({
      id: `cook-${r.name || ''}`,
      name: r.name || '',
      stuff: r.stuff ? r.stuff.split('、').filter(Boolean) : [],
      bv: r.bv || '',
      difficulty: r.difficulty || '普通',
      tags: r.tags ? r.tags.split('、').filter(Boolean) : [],
      methods: r.methods ? r.methods.split('、').filter(Boolean) : [],
      tools: r.tools ? r.tools.split('、').filter(Boolean) : [],
    }))
    .filter((r) => r.name);
  console.log(`[B] 解析得到 ${recipes.length} 道`);
  return recipes;
}

/**
 * 读取本地图片文件名集合
 */
async function listLocalImages() {
  try {
    const files = await fs.readdir(IMAGES_DIR);
    return new Set(files);
  } catch (e) {
    return new Set();
  }
}

/**
 * 为菜谱关联本地图片（零下载）
 */
function linkImages(recipes, imageFileSet) {
  let linked = 0;
  for (const recipe of recipes) {
    if (recipe.imageUrl) {
      linked++;
      continue;
    }
    const apiId = recipe.id.startsWith('howtocook-')
      ? recipe.id.replace('howtocook-', '')
      : '';
    const file = matchLocalImage(recipe.name, apiId, imageFileSet);
    if (file) {
      recipe.imageUrl = `/api/local-image/${encodeURIComponent(file)}`;
      linked++;
    }
  }
  return linked;
}

/**
 * 解析 HowToCook README，得到 菜名 -> { category, dirName } 映射（有目录 = 有 md 文件）
 */
async function fetchDishPathMap() {
  const res = await axios.get(HOWTOCOOK_README_URL, axiosConfig());
  const dishMap = new Map();
  const linkRegex = /\[([^\]]+)\]\(dishes\/([^/]+)\/([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(res.data)) !== null) {
    const dishName = match[1];
    const category = match[2];
    const parts = match[3].split('/');
    if (parts.length >= 2) {
      dishMap.set(dishName, { category, dirName: parts[0] });
    } else {
      // 无子目录：dishes/category/菜名.md
      dishMap.set(dishName, { category, dirName: null, file: parts[0] });
    }
  }
  return dishMap;
}

/**
 * 尽力提取卡路里：拉取 HowToCook markdown，正则"预估卡路里：N"
 * 只处理还没有 calories 的 howtocook 菜谱；失败不阻塞。
 */
async function enrichCalories(recipes) {
  if (process.env.SYNC_SKIP_CALORIES === '1') {
    console.log('[卡路里] SYNC_SKIP_CALORIES=1，跳过');
    return 0;
  }

  const needCalories = recipes.filter(
    (r) => r.source === 'howtocook' && r.calories == null
  );
  if (needCalories.length === 0) {
    console.log('[卡路里] 无需获取');
    return 0;
  }

  console.log(`[卡路里] 尽力提取 ${needCalories.length} 道...`);
  let dishMap;
  try {
    dishMap = await fetchDishPathMap();
    console.log(`[卡路里] README 解析到 ${dishMap.size} 个菜目`);
  } catch (e) {
    console.log(`[卡路里] README 拉取失败，跳过：${e.message}`);
    return 0;
  }

  let enriched = 0;
  let failCount = 0;
  for (let i = 0; i < needCalories.length; i++) {
    const recipe = needCalories[i];
    const base = normalizeName(recipe.name);
    const entry = dishMap.get(recipe.name) || dishMap.get(base);
    if (!entry) continue;

    const mdPath = entry.dirName
      ? `dishes/${entry.category}/${entry.dirName}/${entry.dirName}.md`
      : `dishes/${entry.category}/${entry.file}`;

    try {
      const res = await axios.get(
        `${HOWTOCOOK_RAW_BASE}/${mdPath.split('/').map(encodeURIComponent).join('/')}`,
        axiosConfig()
      );
      const m = String(res.data).match(/预估卡路里[:：]\s*(\d+)/);
      if (m) {
        recipe.calories = parseInt(m[1], 10);
        enriched++;
      }
    } catch (e) {
      failCount++;
    }
    await delay(REQUEST_DELAY_MS);
    if ((i + 1) % 50 === 0) {
      console.log(`[卡路里] 进度 ${i + 1}/${needCalories.length}（成功 ${enriched}）`);
    }
  }
  console.log(`[卡路里] 完成：新增 ${enriched}，失败/未找到 ${failCount}`);
  return enriched;
}

/**
 * 主流程
 */
async function main() {
  console.log('========================================');
  console.log('双源菜谱合并同步');
  console.log('========================================\n');

  const [primary, secondary, imageFileSet] = await Promise.all([
    fetchProjKitchen(),
    fetchCookCsv(),
    listLocalImages(),
  ]);

  console.log(`\n本地图片文件：${imageFileSet.size} 个`);

  const merged = mergeRecipes(primary, secondary);
  const linked = linkImages(merged, imageFileSet);

  const matchedCount = merged.filter(
    (r) => r.source === 'howtocook' && r.bv
  ).length;
  const cookOnly = merged.filter((r) => r.source === 'cook').length;

  await enrichCalories(merged);

  const withSteps = merged.filter((r) => r.steps.length > 0).length;
  const withImage = merged.filter((r) => r.imageUrl).length;
  const withCalories = merged.filter((r) => r.calories != null).length;

  await fs.writeJson(RECIPES_FILE, merged, { spaces: 2 });
  await fs.writeJson(
    LAST_UPDATED_FILE,
    {
      timestamp: new Date().toISOString(),
      count: merged.length,
      sources: ['howtocook', 'cook'],
    },
    { spaces: 2 }
  );

  console.log('\n========================================');
  console.log('合并同步完成');
  console.log(`  菜谱总数:     ${merged.length}`);
  console.log(`  howtocook:    ${merged.length - cookOnly}（含步骤 ${withSteps}）`);
  console.log(`  cook 独有:    ${cookOnly}`);
  console.log(`  bv 匹配:      ${matchedCount}`);
  console.log(`  本地图片关联: ${linked}（目录共 ${imageFileSet.size} 个文件）`);
  console.log(`  有卡路里:     ${withCalories}`);
  console.log(`  已写入:       ${RECIPES_FILE}`);
  console.log('========================================');

  return {
    total: merged.length,
    withSteps,
    withImage,
    withCalories,
    matchedCount,
    cookOnly,
  };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('同步失败:', err.message);
    process.exit(1);
  });
}

module.exports = {
  normalizeName,
  matchLocalImage,
  mergeRecipes,
  main,
};
