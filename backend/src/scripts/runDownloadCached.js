/**
 * 独立脚本：从 Unsplash 搜索缺失图片并下载到本地
 */
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');
const IMAGE_CACHE_FILE = path.join(DATA_DIR, 'image-cache.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// Unsplash API Key
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'LrzVHnpUY2HeiThWhnXAKOApwU4nC17TOoW3xM-NPbs';

fs.ensureDirSync(IMAGES_DIR);

async function loadRecipes() {
  if (await fs.pathExists(RECIPES_FILE)) return await fs.readJson(RECIPES_FILE);
  return [];
}

async function loadImageCache() {
  if (await fs.pathExists(IMAGE_CACHE_FILE)) return await fs.readJson(IMAGE_CACHE_FILE);
  return {};
}

async function saveImageCache(cache) {
  await fs.writeJson(IMAGE_CACHE_FILE, cache, { spaces: 2 });
}

async function main() {
  console.log('========================================');
  console.log('从 Unsplash 搜索并下载菜谱图片到本地');
  console.log('========================================\n');

  const recipes = await loadRecipes();
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let notFound = 0;

  const noLocalImage = recipes.filter(r => !r.imageUrl || !r.imageUrl.startsWith('/api/local-image/'));
  console.log(`菜谱总数: ${recipes.length}`);
  console.log(`已有本地图片: ${recipes.length - noLocalImage.length}`);
  console.log(`需要搜索图片: ${noLocalImage.length}\n`);

  if (!UNSPLASH_ACCESS_KEY) {
    console.error('未配置 UNSPLASH_ACCESS_KEY，无法搜索图片');
    return;
  }

  const cache = await loadImageCache();

  for (let i = 0; i < noLocalImage.length; i++) {
    const recipe = noLocalImage[i];
    const progress = `[${i + 1}/${noLocalImage.length}]`;
    const rawId = recipe.id.replace('howtocook-', '');
    const localPath = path.join(IMAGES_DIR, `${rawId}.jpg`);
    const localUrl = `/api/local-image/${rawId}.jpg`;

    // 已有本地文件，只更新 recipes.json
    if (await fs.pathExists(localPath)) {
      const idx = recipes.findIndex(r => r.id === recipe.id);
      if (idx !== -1) recipes[idx].imageUrl = localUrl;
      skipped++;
      continue;
    }

    // 先查缓存
    let unsplashUrl = cache[recipe.name];

    if (!unsplashUrl) {
      // 搜索 Unsplash
      try {
        const query = encodeURIComponent(`${recipe.name} 中餐美食`);
        const response = await axios.get(
          `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
          {
            headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
            timeout: 15000
          }
        );

        if (response.data.results && response.data.results.length > 0) {
          unsplashUrl = response.data.results[0].urls.small;
          cache[recipe.name] = unsplashUrl;
          await saveImageCache(cache);
        } else {
          cache[recipe.name] = null;
          await saveImageCache(cache);
          notFound++;
          console.log(`${progress} 未找到: ${recipe.name}`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      } catch (error) {
        if (error.response && error.response.status === 429) {
          console.log('\nUnsplash API 速率限制（429），停止搜索');
          console.log(`已完成: ${downloaded} 张下载, ${notFound} 张未找到`);
          break;
        }
        failed++;
        console.error(`${progress} 搜索失败 [${recipe.name}]: ${error.message}`);
        continue;
      }

      // API 搜索间隔 1.5 秒
      await new Promise(r => setTimeout(r, 1500));
    }

    // 下载图片到本地
    try {
      const imgResponse = await axios.get(unsplashUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      if (imgResponse.data && imgResponse.data.length > 1000) {
        await fs.writeFile(localPath, Buffer.from(imgResponse.data));
        const idx = recipes.findIndex(r => r.id === recipe.id);
        if (idx !== -1) recipes[idx].imageUrl = localUrl;
        downloaded++;
        console.log(`${progress} ✓ ${recipe.name} (${(imgResponse.data.length / 1024).toFixed(0)}KB)`);
      } else {
        failed++;
        console.log(`${progress} ✗ ${recipe.name} (文件过小)`);
      }
    } catch (error) {
      failed++;
      console.error(`${progress} ✗ 下载失败 [${recipe.name}]: ${error.message}`);
    }

    // 下载间隔 0.5 秒
    await new Promise(r => setTimeout(r, 500));

    // 每 10 张保存一次
    if (downloaded % 10 === 0 && downloaded > 0) {
      await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });
      console.log(`\n--- 进度: 已下载 ${downloaded} 张，已保存 ---\n`);
    }
  }

  // 最终保存
  await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });

  const totalWithImage = recipes.filter(r => r.imageUrl && r.imageUrl.startsWith('/api/local-image/')).length;
  console.log('\n========================================');
  console.log(`完成！`);
  console.log(`新下载: ${downloaded}`);
  console.log(`跳过(已有): ${skipped}`);
  console.log(`未找到: ${notFound}`);
  console.log(`失败: ${failed}`);
  console.log(`本地图片总数: ${totalWithImage}`);
  console.log(`图片目录: ${IMAGES_DIR}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
