const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const LAST_UPDATED_FILE = path.join(DATA_DIR, 'last_updated.json');

// proj.kitchen API
const API_BASE = 'https://proj.kitchen/api/recipes';

// HowToCook GitHub base for images
const GITHUB_RAW_BASE = 'https://github.com/Anduin2017/HowToCook/raw/master/dishes';

// 本地 VPN 代理地址
const PROXY_URL = 'http://127.0.0.1:55219';

/**
 * 通过 PowerShell 下载 GitHub 图片（走代理，处理 LFS 重定向）
 * @returns {Buffer|null}
 */
function downloadViaProxy(url) {
  try {
    const psUrl = url.replace(/'/g, "''");
    const cmd = `(Invoke-WebRequest -Uri '${psUrl}' -UseBasicParsing -TimeoutSec 60 -Proxy '${PROXY_URL}').Content`;
    const result = execSync(`powershell -Command "${cmd}"`, {
      timeout: 90000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    });
    return result.length > 1000 ? result : null;
  } catch (e) {
    return null;
  }
}

// HowToCook dishes目录结构
const DISH_CATEGORIES = [
  'vegetable_dish', 'meat_dish', 'aquatic', 'breakfast',
  'staple', 'semi-finished', 'soup', 'drink', 'condiment', 'dessert'
];

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(IMAGES_DIR);

/**
 * 从proj.kitchen获取所有菜谱列表
 */
async function fetchRecipeList() {
  console.log('正在从 proj.kitchen 获取菜谱列表...');
  const response = await axios.get(API_BASE, { timeout: 15000 });
  console.log(`获取到 ${response.data.length} 个菜谱`);
  return response.data;
}

/**
 * 获取单个菜谱详情
 */
async function fetchRecipeDetail(id) {
  try {
    const response = await axios.get(`${API_BASE}/${encodeURIComponent(id)}`, { timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error(`获取菜谱详情失败 [${id}]:`, error.message);
    return null;
  }
}

/**
 * 尝试从HowToCook GitHub下载菜谱图片
 * 遍历所有分类目录，用菜名匹配文件夹名
 */
async function downloadRecipeImage(recipeName, recipeId) {
  const localPath = path.join(IMAGES_DIR, `${recipeId}.jpg`);
  
  // 如果已下载过，跳过
  if (await fs.pathExists(localPath)) {
    return `/api/local-image/${recipeId}.jpg`;
  }

  // 去掉括号后缀，如 "宫保鸡丁（鸡胸肉版）" -> "宫保鸡丁"
  const baseName = recipeName.replace(/[（(].*?[）)]/, '').trim();

  // 尝试所有可能的分类目录，先用完整名，再用基础名
  const namesToTry = [recipeName];
  if (baseName !== recipeName) namesToTry.push(baseName);

  for (const name of namesToTry) {
    for (const category of DISH_CATEGORIES) {
      const imageUrl = `${GITHUB_RAW_BASE}/${category}/${encodeURIComponent(name)}/${encodeURIComponent(name)}.jpg`;
      
      const data = downloadViaProxy(imageUrl);
      if (data) {
        await fs.writeFile(localPath, data);
        console.log(`  ✓ 图片下载成功: ${recipeName}`);
        return `/api/local-image/${recipeId}.jpg`;
      }
    }
  }

  console.log(`  ✗ 未找到图片: ${recipeName}`);
  return null;
}

/**
 * 将proj.kitchen格式转换为本地格式
 */
function convertRecipe(apiRecipe, imageUrl) {
  // 提取食材名称列表（兼容新旧格式）
  const stuff = apiRecipe.ingredients
    ? apiRecipe.ingredients.map(ing => typeof ing === 'string' ? ing : ing.name)
    : [];

  return {
    id: `howtocook-${apiRecipe.id}`,
    name: apiRecipe.name,
    stuff,
    ingredients: apiRecipe.ingredients || [],
    steps: apiRecipe.steps || [],
    tips: apiRecipe.tips || '',
    difficulty: apiRecipe.difficulty || '中等',
    category: apiRecipe.category || '',
    tools: apiRecipe.tools || [],
    tags: apiRecipe.category ? [apiRecipe.category] : [],
    methods: [],
    source: 'howtocook',
    imageUrl: imageUrl || null
  };
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('HowToCook 菜谱导入工具');
  console.log('========================================\n');

  // 1. 获取菜谱列表
  const list = await fetchRecipeList();

  // 2. 逐个获取详情并下载图片
  const recipes = [];
  let imageCount = 0;
  let failCount = 0;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const progress = `[${i + 1}/${list.length}]`;

    // 获取详情
    const detail = await fetchRecipeDetail(item.id);
    if (!detail) {
      failCount++;
      continue;
    }

    // 下载图片
    const imageUrl = await downloadRecipeImage(detail.name, detail.id);
    if (imageUrl) imageCount++;

    // 转换格式
    const recipe = convertRecipe(detail, imageUrl);
    recipes.push(recipe);

    // 速率控制：每次请求间隔300ms
    if (i < list.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }

    // 每50个输出进度
    if ((i + 1) % 50 === 0) {
      console.log(`\n--- 进度: ${i + 1}/${list.length}, 已下载图片: ${imageCount} ---\n`);
    }
  }

  // 3. 保存数据
  await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });
  await fs.writeJson(LAST_UPDATED_FILE, {
    timestamp: new Date().toISOString(),
    count: recipes.length,
    sources: ['howtocook']
  }, { spaces: 2 });

  console.log('\n========================================');
  console.log(`导入完成！`);
  console.log(`菜谱总数: ${recipes.length}`);
  console.log(`下载图片: ${imageCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`图片目录: ${IMAGES_DIR}`);
  console.log('========================================');
}

/**
 * 通过解析 HowToCook README 获取有目录的菜名（目录意味着有图片）
 * README 中的链接格式: [菜名](dishes/category/菜名/菜名.md) = 有目录
 *                      [菜名](dishes/category/菜名.md) = 无目录
 * 返回 Map: dishName -> { category, path }
 */
async function fetchGitHubDishDirs() {
  const dishMap = new Map();

  try {
    const readmeUrl = 'https://raw.githubusercontent.com/Anduin2017/HowToCook/master/README.md';
    const response = await axios.get(readmeUrl, {
      timeout: 30000,
      headers: { 'User-Agent': 'Amazing-Food-App/1.0' }
    });
    const readme = response.data;

    // 匹配 [菜名](dishes/category/...) 格式的链接
    const linkRegex = /\[([^\]]+)\]\(dishes\/([^/]+)\/([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(readme)) !== null) {
      const dishName = match[1];
      const category = match[2];
      const subPath = match[3];

      // 如果路径包含子目录（如 拔丝土豆/拔丝土豆.md），说明有图片目录
      const parts = subPath.split('/');
      if (parts.length >= 2) {
        const dirName = parts[0];
        dishMap.set(dishName, {
          category,
          path: `dishes/${category}/${dirName}`
        });
      }
    }
  } catch (e) {
    console.error('解析 README 失败:', e.message);
  }

  console.log(`README 中共有 ${dishMap.size} 个有目录的菜谱`);
  return dishMap;
}

/**
 * 为缺失图片的菜谱重新尝试从GitHub下载图片
 * 先通过 GitHub API 获取所有有图片的目录，精确匹配后下载
 */
async function downloadMissingImages() {
  console.log('========================================');
  console.log('补充下载缺失图片');
  console.log('========================================\n');

  if (!await fs.pathExists(RECIPES_FILE)) {
    console.log('未找到菜谱数据文件，请先运行导入');
    return { total: 0, downloaded: 0 };
  }

  const recipes = await fs.readJson(RECIPES_FILE);
  const missingRecipes = recipes.filter(r => !r.imageUrl);

  console.log(`共 ${recipes.length} 道菜谱，${missingRecipes.length} 道缺失图片\n`);

  // 先获取 GitHub 上所有有图片的菜目录
  const dishMap = await fetchGitHubDishDirs();

  let downloaded = 0;
  let matched = 0;

  for (let i = 0; i < missingRecipes.length; i++) {
    const recipe = missingRecipes[i];
    const progress = `[${i + 1}/${missingRecipes.length}]`;

    // 去掉括号后缀
    const baseName = recipe.name.replace(/[（(].*?[）)]/, '').trim();
    const namesToTry = [recipe.name];
    if (baseName !== recipe.name) namesToTry.push(baseName);

    let found = false;
    for (const name of namesToTry) {
      if (dishMap.has(name)) {
        const { category } = dishMap.get(name);
        matched++;
        const rawId = recipe.id.replace('howtocook-', '');
        const localPath = path.join(IMAGES_DIR, `${rawId}.jpg`);

        // 直接尝试下载 {name}.jpg（通过 PowerShell 走代理）
        const imageUrl = `${GITHUB_RAW_BASE}/${category}/${encodeURIComponent(name)}/${encodeURIComponent(name)}.jpg`;

        const data = downloadViaProxy(imageUrl);
        if (data) {
          await fs.writeFile(localPath, data);
          const idx = recipes.findIndex(r => r.id === recipe.id);
          if (idx !== -1) {
            recipes[idx].imageUrl = `/api/local-image/${rawId}.jpg`;
          }
          downloaded++;
          console.log(`${progress} ✓ ${recipe.name} (${category})`);
          found = true;
        } else {
          console.log(`${progress} ✗ ${recipe.name}`);
        }
        // 每次下载间隔3秒，避免 GitHub 限流
        await new Promise(r => setTimeout(r, 3000));
        break;
      }
    }

    if (!found) {
      // GitHub 仓库没有这道菜的图片目录，跳过
    }

    // 每20个保存一次数据
    if ((i + 1) % 20 === 0) {
      await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });
      console.log(`\n--- 进度: ${i + 1}/${missingRecipes.length}, 匹配: ${matched}, 下载: ${downloaded} ---\n`);
    }
  }

  // 最终保存
  await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });

  console.log('\n========================================');
  console.log(`补充下载完成！`);
  console.log(`检查: ${missingRecipes.length}`);
  console.log(`GitHub匹配: ${matched}`);
  console.log(`成功下载: ${downloaded}`);
  console.log(`仍缺失: ${missingRecipes.length - downloaded}`);
  console.log('========================================');

  return { total: missingRecipes.length, downloaded };
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, downloadMissingImages };
