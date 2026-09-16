/**
 * 清理 recipes.json 中的 stuff 字段
 * 很多条目包含 "食材名 = 用量" 或 "食材名 = 描述" 的格式
 * 需要提取纯食材名
 */
const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');

function cleanStuffName(name) {
  if (!name || typeof name !== 'string') return null;

  let cleaned = name;

  // 去掉 = 及其后面的内容
  const eqIndex = cleaned.indexOf('=');
  if (eqIndex > 0) {
    cleaned = cleaned.substring(0, eqIndex);
  }

  // 去掉（及后面的说明内容
  const parenIndex = cleaned.indexOf('（');
  if (parenIndex > 0) {
    cleaned = cleaned.substring(0, parenIndex);
  }

  // 去掉数字开头的条目（如 "1 茶匙 =", "10ml 老抽"）
  if (/^\d/.test(cleaned.trim())) return null;

  // 去掉emoji前缀
  cleaned = cleaned.replace(/^[\u{1F300}-\u{1FBFF}]\s*/u, '');

  // 去掉冒号及其后面的内容
  const colonIndex = cleaned.indexOf('：');
  if (colonIndex > 0) {
    cleaned = cleaned.substring(0, colonIndex);
  }
  const colonIndex2 = cleaned.indexOf(':');
  if (colonIndex2 > 0) {
    cleaned = cleaned.substring(0, colonIndex2);
  }

  // 去掉 * 号
  cleaned = cleaned.replace(/\*/g, '');

  // 去掉 "量" 后缀（如 "牛肉量" -> "牛肉"）
  cleaned = cleaned.replace(/量$/, '');

  // 去掉数量描述（如 "八角 两个" -> "八角", "八角三个" -> "八角"）
  // 匹配: 数字+量词, 或 "两" + 量词, 或 "几" + 量词
  const quantityPattern = /[\s]*(一|二|两|三|四|五|六|七|八|九|十|\d+)(个|只|条|块|片|颗|根|棵|把|勺|汤匙|茶匙|斤|克|g|ml|份|根|段|滴|瓣)[\s]*$/;
  cleaned = cleaned.replace(quantityPattern, '');

  // 去掉 "或者xxx" 的替代说明
  const orIndex = cleaned.indexOf('或者');
  if (orIndex > 0) {
    cleaned = cleaned.substring(0, orIndex);
  }

  // 去掉末尾的 "适量"
  cleaned = cleaned.replace(/适量$/, '');

  // 去掉 "的数" 后缀
  cleaned = cleaned.replace(/的数$/, '');

  // 去掉以反引号开头或结尾的内容
  cleaned = cleaned.replace(/`/g, '');

  // trim
  cleaned = cleaned.trim();

  // 如果清理后为空或太短，返回null
  if (!cleaned || cleaned.length === 0) return null;

  // 如果包含特殊字符，可能不是有效食材名
  if (/ml|g|kg/.test(cleaned) && cleaned.length < 3) return null;

  // 过滤掉纯数字或太短的无效条目
  if (/^\d+$/.test(cleaned)) return null;
  // 单字且是数字或无意义的字
  if (cleaned.length === 1) return null;

  return cleaned;
}

async function main() {
  console.log('开始清理 recipes.json 中的 stuff 字段...\n');

  const recipes = await fs.readJson(RECIPES_FILE);
  let modifiedCount = 0;
  let removedEntries = 0;
  let cleanedEntries = 0;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    if (!recipe.stuff || !Array.isArray(recipe.stuff)) continue;

    const originalStuff = [...recipe.stuff];
    const newStuff = [];

    for (const item of originalStuff) {
      const cleaned = cleanStuffName(item);
      if (cleaned) {
        // 避免重复
        if (!newStuff.includes(cleaned)) {
          newStuff.push(cleaned);
          if (cleaned !== item) cleanedEntries++;
        } else {
          removedEntries++;
        }
      } else {
        removedEntries++;
      }
    }

    // 检查是否有变化
    if (JSON.stringify(originalStuff) !== JSON.stringify(newStuff)) {
      recipes[i].stuff = newStuff;
      modifiedCount++;
      console.log(`[${i + 1}/${recipes.length}] ${recipe.name}:`);
      if (originalStuff.length !== newStuff.length) {
        console.log(`  食材: ${originalStuff.length} -> ${newStuff.length}`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`清理完成！`);
  console.log(`修改了 ${modifiedCount} 道菜谱`);
  console.log(`清理了 ${cleanedEntries} 个食材名称`);
  console.log(`移除了 ${removedEntries} 个无效/重复条目`);
  console.log('========================================');

  // 统计清理后的总食材数
  const allStuff = new Set();
  recipes.forEach(r => r.stuff.forEach(s => allStuff.add(s)));
  console.log(`\n清理后总食材数: ${allStuff.size}`);

  // 显示前20个食材作为样本
  const samples = [...allStuff].sort((a, b) => a.localeCompare(b, 'zh-CN')).slice(0, 20);
  console.log('\n前20个食材样本:');
  samples.forEach(s => console.log(`  - ${s}`));

  await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });
  console.log('\n已保存到 recipes.json');
}

main().catch(err => {
  console.error('脚本执行失败:', err.message);
  process.exit(1);
});
