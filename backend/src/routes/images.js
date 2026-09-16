/** 图片代理路由：/api/image */
const express = require('express');
const { FILES, readJson } = require('../lib/store');
const { asyncHandler } = require('../lib/respond');
const { loadImageCache } = require('../lib/imageCache');

const router = express.Router();

/**
 * 获取菜谱图片（优先本地图片，再 Unsplash 缓存，最后占位图）
 * query: name=菜名
 */
router.get('/image', asyncHandler(async (req, res) => {
  const { name } = req.query;
  if (!name || typeof name !== 'string') {
    return res.redirect('https://placehold.co/400x300/f5f5f7/1d1d1f?text=Food');
  }

  // Express 已解码 query；仅当仍含 % 时才尝试再解码，并吞掉 URIError
  let decodedName = name;
  try {
    if (name.includes('%')) decodedName = decodeURIComponent(name);
  } catch (_) {
    decodedName = name;
  }

  // 1. 优先从菜谱数据中查找本地图片
  const recipes = await readJson(FILES.recipes, []);
  const recipe = recipes.find(r => r.name === decodedName);
  if (recipe && recipe.imageUrl) {
    return res.redirect(recipe.imageUrl);
  }

  // 2. 从 Unsplash 缓存中查找
  const cache = await loadImageCache();
  if (cache[decodedName] && cache[decodedName] !== null) {
    return res.redirect(cache[decodedName]);
  }

  // 3. 占位图
  const placeholder = `https://placehold.co/400x300/f5f5f7/1d1d1f?text=${encodeURIComponent(decodedName.slice(0, 4))}`;
  return res.redirect(placeholder);
}));

module.exports = router;
