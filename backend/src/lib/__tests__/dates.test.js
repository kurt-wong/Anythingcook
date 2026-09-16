/**
 * dates.js 单元测试 —— 重点覆盖 UTC+8 时区边界（H2/H3 回归）
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { localDateStr, todayStr, getWeekStart, inferMealType, daysAgoStr } = require('../dates');

describe('localDateStr', () => {
  it('返回本地 YYYY-MM-DD', () => {
    const d = new Date(2026, 8, 16); // 2026-09-16 本地
    assert.strictEqual(localDateStr(d), '2026-09-16');
  });

  it('月份/日期补零', () => {
    const d = new Date(2026, 0, 5);
    assert.strictEqual(localDateStr(d), '2026-01-05');
  });

  it('UTC+8 凌晨不回退到昨天（H3 回归）', () => {
    // 本地 2026-09-16 06:30 (UTC+8) = UTC 2026-09-15 22:30
    // 旧代码 toISOString().slice(0,10) 会得到 2026-09-15
    const early = new Date(2026, 8, 16, 6, 30, 0);
    assert.strictEqual(localDateStr(early), '2026-09-16');
  });
});

describe('getWeekStart', () => {
  it('周三返回本周一', () => {
    // 2026-09-16 是周三
    const wed = new Date(2026, 8, 16);
    assert.strictEqual(getWeekStart(wed), '2026-09-14');
  });

  it('周一返回自身', () => {
    const mon = new Date(2026, 8, 14);
    assert.strictEqual(getWeekStart(mon), '2026-09-14');
  });

  it('周日返回上周一（跨周）', () => {
    const sun = new Date(2026, 8, 20); // 2026-09-20 周日
    assert.strictEqual(getWeekStart(sun), '2026-09-14');
  });

  it('UTC+8 凌晨周一不回退到前一周（H2 回归）', () => {
    // 本地 2026-09-14 00:30 周一
    const monEarly = new Date(2026, 8, 14, 0, 30, 0);
    assert.strictEqual(getWeekStart(monEarly), '2026-09-14');
  });
});

describe('inferMealType', () => {
  it('上午推断早餐', () => {
    assert.strictEqual(inferMealType(new Date(2026, 8, 16, 8, 0)), 'breakfast');
  });
  it('中午推断午餐', () => {
    assert.strictEqual(inferMealType(new Date(2026, 8, 16, 11, 0)), 'lunch');
  });
  it('傍晚推断晚餐', () => {
    assert.strictEqual(inferMealType(new Date(2026, 8, 16, 18, 0)), 'dinner');
  });
  it('深夜推断加餐', () => {
    assert.strictEqual(inferMealType(new Date(2026, 8, 16, 22, 0)), 'snack');
  });
});

describe('daysAgoStr', () => {
  it('返回 N 天前的本地日期', () => {
    const from = new Date(2026, 8, 16);
    assert.strictEqual(daysAgoStr(7, from), '2026-09-09');
  });
  it('跨月边界', () => {
    const from = new Date(2026, 9, 2); // 10-02
    assert.strictEqual(daysAgoStr(5, from), '2026-09-27');
  });
});
