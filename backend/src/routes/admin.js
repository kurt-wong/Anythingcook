/** 维护类路由（同步/导入/图片批处理）。配置 ADMIN_TOKEN 后需要令牌（M6）。 */
const express = require('express');
const { ok, fail, asyncHandler, guardAdmin } = require('../lib/respond');
const { cacheRecipeImages, downloadCachedImagesToLocal } = require('../lib/imageCache');

const router = express.Router();

// 维护写操作先过令牌关（status 只读，在下方单独挂载前不受影响——用两条子路由）
const writeRouter = express.Router();
writeRouter.use(guardAdmin);

// 懒加载同步脚本（避免启动即拉起）
let syncRecipesMain = null;
let howToCook = null;
function getSyncRecipes() {
  if (!syncRecipesMain) {
    syncRecipesMain = require('../scripts/syncRecipes').main;
  }
  return syncRecipesMain;
}
function getHowToCook() {
  if (!howToCook) {
    howToCook = require('../scripts/importFromHowToCook');
  }
  return howToCook;
}

/** 防止并发触发多个长任务 */
let taskRunning = false;
function runOnce(res, label, fn) {
  if (taskRunning) {
    return fail(res, 409, '已有维护任务正在执行，请稍后再试');
  }
  taskRunning = true;
  fn()
    .catch(err => console.error(`${label}失败:`, err.message))
    .finally(() => { taskRunning = false; });
  return ok(res, { message: `${label}已开始，请查看服务器日志了解进度` });
}

/**
 * 手动触发数据更新（同步为长任务，先返回再执行）
 */
writeRouter.post('/update', asyncHandler(async (req, res) => {
  return runOnce(res, '数据更新', async () => {
    console.log('手动触发数据更新...');
    await getSyncRecipes()();
    console.log('数据更新完成');
  });
}));

/**
 * 从 HowToCook 导入菜谱（含图片下载）
 */
writeRouter.post('/import-howtocook', asyncHandler(async (req, res) => {
  return runOnce(res, '导入', async () => {
    console.log('开始从 HowToCook 导入菜谱...');
    await getHowToCook().importHowToCook();
  });
}));

/**
 * 手动触发补充下载缺失图片
 */
writeRouter.post('/download-missing-images', asyncHandler(async (req, res) => {
  return runOnce(res, '补充下载', async () => {
    await getHowToCook().downloadMissingImages();
  });
}));

/**
 * 手动触发图片批量缓存（Unsplash 搜索并下载到本地）
 */
writeRouter.post('/images/cache', asyncHandler(async (req, res) => {
  return runOnce(res, '图片缓存', cacheRecipeImages);
}));

/**
 * 将已缓存的 Unsplash 图片下载到本地
 */
writeRouter.post('/images/download-cached', asyncHandler(async (req, res) => {
  return runOnce(res, '已缓存图片下载', downloadCachedImagesToLocal);
}));

/**
 * 获取系统状态（只读，无需令牌）
 */
router.get('/status', asyncHandler(async (req, res) => {
  const { readJson, FILES } = require('../lib/store');
  const recipes = await readJson(FILES.recipes, []);
  const lastUpdated = await readJson(FILES.lastUpdated, null);
  return ok(res, {
    data: {
      recipeCount: recipes.length,
      lastUpdated: lastUpdated?.timestamp || '从未更新',
      sources: lastUpdated?.sources || [],
      serverTime: new Date().toISOString(),
    },
  });
}));

router.use(writeRouter);

module.exports = router;
