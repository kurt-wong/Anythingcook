/**
 * Unsplash 图片缓存/下载（自 index.js 抽出，修复 M4：循环内反复全量读写缓存文件）。
 */
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { FILES, DIRS, readJson, writeJson } = require('./store');

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';

async function loadImageCache() {
  return readJson(FILES.imageCache, {});
}

async function saveImageCache(cache) {
  await writeJson(FILES.imageCache, cache);
}

async function loadRecipes() {
  return readJson(FILES.recipes, []);
}

async function saveRecipes(recipes) {
  await writeJson(FILES.recipes, recipes);
}

/**
 * 批量缓存菜谱图片（从 Unsplash 搜索并下载到本地）。
 * 缓存对象只在循环开始读一次、过程中改内存、每 10 张与结束时落盘。
 */
async function cacheRecipeImages() {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('未配置 UNSPLASH_ACCESS_KEY，跳过图片缓存');
    return 0;
  }

  const recipes = await loadRecipes();
  const cache = await loadImageCache(); // M4：提到循环外
  let cacheDirty = false;
  let newCount = 0;
  let sinceLastSave = 0;

  const needsImage = recipes.filter(r => !r.imageUrl || !r.imageUrl.startsWith('/api/local-image/'));
  console.log(`共 ${recipes.length} 道菜谱，${needsImage.length} 道需要图片\n`);

  const flush = async () => {
    if (cacheDirty) {
      await saveImageCache(cache);
      cacheDirty = false;
    }
    await saveRecipes(recipes);
  };

  for (let i = 0; i < needsImage.length; i++) {
    const recipe = needsImage[i];
    const progress = `[${i + 1}/${needsImage.length}]`;
    let unsplashUrl = cache[recipe.name];

    if (!unsplashUrl) {
      try {
        const query = encodeURIComponent(`${recipe.name} 中餐美食`);
        const response = await axios.get(
          `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
          { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
        );

        if (response.data.results && response.data.results.length > 0) {
          unsplashUrl = response.data.results[0].urls.small;
          cache[recipe.name] = unsplashUrl;
          cacheDirty = true;
        } else {
          cache[recipe.name] = null;
          cacheDirty = true;
          console.log(`${progress} 未找到图片: ${recipe.name}`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      } catch (error) {
        if (error.response && error.response.status === 429) {
          console.log('Unsplash API 速率限制，停止缓存');
          break;
        }
        console.error(`${progress} 搜索失败 [${recipe.name}]:`, error.message);
        continue;
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!unsplashUrl) continue;

    try {
      const rawId = recipe.id.replace('howtocook-', '');
      const localPath = path.join(DIRS.images, `${rawId}.jpg`);
      const localUrl = `/api/local-image/${rawId}.jpg`;

      if (await fs.pathExists(localPath)) {
        const idx = recipes.findIndex(r => r.id === recipe.id);
        if (idx !== -1 && !recipes[idx].imageUrl?.startsWith('/api/local-image/')) {
          recipes[idx].imageUrl = localUrl;
        }
        continue;
      }

      const imgResponse = await axios.get(unsplashUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      if (imgResponse.data && imgResponse.data.length > 1000) {
        await fs.writeFile(localPath, Buffer.from(imgResponse.data));
        const idx = recipes.findIndex(r => r.id === recipe.id);
        if (idx !== -1) recipes[idx].imageUrl = localUrl;
        newCount++;
        console.log(`${progress} ✓ 已下载: ${recipe.name}`);
      } else {
        console.log(`${progress} ✗ 下载失败（文件过小）: ${recipe.name}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(`${progress} 下载失败 [${recipe.name}]:`, error.message);
    }

    sinceLastSave++;
    if (sinceLastSave >= 10) {
      await flush();
      sinceLastSave = 0;
      console.log(`\n--- 已保存 ${newCount} 张图片 ---\n`);
    }
  }

  await flush();
  console.log(`图片缓存完成，新增 ${newCount} 张本地图片`);
  return newCount;
}

/** 将已有的 Unsplash 缓存 URL 下载到本地 */
async function downloadCachedImagesToLocal() {
  console.log('========================================');
  console.log('将 Unsplash 缓存图片下载到本地');
  console.log('========================================\n');

  const recipes = await loadRecipes();
  const cache = await loadImageCache();
  let downloaded = 0;
  let sinceLastSave = 0;

  const needsDownload = recipes.filter(r => {
    if (r.imageUrl && r.imageUrl.startsWith('/api/local-image/')) return false;
    return cache[r.name] && cache[r.name] !== null;
  });

  console.log(
    `共 ${Object.keys(cache).filter(k => cache[k]).length} 条缓存，${needsDownload.length} 道需要下载\n`
  );

  for (let i = 0; i < needsDownload.length; i++) {
    const recipe = needsDownload[i];
    const progress = `[${i + 1}/${needsDownload.length}]`;
    const unsplashUrl = cache[recipe.name];

    try {
      const rawId = recipe.id.replace('howtocook-', '');
      const localPath = path.join(DIRS.images, `${rawId}.jpg`);
      const localUrl = `/api/local-image/${rawId}.jpg`;

      if (await fs.pathExists(localPath)) {
        const idx = recipes.findIndex(r => r.id === recipe.id);
        if (idx !== -1) recipes[idx].imageUrl = localUrl;
        continue;
      }

      const imgResponse = await axios.get(unsplashUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      if (imgResponse.data && imgResponse.data.length > 1000) {
        await fs.writeFile(localPath, Buffer.from(imgResponse.data));
        const idx = recipes.findIndex(r => r.id === recipe.id);
        if (idx !== -1) recipes[idx].imageUrl = localUrl;
        downloaded++;
        console.log(`${progress} ✓ ${recipe.name}`);
      } else {
        console.log(`${progress} ✗ ${recipe.name} (文件过小)`);
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`${progress} ✗ ${recipe.name}: ${error.message}`);
    }

    sinceLastSave++;
    if (sinceLastSave >= 10) {
      await saveRecipes(recipes);
      sinceLastSave = 0;
      console.log(`\n--- 已保存 ${downloaded} 张 ---\n`);
    }
  }

  await saveRecipes(recipes);
  console.log('\n========================================');
  console.log(`下载完成！新增本地图片: ${downloaded}`);
  console.log('========================================');
  return downloaded;
}

module.exports = { cacheRecipeImages, downloadCachedImagesToLocal, loadImageCache };
