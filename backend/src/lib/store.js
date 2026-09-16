/**
 * 统一 JSON 数据读写 + 写串行锁（M7）。
 *
 * 锁按文件路径粒度：同文件的写操作排队执行，避免并发 read-modify-write 丢更新。
 */
const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

const FILES = {
  recipes: path.join(DATA_DIR, 'recipes.json'),
  lastUpdated: path.join(DATA_DIR, 'last_updated.json'),
  ingredients: path.join(DATA_DIR, 'ingredients.json'),
  ingredientCategoryMap: path.join(DATA_DIR, 'ingredientCategoryMap.json'),
  imageCache: path.join(DATA_DIR, 'image-cache.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  mealPlan: path.join(DATA_DIR, 'mealPlan.json'),
  dietLog: path.join(DATA_DIR, 'dietLog.json'),
  tipsIndex: path.join(DATA_DIR, 'tips/index.json'),
};

const DIRS = {
  images: path.join(DATA_DIR, 'images'),
  tips: path.join(DATA_DIR, 'tips'),
};

/** 各文件的写队列（Promise 链） */
const writeQueues = new Map();

/** 读 JSON，文件不存在或损坏时返回 fallback */
async function readJson(file, fallback) {
  try {
    if (await fs.pathExists(file)) {
      return await fs.readJson(file);
    }
  } catch (error) {
    console.error(`读取 ${path.basename(file)} 失败:`, error.message);
  }
  return fallback;
}

/** 写 JSON（串行化）。同文件的写按调用顺序排队。 */
async function writeJson(file, data) {
  const prev = writeQueues.get(file) || Promise.resolve();
  const next = prev
    .catch(() => {}) // 前序失败不阻塞后续
    .then(() => fs.writeJson(file, data, { spaces: 2 }));
  writeQueues.set(file, next);
  return next;
}

/**
 * 排队执行 read-modify-write，避免并发丢更新。
 * mutator 接收当前值，可原地修改并/或返回新值（返回 undefined 则写回入参对象）。
 */
async function updateJson(file, fallback, mutator) {
  const prev = writeQueues.get(file) || Promise.resolve();
  let result;
  const next = prev
    .catch(() => {})
    .then(async () => {
      const current = await readJson(file, fallback);
      result = await mutator(current);
      await fs.writeJson(file, result === undefined ? current : result, { spaces: 2 });
    });
  writeQueues.set(file, next);
  await next;
  return result;
}

module.exports = { DATA_DIR, FILES, DIRS, readJson, writeJson, updateJson };
