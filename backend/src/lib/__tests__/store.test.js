/**
 * store.js 写串行锁测试（M7 回归）
 */
const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `af-store-test-${Date.now()}`);
const testFile = path.join(tmpDir, 'test.json');

const { writeJson, updateJson, readJson } = require('../store');

describe('store write serialization', () => {
  after(async () => {
    await fs.remove(tmpDir);
  });

  it('writeJson 写入并可读回', async () => {
    await fs.ensureDir(tmpDir);
    await writeJson(testFile, { a: 1 });
    const data = await readJson(testFile, {});
    assert.deepStrictEqual(data, { a: 1 });
  });

  it('并发 updateJson 不丢更新（M7）', async () => {
    await fs.ensureDir(tmpDir);
    await writeJson(testFile, []);

    // 10 个并发追加，全部应保留
    const tasks = [];
    for (let i = 0; i < 10; i++) {
      tasks.push(
        updateJson(testFile, [], (arr) => {
          arr.push(i);
          return arr;
        })
      );
    }
    await Promise.all(tasks);

    const data = await readJson(testFile, []);
    assert.strictEqual(data.length, 10);
    assert.deepStrictEqual([...data].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('文件不存在时 readJson 返回 fallback', async () => {
    const missing = path.join(tmpDir, 'missing.json');
    const data = await readJson(missing, { fallback: true });
    assert.deepStrictEqual(data, { fallback: true });
  });
});
