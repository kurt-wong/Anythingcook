/**
 * 从 howtocook.aiursoft.com 网站抓取菜谱图片
 * 
 * 原理：遍历网站的菜谱详情页，提取图片URL，匹配本地菜谱后下载
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

const SITE_BASE = 'https://howtocook.aiursoft.com';

/**
 * 从菜谱详情页提取菜名和图片URL
 */
async function fetchRecipeInfo(recipeId) {
  try {
    const response = await axios.get(`${SITE_BASE}/Recipes/Detail/${recipeId}`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    });

    const html = response.data;

    // 提取菜名（从 <h1> 标签获取，中文不会被编码）
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    const name = h1Match ? h1Match[1].trim() : null;

    // 提取图片URL
    const imgMatch = html.match(/src="(\/download\/recipe-images\/[^"]+)"/);
    const imageUrl = imgMatch ? `${SITE_BASE}${imgMatch[1]}` : null;

    return { id: recipeId, name, imageUrl };
  } catch (e) {
    return { id: recipeId, name: null, imageUrl: null };
  }
}

/**
 * 下载图片到本地
 */
async function downloadImage(url, localPath) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (response.status === 200 && response.data.length > 1000) {
      await fs.writeFile(localPath, response.data);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('从 howtocook.aiursoft.com 同步菜谱图片');
  console.log('========================================\n');

  if (!await fs.pathExists(RECIPES_FILE)) {
    console.log('未找到 recipes.json，请先运行导入');
    return;
  }

  const recipes = await fs.readJson(RECIPES_FILE);
  const missingRecipes = recipes.filter(r => !r.imageUrl);

  console.log(`共 ${recipes.length} 道菜谱，${missingRecipes.length} 道缺失图片\n`);

  await fs.ensureDir(IMAGES_DIR);

  // 第一步：遍历网站获取所有菜谱的图片URL
  console.log('第一步：获取网站菜谱信息...');
  const websiteRecipes = [];
  const maxId = 400; // 网站有约369道菜

  // 并发获取，每次10个
  const concurrency = 5;
  for (let i = 1; i <= maxId; i += concurrency) {
    const batch = [];
    for (let j = i; j < i + concurrency && j <= maxId; j++) {
      batch.push(fetchRecipeInfo(j));
    }
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.name && r.imageUrl) {
        websiteRecipes.push(r);
      }
    }
    if (i % 50 === 1) {
      console.log(`  已扫描 ${Math.min(i + concurrency - 1, maxId)}/${maxId}，找到 ${websiteRecipes.length} 个有图片的菜谱`);
    }
    // 小延迟避免被限流
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n网站共有 ${websiteRecipes.length} 个有图片的菜谱\n`);

  // 第二步：匹配本地菜谱并下载图片
  console.log('第二步：匹配并下载图片...');
  let downloaded = 0;
  let matched = 0;

  for (let i = 0; i < missingRecipes.length; i++) {
    const recipe = missingRecipes[i];
    const progress = `[${i + 1}/${missingRecipes.length}]`;

    // 去掉括号后缀匹配
    const baseName = recipe.name.replace(/[（(].*?[）)]/, '').trim();
    const namesToTry = [recipe.name];
    if (baseName !== recipe.name) namesToTry.push(baseName);

    // 在网站菜谱中查找匹配
    const webRecipe = websiteRecipes.find(w =>
      namesToTry.some(n => w.name === n || w.name.includes(n) || n.includes(w.name))
    );

    if (webRecipe) {
      matched++;
      const rawId = recipe.id.replace('howtocook-', '');
      const localPath = path.join(IMAGES_DIR, `${rawId}.jpg`);

      const success = await downloadImage(webRecipe.imageUrl, localPath);
      if (success) {
        const idx = recipes.findIndex(r => r.id === recipe.id);
        if (idx !== -1) {
          recipes[idx].imageUrl = `/api/local-image/${rawId}.jpg`;
        }
        downloaded++;
        console.log(`${progress} ✓ ${recipe.name}`);
      } else {
        console.log(`${progress} ✗ ${recipe.name} - 下载失败`);
      }
    }

    // 每10个保存一次
    if ((i + 1) % 10 === 0) {
      await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });
      console.log(`  --- 进度: ${i + 1}/${missingRecipes.length}, 匹配: ${matched}, 下载: ${downloaded} ---`);
    }
  }

  // 最终保存
  await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });

  console.log('\n========================================');
  console.log('图片同步完成！');
  console.log(`检查: ${missingRecipes.length}`);
  console.log(`网站匹配: ${matched}`);
  console.log(`成功下载: ${downloaded}`);
  console.log(`仍缺失: ${missingRecipes.length - downloaded}`);
  console.log('========================================');

  return { total: missingRecipes.length, downloaded };
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
