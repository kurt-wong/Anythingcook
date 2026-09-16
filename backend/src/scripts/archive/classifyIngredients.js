/**
 * 食材分类脚本
 * 功能：
 * 1. 收集所有菜谱中的食材
 * 2. 排除调料、饮料、非食材项目
 * 3. 给食材自动分类
 * 4. 生成分类映射文件
 */

const fs = require('fs').promises;
const path = require('path');

const recipesPath = path.join(__dirname, '../data/recipes.json');
const ingredientsPath = path.join(__dirname, '../data/ingredients.json');
const categoryMapPath = path.join(__dirname, '../data/ingredientCategoryMap.json');

// 调料和非食材排除列表
const excludeList = [
  // 调料
  '盐', '糖', '白糖', '红糖', '冰糖', '黑糖', '砂糖',
  '酱油', '生抽', '老抽', '蚝油', '鱼露', '蒸鱼豉油',
  '醋', '米醋', '陈醋', '香醋', '白醋', '苹果醋',
  '料酒', '黄酒', '清酒', '米酒', '白酒',
  '花椒', '八角', '桂皮', '香叶', '丁香', '小茴香', '大料',
  '五香粉', '十三香', '咖喱粉', '辣椒粉', '花椒粉', '胡椒粉', '黑胡椒', '白胡椒',
  '番茄酱', '甜面酱', '黄豆酱', '豆瓣酱', '芝麻酱', '花生酱', '沙拉酱', '蛋黄酱',
  '蚝油', '芝麻油', '香油', '花椒油', '辣椒油', '橄榄油', '玉米油', '葵花籽油', '大豆油',
  '淀粉', '玉米淀粉', '土豆淀粉', '红薯淀粉', '木薯淀粉', '太白粉', '生粉',
  '小苏打', '泡打粉', '酵母', '吉利丁', '琼脂',
  '黑芝麻', '白芝麻', '椰蓉', '可可粉', '抹茶粉',
  '蜂蜜', '麦芽糖', '糖浆', '枫糖浆',
  
  // 饮料/酒类
  '伏特加', '威士忌', '白兰地', '朗姆酒', '金酒', '龙舌兰',
  '百利甜酒', '爱尔兰百利甜酒', '甘露咖啡酒', '蓝天原味伏特加',
  '啤酒', '红酒', '白葡萄酒', '红葡萄酒', '香槟',
  '可乐', '雪碧', '苏打水', '气泡水',
  '咖啡', '浓缩咖啡', '速溶咖啡',
  '茶', '绿茶', '红茶', '乌龙茶', '普洱茶',
  '牛奶', '酸奶', '椰奶', '杏仁奶', '燕麦奶',
  '椰浆', '椰汁',
  
  // 非食材/工具/时间
  '冷藏时间', '腌制时间', '发酵时间', '浸泡时间',
  '冰水', '冰块', '热水', '开水', '温水', '冷水', '清水', '纯净水', '矿泉水',
  '牙签', '竹签', '锡纸', '保鲜膜', '油纸',
  '食用色素', '香草精', '柠檬汁', '青柠汁',
  
  // 泛化/不确定的
  '食用油', '植物油', '色拉油', '调和油',
  '葱', '姜', '蒜', '葱花', '姜片', '姜末', '蒜末', '蒜片', '蒜蓉',
  '香菜', '香葱', '小葱', '大葱',
  '辣椒', '小米辣', '干辣椒', '辣椒面',
  '香叶', '八角', '花椒',
  '胡椒', '胡椒粉', '黑胡椒', '白胡椒',
  '五香粉', '十三香', '咖喱粉',
  '盐', '味精', '鸡精',
  '淀粉', '生粉', '太白粉',
  '料酒', '黄酒', '白酒',
  '酱油', '生抽', '老抽', '蚝油',
  '醋', '米醋', '陈醋', '香醋', '白醋',
  '芝麻油', '香油', '花椒油', '辣椒油',
  '番茄酱', '甜面酱', '黄豆酱', '豆瓣酱',
  '芝麻酱', '花生酱', '沙拉酱', '蛋黄酱',
  '糖', '白糖', '红糖', '冰糖', '砂糖',
  '蜂蜜', '麦芽糖', '糖浆',
  '小苏打', '泡打粉', '酵母',
  '吉利丁', '琼脂',
  '黑芝麻', '白芝麻', '椰蓉',
  '可可粉', '抹茶粉',
  '淀粉', '玉米淀粉', '土豆淀粉',
];

// 食材分类关键词映射
const categoryKeywords = {
  '肉类': [
    '猪肉', '牛肉', '羊肉', '鸡肉', '鸭肉', '鹅肉',
    '猪里脊', '猪排骨', '猪五花', '猪蹄', '猪耳朵', '猪肝', '猪心', '猪肚',
    '牛腩', '牛腱', '牛排', '肥牛', '牛百叶', '牛肚',
    '羊排', '羊腿', '羊蝎子',
    '鸡胸肉', '鸡腿', '鸡翅', '鸡爪', '鸡胗', '鸡心', '鸡肝',
    '鸭胸', '鸭腿', '鸭翅', '鸭胗',
    '培根', '火腿', '香肠', '腊肠', '午餐肉', '肉松',
    '排骨', '肉馅', '肉末', '肉片', '肉丝',
  ],
  '蛋奶类': [
    '鸡蛋', '鸭蛋', '鹅蛋', '鹌鹑蛋',
    '皮蛋', '咸鸭蛋', '茶叶蛋',
    '牛奶', '酸奶', '奶酪', '芝士', '黄油', '奶油',
    '淡奶油', '鲜奶油', '炼乳', '奶粉',
  ],
  '水产类': [
    '鱼', '虾', '蟹', '贝', '蛤', '蛏', '螺', '蚝', '鱿鱼', '墨鱼', '章鱼',
    '三文鱼', '鲈鱼', '鲫鱼', '草鱼', '鲤鱼', '黄鱼', '鳕鱼', '带鱼', '鲳鱼',
    '龙虾', '基围虾', '对虾', '河虾', '虾仁', '虾皮', '虾米',
    '螃蟹', '梭子蟹', '大闸蟹',
    '扇贝', '生蚝', '蛤蜊', '蛏子', '田螺', '海螺',
    '海参', '鲍鱼', '鱼翅', '花胶',
    '鱼丸', '虾丸', '蟹棒',
    '海带', '紫菜', '裙带菜',
  ],
  '蔬菜类': [
    '番茄', '西红柿', '黄瓜', '茄子', '土豆', '红薯', '紫薯',
    '白菜', '青菜', '菠菜', '生菜', '油麦菜', '空心菜', '韭菜', '芹菜',
    '胡萝卜', '白萝卜', '青萝卜',
    '洋葱', '大蒜', '生姜',
    '青椒', '红椒', '彩椒', '尖椒', '灯笼椒',
    '豆角', '四季豆', '荷兰豆', '豌豆',
    '蘑菇', '香菇', '金针菇', '杏鲍菇', '茶树菇', '平菇', '口蘑',
    '木耳', '银耳', '竹笋', '芦笋', '茭白',
    '西兰花', '花菜', '菜花',
    '南瓜', '冬瓜', '苦瓜', '丝瓜',
    '莴笋', '山药', '芋头',
    '玉米', '莲藕', '百合',
    '香菜', '薄荷', '罗勒',
  ],
  '豆制品': [
    '豆腐', '豆皮', '豆干', '豆腐干', '豆腐皮', '豆腐丝', '豆腐泡',
    '豆浆', '豆花', '豆腐脑',
    '腐竹', '素鸡', '素鹅',
    '毛豆', '黄豆', '黑豆', '绿豆', '红豆',
    '豆芽', '黄豆芽', '绿豆芽',
  ],
  '主食类': [
    '面粉', '低筋面粉', '高筋面粉', '中筋面粉', '全麦面粉',
    '大米', '糯米', '糙米', '黑米', '小米',
    '面条', '挂面', '方便面', '意大利面', '通心粉',
    '饺子皮', '馄饨皮', '春卷皮',
    '馒头', '包子', '花卷', '烧饼',
    '面包', '吐司', '汉堡包', '热狗',
    '米饭', '粥', '稀饭',
    '粉丝', '粉条', '米粉', '河粉', '年糕',
    '燕麦', '麦片', '藜麦',
  ],
  '干货/菌菇': [
    '香菇', '木耳', '银耳', '茶树菇', '竹荪',
    '虾米', '虾皮', '干贝', '海米',
    '枸杞', '红枣', '桂圆', '莲子',
    '核桃', '杏仁', '腰果', '花生', '瓜子', '松子', '开心果', '夏威夷果',
    '葡萄干', '蔓越莓干', '蓝莓干',
    '干辣椒', '干花椒',
    '腐竹', '粉丝', '粉条',
  ],
  '水果类': [
    '苹果', '梨', '橙子', '橘子', '柚子', '柠檬', '青柠',
    '香蕉', '芒果', '菠萝', '荔枝', '龙眼', '火龙果',
    '草莓', '蓝莓', '覆盆子', '樱桃',
    '西瓜', '哈密瓜', '甜瓜', '木瓜',
    '猕猴桃', '百香果', '石榴',
    '椰子', '榴莲', '山竹',
    '葡萄', '提子',
    '柿子', '无花果',
    '桃子', '李子', '杏',
  ],
  '坚果/种子': [
    '花生', '核桃', '杏仁', '腰果', '松子', '开心果', '夏威夷果', '碧根果',
    '瓜子', '葵花籽', '南瓜子', '西瓜子',
    '芝麻', '黑芝麻', '白芝麻',
    '亚麻籽', '奇亚籽', '罂粟籽',
  ],
  '酱料/腌制品': [
    '豆腐乳', '腐乳', '臭豆腐',
    '泡菜', '酸菜', '榨菜', '雪菜', '梅干菜',
    '橄榄', '酸黄瓜',
    '辣椒酱', '蒜蓉辣酱', '老干妈',
    '沙拉酱', '蛋黄酱', '千岛酱',
    '番茄酱', '甜辣酱', '海鲜酱',
  ],
  '冷冻/加工食品': [
    '速冻饺子', '速冻馄饨', '速冻汤圆',
    '冷冻蔬菜', '冷冻水果',
    '冰淇淋', '雪糕',
    '罐头', '午餐肉', '火腿肠',
  ],
};

async function main() {
  try {
    console.log('开始分类食材...');
    
    // 读取菜谱数据
    const recipesData = await fs.readFile(recipesPath, 'utf-8');
    const recipes = JSON.parse(recipesData);
    
    // 收集所有食材
    const allIngredients = new Set();
    recipes.forEach(recipe => {
      if (recipe.stuff && Array.isArray(recipe.stuff)) {
        recipe.stuff.forEach(item => allIngredients.add(item));
      }
    });
    
    console.log(`原始食材总数: ${allIngredients.size}`);
    
    // 过滤掉排除列表中的项目
    const filteredIngredients = Array.from(allIngredients).filter(item => {
      // 排除调料和非食材
      if (excludeList.includes(item)) {
        return false;
      }
      // 排除空字符串或只有空格
      if (!item.trim()) {
        return false;
      }
      return true;
    });
    
    console.log(`过滤后食材数: ${filteredIngredients.length}`);
    
    // 分类食材
    const categoryMap = {};
    const uncategorized = [];
    
    filteredIngredients.forEach(ingredient => {
      let category = '其他';
      
      // 遍历分类关键词
      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => ingredient.includes(keyword))) {
          category = cat;
          break;
        }
      }
      
      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }
      categoryMap[category].push(ingredient);
      
      if (category === '其他') {
        uncategorized.push(ingredient);
      }
    });
    
    // 打印分类结果
    console.log('\n=== 分类结果 ===');
    for (const [category, items] of Object.entries(categoryMap)) {
      console.log(`\n【${category}】(${items.length}个):`);
      console.log(items.join('、'));
    }
    
    if (uncategorized.length > 0) {
      console.log(`\n【未分类】(${uncategorized.length}个):`);
      console.log(uncategorized.join('、'));
    }
    
    // 保存分类映射
    await fs.writeFile(categoryMapPath, JSON.stringify(categoryMap, null, 2), 'utf-8');
    console.log(`\n分类映射已保存到: ${categoryMapPath}`);
    
    // 更新 ingredients.json，只保留过滤后的食材
    let ingredients = {};
    try {
      const ingredientsData = await fs.readFile(ingredientsPath, 'utf-8');
      ingredients = JSON.parse(ingredientsData);
    } catch (e) {
      // 文件不存在或为空
    }
    
    // 清理 ingredients 中不在过滤列表中的食材
    const cleanedIngredients = {};
    filteredIngredients.forEach(item => {
      if (ingredients[item]) {
        cleanedIngredients[item] = ingredients[item];
      } else {
        cleanedIngredients[item] = { count: 0 };
      }
    });
    
    await fs.writeFile(ingredientsPath, JSON.stringify(cleanedIngredients, null, 2), 'utf-8');
    console.log(`\ningredients.json 已更新，保留 ${Object.keys(cleanedIngredients).length} 个食材`);
    
  } catch (error) {
    console.error('分类失败:', error);
    process.exit(1);
  }
}

main();