/**
 * 深度清洗食材脚本
 * 功能：
 * 1. 进一步排除调料、酱料
 * 2. 去重（合并相似食材）
 * 3. 规范化食材名称
 */

const fs = require('fs').promises;
const path = require('path');

const ingredientsPath = path.join(__dirname, '../data/ingredients.json');
const categoryMapPath = path.join(__dirname, '../data/ingredientCategoryMap.json');

// 调料和酱料（绝对排除）
const condimentKeywords = [
  // 基础调料
  '盐', '糖', '酱油', '醋', '料酒', '花椒', '八角', '桂皮', '香叶', '胡椒',
  '淀粉', '生粉', '太白粉', '蚝油', '芝麻油', '香油', '豆瓣酱',
  '番茄酱', '甜面酱', '黄豆酱', '芝麻酱', '花生酱', '沙拉酱', '蛋黄酱',
  '小苏打', '泡打粉', '酵母', '吉利丁', '琼脂', '可可粉', '抹茶粉',
  '蜂蜜', '麦芽糖', '糖浆', '咖喱', '五香粉', '十三香', '味精', '鸡精',
  
  // 酱料
  '腐乳', '南乳', '柱候酱', '叉烧酱', '蒜蓉酱', '辣椒酱', '老干妈',
  '海鲜酱', '甜辣酱', '千岛酱', '蛋黄酱', '美乃滋', '芥末', '芥末酱',
  '沙茶酱', 'XO酱', '豆豉', '阳江豆豉', '郫县豆瓣', '红油豆瓣',
  
  // 油脂
  '食用油', '植物油', '色拉油', '调和油', '玉米油', '葵花籽油', '大豆油',
  '橄榄油', '花生油', '菜籽油', '猪油', '牛油', '黄油', '酥油',
  '椰子油', '芝麻油', '花椒油', '辣椒油', '藤椒油', '红葱油',
  
  // 香料
  '八角', '桂皮', '香叶', '花椒', '胡椒', '辣椒', '干辣椒',
  '孜然', '小茴香', '大料', '丁香', '草果', '豆蔻', '砂仁',
  '陈皮', '甘草', '当归', '枸杞', '红枣',
  
  // 粉末调料
  '胡椒粉', '花椒粉', '辣椒粉', '孜然粉', '五香粉', '十三香',
  '咖喱粉', '姜黄粉', '肉桂粉', '豆蔻粉', '小豆蔻粉',
  '甜椒粉', '椒盐粉', '烧烤撒料',
  
  // 液体调料
  '料酒', '黄酒', '白酒', '米酒', '花雕酒',
  '生抽', '老抽', '蚝油', '鱼露', '蒸鱼豉油',
  '醋', '米醋', '陈醋', '香醋', '白醋', '黑醋',
  '味淋', '味极鲜',
  
  // 其他调料
  '葱', '姜', '蒜', '洋葱', '香菜', '香葱', '小葱', '大葱',
  '葱花', '葱白', '葱段', '葱结', '葱末', '葱姜', '葱姜蒜',
  '姜片', '姜丝', '姜末', '姜汁', '姜油', '姜黄',
  '蒜末', '蒜片', '蒜蓉', '蒜仔', '蒜半', '蒜头',
  '辣椒', '红辣椒', '青辣椒', '小米辣', '朝天椒', '美人椒',
  '线椒', '剁椒', '泡椒', '野山椒', '灯笼椒',
  
  // 酒类
  '伏特加', '威士忌', '白兰地', '朗姆酒', '金酒', '龙舌兰',
  '百利甜酒', '咖啡酒', '啤酒', '红酒', '葡萄酒', '香槟',
  '清酒', '米酒', '黄酒', '花雕酒', '料酒',
  
  // 饮料
  '可乐', '雪碧', '苏打水', '气泡水', '咖啡', '茶', '牛奶', '酸奶',
  '椰奶', '椰浆', '椰汁', '豆浆', '奶茶', '果汁', '汽水',
  
  // 描述性文字
  '用量', '大约', '适量', '少许', '一些', '几滴', '几颗',
  '备用', '部分', '方法', '必须', '可选', '进阶',
  '主料', '调料', '配料', '香料', '面类', '菜类',
  '工具', '原料', '材料',
];

// 食材标准化映射（去重）
const ingredientNormalization = {
  '番茄': '西红柿',
  '土豆': '马铃薯',
  '玉米': '玉米粒',
  '鸡蛋': '鸡蛋',
  '鸡胸肉': '鸡胸肉',
  '鸡腿': '鸡腿肉',
  '鸡翅': '鸡翅',
  '猪肉': '猪肉',
  '牛肉': '牛肉',
  '羊肉': '羊肉',
  '虾': '虾',
  '虾仁': '虾仁',
  '豆腐': '豆腐',
  '嫩豆腐': '豆腐',
  '老豆腐': '豆腐',
  '日本豆腐': '豆腐',
  '内酯豆腐': '豆腐',
  '白豆腐': '豆腐',
  '葫芦卜': '胡萝卜',
  '方面': '方便面',
};

// 检查是否是调料
function isCondiment(name) {
  const cleaned = name.trim();
  
  // 精确匹配
  if (condimentKeywords.includes(cleaned)) {
    return true;
  }
  
  // 包含匹配
  for (const keyword of condimentKeywords) {
    if (cleaned.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

// 标准化食材名称
function normalizeName(name) {
  let cleaned = name.trim();
  
  // 去掉emoji
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{FE0F}]/gu, '');
  
  // 去掉括号内容
  cleaned = cleaned.replace(/[（(][^）)]*[）)]/g, '');
  
  // 去掉数量描述
  cleaned = cleaned.replace(/\s*\d+\s*[个根条块片把棵颗粒包盒袋瓶罐碗勺滴]/g, '');
  cleaned = cleaned.replace(/\s*[一二三四五六七八九十百千万半]\s*[个根条块片把棵颗粒包盒袋瓶罐碗勺滴]/g, '');
  cleaned = cleaned.replace(/\s*约\s*/g, '');
  cleaned = cleaned.replace(/\s*的用量为\s*/g, '');
  cleaned = cleaned.replace(/\s*用量为\s*/g, '');
  
  // 去掉"或"后面的内容
  cleaned = cleaned.replace(/或.*/g, '');
  
  // 去掉多余空格和标点
  cleaned = cleaned.trim().replace(/[,，。、；;：:！!？?\s]+$/g, '');
  
  // 应用标准化映射
  if (ingredientNormalization[cleaned]) {
    cleaned = ingredientNormalization[cleaned];
  }
  
  return cleaned;
}

// 拆分复合食材（如"牛肉，土豆"）
function splitCompoundIngredient(name) {
  // 如果包含逗号、顿号等分隔符，拆分成多个食材
  if (/[,，、；;]/.test(name)) {
    return name.split(/[,，、；;]/).map(s => s.trim()).filter(s => s.length > 0);
  }
  return [name];
}

// 检查是否应该保留
function shouldKeep(name) {
  const normalized = normalizeName(name);
  
  // 太短（单字或双字）
  if (normalized.length <= 1) return false;
  
  // 太长（可能是描述性文字）
  if (normalized.length > 8) return false;
  
  // 是调料
  if (isCondiment(normalized)) return false;
  
  return true;
}

// 食材分类
function categorizeIngredient(name) {
  const cleaned = name.trim();
  
  // 肉类
  if (/猪肉|牛肉|羊肉|鸡肉|鸭肉|鹅肉|排骨|里脊|五花|牛腩|牛腱|鸡胸|鸡腿|鸡翅|培根|火腿|香肠|腊肠|午餐肉|肉松|肉馅|肉末|肉片|肉丝|猪蹄|猪耳|猪肝|猪心|猪肚|牛百叶|牛肚|羊排|羊腿|鸡爪|鸡胗|鸡心|鸡肝|鸭胸|鸭腿|鸭翅|鸭胗/.test(cleaned)) {
    return '肉类';
  }
  
  // 蛋类
  if (/鸡蛋|鸭蛋|鹅蛋|鹌鹑蛋|皮蛋|咸鸭蛋|蛋清|蛋黄|蛋液|蛋皮/.test(cleaned)) {
    return '蛋类';
  }
  
  // 水产类
  if (/鱼|虾|蟹|贝|蛤|蛏|螺|蚝|鱿鱼|墨鱼|章鱼|三文鱼|鲈鱼|鲫鱼|草鱼|鲤鱼|黄鱼|鳕鱼|带鱼|鲳鱼|龙虾|基围虾|对虾|河虾|虾仁|虾皮|虾米|螃蟹|梭子蟹|大闸蟹|扇贝|生蚝|蛤蜊|蛏子|田螺|海螺|海参|鲍鱼|鱼翅|花胶|鱼丸|虾丸|蟹棒|海带|紫菜|裙带菜/.test(cleaned)) {
    return '水产类';
  }
  
  // 蔬菜类
  if (/番茄|西红柿|黄瓜|茄子|土豆|红薯|紫薯|白菜|青菜|菠菜|生菜|油麦菜|空心菜|韭菜|芹菜|胡萝卜|白萝卜|青萝卜|洋葱|大蒜|生姜|青椒|红椒|彩椒|尖椒|灯笼椒|豆角|四季豆|荷兰豆|豌豆|蘑菇|香菇|金针菇|杏鲍菇|茶树菇|平菇|口蘑|木耳|银耳|竹笋|芦笋|茭白|西兰花|花菜|菜花|南瓜|冬瓜|苦瓜|丝瓜|莴笋|山药|芋头|玉米|莲藕|百合|香菜|薄荷|罗勒|娃娃菜|大白菜|小番茄|马铃薯/.test(cleaned)) {
    return '蔬菜类';
  }
  
  // 豆制品
  if (/豆腐|豆皮|豆干|豆腐干|豆腐皮|豆腐丝|豆腐泡|豆浆|豆花|豆腐脑|腐竹|素鸡|素鹅|毛豆|黄豆|黑豆|绿豆|红豆|豆芽|黄豆芽|绿豆芽/.test(cleaned)) {
    return '豆制品';
  }
  
  // 主食类
  if (/面粉|低筋|高筋|中筋|全麦|大米|糯米|糙米|黑米|小米|面条|挂面|方便面|意大利面|通心粉|饺子皮|馄饨皮|春卷皮|馒头|包子|花卷|烧饼|面包|吐司|汉堡包|热狗|米饭|粥|稀饭|粉丝|粉条|米粉|河粉|年糕|燕麦|麦片|藜麦/.test(cleaned)) {
    return '主食类';
  }
  
  // 干货/菌菇
  if (/香菇|木耳|银耳|茶树菇|竹荪|虾米|虾皮|干贝|海米|枸杞|红枣|桂圆|莲子|核桃|杏仁|腰果|花生|瓜子|松子|开心果|夏威夷果|葡萄干|蔓越莓干|蓝莓干|干辣椒|干花椒|腐竹|粉丝|粉条/.test(cleaned)) {
    return '干货/菌菇';
  }
  
  // 水果类
  if (/苹果|梨|橙子|橘子|柚子|柠檬|青柠|香蕉|芒果|菠萝|荔枝|龙眼|火龙果|草莓|蓝莓|覆盆子|樱桃|西瓜|哈密瓜|甜瓜|木瓜|猕猴桃|百香果|石榴|椰子|榴莲|山竹|葡萄|提子|柿子|无花果|桃子|李子|杏/.test(cleaned)) {
    return '水果类';
  }
  
  // 坚果/种子
  if (/花生|核桃|杏仁|腰果|松子|开心果|夏威夷果|碧根果|瓜子|葵花籽|南瓜子|西瓜子|芝麻|黑芝麻|白芝麻|亚麻籽|奇亚籽|罂粟籽/.test(cleaned)) {
    return '坚果/种子';
  }
  
  // 酱料/腌制品
  if (/豆腐乳|腐乳|臭豆腐|泡菜|酸菜|榨菜|雪菜|梅干菜|橄榄|酸黄瓜/.test(cleaned)) {
    return '酱料/腌制品';
  }
  
  // 冷冻/加工食品
  if (/速冻饺子|速冻馄饨|速冻汤圆|冷冻蔬菜|冷冻水果|冰淇淋|雪糕|罐头|午餐肉|火腿肠/.test(cleaned)) {
    return '冷冻/加工食品';
  }
  
  return '其他';
}

async function main() {
  try {
    console.log('开始深度清洗食材...');
    
    // 读取当前食材
    const ingredientsData = await fs.readFile(ingredientsPath, 'utf-8');
    const ingredients = JSON.parse(ingredientsData);
    
    console.log(`当前食材数量: ${Object.keys(ingredients).length}`);
    
    // 清洗和过滤
    const cleanedIngredients = {};
    const removedItems = [];
    
    for (const [name, data] of Object.entries(ingredients)) {
      // 拆分复合食材
      const parts = splitCompoundIngredient(name);
      
      for (const part of parts) {
        const normalized = normalizeName(part);
        
        if (shouldKeep(part)) {
          // 如果已存在同名食材，合并库存
          if (cleanedIngredients[normalized]) {
            cleanedIngredients[normalized].count += data.count || 0;
          } else {
            cleanedIngredients[normalized] = { count: data.count || 0 };
          }
        } else {
          removedItems.push(part);
        }
      }
    }
    
    console.log(`清洗后食材数量: ${Object.keys(cleanedIngredients).length}`);
    console.log(`移除食材数量: ${removedItems.length}`);
    
    // 打印移除的食材（前20个）
    console.log('\n移除的食材示例:');
    console.log(removedItems.slice(0, 20).join('、'));
    
    // 重新生成分类映射
    const categoryMap = {};
    for (const name of Object.keys(cleanedIngredients)) {
      const category = categorizeIngredient(name);
      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }
      categoryMap[category].push(name);
    }
    
    // 打印分类结果
    console.log('\n=== 分类结果 ===');
    for (const [category, items] of Object.entries(categoryMap)) {
      console.log(`\n【${category}】(${items.length}个):`);
      console.log(items.slice(0, 15).join('、') + (items.length > 15 ? '...' : ''));
    }
    
    // 保存清洗后的食材
    await fs.writeFile(ingredientsPath, JSON.stringify(cleanedIngredients, null, 2), 'utf-8');
    console.log(`\ningredients.json 已更新`);
    
    // 保存分类映射
    await fs.writeFile(categoryMapPath, JSON.stringify(categoryMap, null, 2), 'utf-8');
    console.log(`ingredientCategoryMap.json 已更新`);
    
    // 保存移除列表
    await fs.writeFile(path.join(__dirname, '../data/removedIngredients.json'), JSON.stringify(removedItems, null, 2), 'utf-8');
    console.log(`removedIngredients.json 已保存`);
    
  } catch (error) {
    console.error('清洗失败:', error);
    process.exit(1);
  }
}

main();