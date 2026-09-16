/**
 * 订单校验单元测试（H4 回归）
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateOrderBody } = require('../../routes/orders');

const validItem = { recipeId: 'r1', name: '番茄炒蛋', quantity: 1 };

describe('validateOrderBody', () => {
  it('接受合法订单', () => {
    const r = validateOrderBody({ guestName: '大小姐', items: [validItem] });
    assert.strictEqual(r.error, undefined);
    assert.strictEqual(r.guestName, '大小姐');
    assert.strictEqual(r.items.length, 1);
    assert.strictEqual(r.items[0].quantity, 1);
  });

  it('guestName 自动 trim', () => {
    const r = validateOrderBody({ guestName: '  大小姐  ', items: [validItem] });
    assert.strictEqual(r.guestName, '大小姐');
  });

  it('拒绝空 guestName', () => {
    const r = validateOrderBody({ guestName: '   ', items: [validItem] });
    assert.ok(r.error);
  });

  it('拒绝超长 guestName', () => {
    const r = validateOrderBody({ guestName: 'a'.repeat(21), items: [validItem] });
    assert.ok(r.error);
  });

  it('拒绝空 items', () => {
    const r = validateOrderBody({ guestName: 'x', items: [] });
    assert.ok(r.error);
  });

  it('拒绝负数 quantity（H4：曾会反向加库存）', () => {
    const r = validateOrderBody({
      guestName: 'x',
      items: [{ ...validItem, quantity: -5 }],
    });
    assert.ok(r.error);
    assert.match(r.error, /数量/);
  });

  it('拒绝 0 quantity', () => {
    const r = validateOrderBody({
      guestName: 'x',
      items: [{ ...validItem, quantity: 0 }],
    });
    assert.ok(r.error);
  });

  it('拒绝小数 quantity', () => {
    const r = validateOrderBody({
      guestName: 'x',
      items: [{ ...validItem, quantity: 1.5 }],
    });
    assert.ok(r.error);
  });

  it('拒绝字符串 quantity', () => {
    const r = validateOrderBody({
      guestName: 'x',
      items: [{ ...validItem, quantity: '2' }],
    });
    assert.ok(r.error);
  });

  it('拒绝超大 quantity', () => {
    const r = validateOrderBody({
      guestName: 'x',
      items: [{ ...validItem, quantity: 100 }],
    });
    assert.ok(r.error);
  });

  it('拒绝缺少 recipeId 的条目', () => {
    const r = validateOrderBody({
      guestName: 'x',
      items: [{ name: '菜', quantity: 1 }],
    });
    assert.ok(r.error);
  });

  it('拒绝超过 50 道菜', () => {
    const items = Array.from({ length: 51 }, () => ({ ...validItem }));
    const r = validateOrderBody({ guestName: 'x', items });
    assert.ok(r.error);
  });
});
