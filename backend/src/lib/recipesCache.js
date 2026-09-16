/**
 * recipes.json 内存缓存 + mtime 失效。
 * 菜谱一天才变一次，没必要每次请求都读 1MB 文件并 JSON.parse。
 */
const fs = require('fs-extra');
const { FILES } = require('./store');

let cache = null;
let cacheMtime = 0;

async function loadRecipes() {
  try {
    const stat = await fs.stat(FILES.recipes);
    if (cache && stat.mtimeMs === cacheMtime) return cache;
    cache = await fs.readJson(FILES.recipes);
    cacheMtime = stat.mtimeMs;
    return cache;
  } catch (error) {
    console.error('读取菜谱数据失败:', error.message);
    return cache || [];
  }
}

/** 测试用：强制失效 */
function _invalidate() {
  cache = null;
  cacheMtime = 0;
}

module.exports = { loadRecipes, _invalidate };
