/**
 * match.js 单元测试 —— 食材精确匹配与调味品分池
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const {
  normalizeIngredient,
  isMainIngredient,
  findIngredientMatch,
  scoreRecipe,
  deductibleKeys,
  _resetCache,
} = require('../match');

describe('normalizeIngredient', () => {
  it('去空格', () => {
    assert.strictEqual(normalizeIngredient(' 鸡 蛋 '), '鸡蛋');
  });
  it('去"的用量为"后缀', () => {
    assert.strictEqual(normalizeIngredient('食用油的用量为10ml'), '食用油');
  });
  it('去中文括号注释', () => {
    assert.strictEqual(normalizeIngredient('土豆（每个约120g）'), '土豆');
  });
  it('空值返回空串', () => {
    assert.strictEqual(normalizeIngredient(''), '');
    assert.strictEqual(normalizeIngredient(null), '');
  });
});

describe('isMainIngredient（调味品分池）', () => {
  before(() => _resetCache());

  it('鸡肉是主料', async () => {
    assert.strictEqual(await isMainIngredient('鸡肉'), true);
  });
  it('西红柿是主料', async () => {
    assert.strictEqual(await isMainIngredient('西红柿'), true);
  });
  it('盐不是主料（调味品）', async () => {
    assert.strictEqual(await isMainIngredient('盐'), false);
  });
  it('酱油不是主料', async () => {
    assert.strictEqual(await isMainIngredient('酱油'), false);
  });
  it('食用油不是主料', async () => {
    assert.strictEqual(await isMainIngredient('食用油'), false);
  });
});

describe('findIngredientMatch', () => {
  it('精确匹配', async () => {
    const keys = ['鸡蛋', '西红柿'];
    assert.strictEqual(await findIngredientMatch(keys, '鸡蛋'), '鸡蛋');
  });
  it('归一化匹配', async () => {
    const keys = ['食用油'];
    assert.strictEqual(await findIngredientMatch(keys, '食用油的用量为10ml'), '食用油');
  });
  it('别名匹配（西红柿↔番茄）', async () => {
    const keys = ['番茄'];
    assert.strictEqual(await findIngredientMatch(keys, '西红柿'), '番茄');
  });
  it('盐不匹配盐酥鸡（回归测试）', async () => {
    const keys = ['盐'];
    assert.strictEqual(await findIngredientMatch(keys, '盐酥鸡'), null);
  });
  it('盐酥鸡不匹配盐（回归测试）', async () => {
    const keys = ['盐酥鸡'];
    assert.strictEqual(await findIngredientMatch(keys, '盐'), null);
  });
  it('椒盐不匹配盐', async () => {
    const keys = ['盐'];
    assert.strictEqual(await findIngredientMatch(keys, '椒盐'), null);
  });
  it('找不到返回 null', async () => {
    const keys = ['鸡蛋'];
    assert.strictEqual(await findIngredientMatch(keys, '牛肉'), null);
  });
});

describe('scoreRecipe（只算主料）', () => {
  before(() => _resetCache());

  it('调味品不参与评分', async () => {
    const result = await scoreRecipe(['鸡肉', '盐', '酱油'], ['鸡肉']);
    assert.strictEqual(result.score, 1);
    assert.deepStrictEqual(result.matched, ['鸡肉']);
  });

  it('部分主料匹配', async () => {
    const result = await scoreRecipe(['鸡肉', '西红柿'], ['鸡肉']);
    assert.strictEqual(result.score, 0.5);
  });

  it('纯调味品菜谱视为可做', async () => {
    const result = await scoreRecipe(['盐', '糖'], []);
    assert.strictEqual(result.score, 1);
  });

  it('无主料匹配返回 0', async () => {
    const result = await scoreRecipe(['牛肉', '土豆'], ['鸡肉']);
    assert.strictEqual(result.score, 0);
  });
});

describe('deductibleKeys（只扣主料）', () => {
  before(() => _resetCache());

  it('调味品不扣', async () => {
    const ingredients = {
      '鸡肉': { count: 3 },
      '盐': { count: 10 },
    };
    const keys = await deductibleKeys(['鸡肉', '盐'], ingredients);
    assert.deepStrictEqual(keys, ['鸡肉']);
  });

  it('库存为 0 的不扣', async () => {
    const ingredients = {
      '鸡肉': { count: 0 },
      '西红柿': { count: 2 },
    };
    const keys = await deductibleKeys(['鸡肉', '西红柿'], ingredients);
    assert.deepStrictEqual(keys, ['西红柿']);
  });

  it('别名匹配后扣正确键', async () => {
    const ingredients = {
      '番茄': { count: 5 },
    };
    const keys = await deductibleKeys(['西红柿'], ingredients);
    assert.deepStrictEqual(keys, ['番茄']);
  });
});
