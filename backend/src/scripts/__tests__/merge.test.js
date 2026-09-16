const { test } = require('node:test');
const assert = require('node:assert');
const {
  normalizeName,
  matchLocalImage,
  mergeRecipes,
} = require('../syncRecipes');

test('normalizeName 去掉中文括号后缀', () => {
  assert.strictEqual(normalizeName('宫保鸡丁（鸡胸肉版）'), '宫保鸡丁');
  assert.strictEqual(normalizeName('红烧肉'), '红烧肉');
});

test('normalizeName 去掉英文括号后缀与空格', () => {
  assert.strictEqual(normalizeName('Mojito (经典)'), 'Mojito');
  assert.strictEqual(normalizeName(' 糖醋 排骨 '), '糖醋排骨');
});

test('normalizeName 空值安全', () => {
  assert.strictEqual(normalizeName(''), '');
  assert.strictEqual(normalizeName(null), '');
  assert.strictEqual(normalizeName(undefined), '');
});

test('matchLocalImage 优先原始名命中', () => {
  const files = new Set(['宫保鸡丁.jpg', 'gongbaojiding.jpg']);
  assert.strictEqual(
    matchLocalImage('宫保鸡丁', 'gongbaojiding', files),
    '宫保鸡丁.jpg'
  );
});

test('matchLocalImage 原始名无图时回退归一化名', () => {
  const files = new Set(['宫保鸡丁.jpg']);
  assert.strictEqual(
    matchLocalImage('宫保鸡丁（鸡胸肉版）', 'gongbaojiding', files),
    '宫保鸡丁.jpg'
  );
});

test('matchLocalImage 回退拼音 id', () => {
  const files = new Set(['gongbaojiding.jpg']);
  assert.strictEqual(
    matchLocalImage('宫保鸡丁', 'gongbaojiding', files),
    'gongbaojiding.jpg'
  );
});

test('matchLocalImage 无命中返回 null', () => {
  const files = new Set(['别的菜.jpg']);
  assert.strictEqual(matchLocalImage('宫保鸡丁', 'gongbaojiding', files), null);
});

test('mergeRecipes 命中时附加 bv 与 tags', () => {
  const primary = [
    {
      id: 'howtocook-gongbaojiding',
      name: '宫保鸡丁（鸡胸肉版）',
      stuff: ['鸡胸肉'],
      ingredients: [{ name: '鸡胸肉', amount: '300g' }],
      steps: ['切丁'],
      tips: 'tip',
      difficulty: '中等',
      category: '川菜',
      tools: ['炒锅'],
    },
  ];
  const secondary = [
    {
      id: 'cook-宫保鸡丁',
      name: '宫保鸡丁',
      stuff: ['鸡肉', '花生'],
      bv: 'BV1NE411Q7Jj',
      difficulty: '简单',
      tags: ['下饭'],
      methods: ['炒'],
      tools: [],
    },
  ];

  const merged = mergeRecipes(primary, secondary);
  assert.strictEqual(merged.length, 1);
  const r = merged[0];
  assert.strictEqual(r.source, 'howtocook');
  assert.strictEqual(r.bv, 'BV1NE411Q7Jj');
  assert.deepStrictEqual(r.methods, ['炒']);
  assert.ok(r.tags.includes('川菜'));
  assert.ok(r.tags.includes('下饭'));
  assert.strictEqual(r.steps.length, 1);
});

test('mergeRecipes 未命中的 cook 菜保留为轻量记录', () => {
  const primary = [];
  const secondary = [
    {
      id: 'cook-神秘菜',
      name: '神秘菜',
      stuff: ['某物'],
      bv: 'BVxyz',
      difficulty: '普通',
      tags: ['家常'],
      methods: [],
      tools: [],
    },
  ];

  const merged = mergeRecipes(primary, secondary);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].source, 'cook');
  assert.strictEqual(merged[0].bv, 'BVxyz');
  assert.deepStrictEqual(merged[0].steps, []);
});

test('mergeRecipes 同名 cook 记录不重复保留', () => {
  const primary = [
    {
      id: 'howtocook-xihongshichaojidan',
      name: '西红柿炒鸡蛋',
      stuff: ['西红柿', '鸡蛋'],
      steps: ['炒'],
      category: '家常菜',
    },
  ];
  const secondary = [
    {
      id: 'cook-西红柿炒鸡蛋',
      name: '西红柿炒鸡蛋',
      stuff: ['西红柿', '鸡蛋'],
      bv: 'BVabc',
      tags: [],
      methods: [],
      tools: [],
    },
  ];

  const merged = mergeRecipes(primary, secondary);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].bv, 'BVabc');
});
