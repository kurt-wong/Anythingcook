/**
 * Amazing Food 后端入口 —— 仅负责装配。
 * 业务逻辑在 routes/，通用设施在 lib/。
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { DIRS, FILES, readJson } = require('./lib/store');
const { errorHandler } = require('./lib/respond');
const { cacheRecipeImages, downloadCachedImagesToLocal } = require('./lib/imageCache');

const app = express();
const PORT = process.env.PORT || 7777;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务（前端构建文件）
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

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

// 统一错误处理（async 路由异常 -> 500）
app.use(errorHandler);

// 前端路由回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// ===== 定时任务 =====

// 每天凌晨 2 点双源合并同步数据
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

// 每小时自动缓存菜谱图片（配置了 Unsplash Key 才启用）
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

// 启动服务器
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Amazing Food 服务器运行在 http://0.0.0.0:${PORT}`);
    console.log(`局域网访问地址: http://[你的IP地址]:${PORT}`);

    try {
      const recipes = await readJson(FILES.recipes, []);
      if (recipes.length === 0) {
        console.log('首次启动，正在同步菜谱数据...');
        const { main: syncRecipes } = require('./scripts/syncRecipes');
        await syncRecipes();
      }
    } catch (error) {
      // L5：首次同步失败不崩溃
      console.error('启动时数据检查失败:', error.message);
    }
  });
}

module.exports = app;
