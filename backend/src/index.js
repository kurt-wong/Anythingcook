/**
 * Amazing Food 后端入口 —— 双端口。
 * 7777：食客点菜端（API + guest.html）
 * 9999：饲养员管理端（API + cook.html）
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const cron = require('node-cron');

const { DIRS, FILES, readJson } = require('./lib/store');
const { errorHandler } = require('./lib/respond');
const { cacheRecipeImages, downloadCachedImagesToLocal } = require('./lib/imageCache');

const GUEST_PORT = process.env.PORT || 7777;
const COOK_PORT = process.env.COOK_PORT || 9999;

function createApp(entryHtml) {
  const app = express();

  app.use(cors());
  app.use(compression());
  app.use(express.json());

  // 本地菜谱图片服务
  app.use('/api/local-image', express.static(DIRS.images));

  // API 路由
  app.use('/api', require('./routes/recipes'));
  app.use('/api', require('./routes/ingredients'));
  app.use('/api', require('./routes/orders'));
  app.use('/api', require('./routes/mealPlan'));
  app.use('/api', require('./routes/dietLog'));
  app.use('/api', require('./routes/tips'));
  app.use('/api', require('./routes/stats'));
  app.use('/api', require('./routes/admin'));
  app.use('/api', require('./routes/images'));

  app.use(errorHandler);

  // 静态资源（JS/CSS/图片），但不自动找 index.html
  app.use(express.static(path.join(__dirname, '../../frontend/dist'), { index: false }));

  // 所有非 API 请求回退到对应入口 HTML
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist', entryHtml));
  });

  return app;
}

// 食客端：7777
const guestApp = createApp('guest.html');
// 饲养员端：9999
const cookApp = createApp('cook.html');

// ===== 定时任务 =====

cron.schedule('0 2 * * *', async () => {
  console.log('执行定时数据同步...');
  try {
    const { main: syncRecipes } = require('./scripts/syncRecipes');
    await syncRecipes();
    console.log('定时同步完成');
  } catch (error) {
    console.error('定时同步失败:', error.message);
  }
});

cron.schedule('0 * * * *', async () => {
  if (!process.env.UNSPLASH_ACCESS_KEY) return;
  console.log('执行定时图片缓存（下载到本地）...');
  try {
    const cachedCount = await downloadCachedImagesToLocal();
    const newCount = await cacheRecipeImages();
    console.log(`定时图片缓存完成：缓存下载 ${cachedCount} 张，新增搜索 ${newCount} 张`);
  } catch (error) {
    console.error('定时图片缓存失败:', error.message);
  }
});

// 启动双端口
if (require.main === module) {
  guestApp.listen(GUEST_PORT, '0.0.0.0', () => {
    console.log(`食客点菜端: http://0.0.0.0:${GUEST_PORT}`);
  });
  cookApp.listen(COOK_PORT, '0.0.0.0', () => {
    console.log(`饲养员管理端: http://0.0.0.0:${COOK_PORT}`);
  });

  // 首次启动检查数据
  (async () => {
    try {
      const recipes = await readJson(FILES.recipes, []);
      if (recipes.length === 0) {
        console.log('首次启动，正在同步菜谱数据...');
        const { main: syncRecipes } = require('./scripts/syncRecipes');
        await syncRecipes();
      }
    } catch (error) {
      console.error('启动时数据检查失败:', error.message);
    }
  })();
}

module.exports = { guestApp, cookApp };
