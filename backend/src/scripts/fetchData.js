const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { parse } = require('csv-parse/sync');

// GitHub仓库信息
const GITHUB_REPOS = [
  {
    owner: 'YunYouJun',
    repo: 'cook',
    path: 'app/data/recipe.csv',
    name: 'cook'
  }
];

// 数据目录
const DATA_DIR = path.join(__dirname, '../data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');
const LAST_UPDATED_FILE = path.join(DATA_DIR, 'last_updated.json');

// 确保数据目录存在
fs.ensureDirSync(DATA_DIR);

/**
 * 从GitHub获取CSV文件内容
 */
async function fetchCSVFromGitHub(owner, repo, filePath) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
  
  try {
    console.log(`正在从 ${url} 获取数据...`);
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Amazing-Food-App/1.0'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`获取 ${owner}/${repo}/${filePath} 失败:`, error.message);
    return null;
  }
}

/**
 * 解析CSV数据为JSON格式
 */
function parseCSVToJSON(csvContent, source) {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    return records.map(record => {
      // 处理食材列表
      const stuff = record.stuff ? record.stuff.split('、').filter(item => item.trim()) : [];
      
      // 处理标签
      const tags = record.tags ? record.tags.split('、').filter(item => item.trim()) : [];
      
      // 处理烹饪方式
      const methods = record.methods ? record.methods.split('、').filter(item => item.trim()) : [];
      
      // 处理工具
      const tools = record.tools ? record.tools.split('、').filter(item => item.trim()) : [];

      return {
        name: record.name || '未知菜品',
        stuff,
        bv: record.bv || '',
        difficulty: record.difficulty || '普通',
        tags,
        methods,
        tools,
        source,
        id: `${source}-${record.name || Math.random().toString(36).substr(2, 9)}`
      };
    }).filter(recipe => recipe.name !== '未知菜品');
  } catch (error) {
    console.error('解析CSV失败:', error.message);
    return [];
  }
}

/**
 * 从所有配置的仓库获取数据
 */
async function fetchAllRecipes() {
  let allRecipes = [];

  for (const repoConfig of GITHUB_REPOS) {
    const csvContent = await fetchCSVFromGitHub(
      repoConfig.owner,
      repoConfig.repo,
      repoConfig.path
    );

    if (csvContent) {
      const recipes = parseCSVToJSON(csvContent, repoConfig.name);
      allRecipes = allRecipes.concat(recipes);
      console.log(`从 ${repoConfig.name} 获取到 ${recipes.length} 个菜谱`);
    }
  }

  return allRecipes;
}

/**
 * 保存数据到文件
 */
async function saveData(recipes) {
  try {
    // 保存菜谱数据
    await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });
    
    // 更新最后更新时间
    const lastUpdated = {
      timestamp: new Date().toISOString(),
      count: recipes.length,
      sources: [...new Set(recipes.map(r => r.source))]
    };
    await fs.writeJson(LAST_UPDATED_FILE, lastUpdated, { spaces: 2 });
    
    console.log(`成功保存 ${recipes.length} 个菜谱到 ${RECIPES_FILE}`);
    return true;
  } catch (error) {
    console.error('保存数据失败:', error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('开始从GitHub获取菜谱数据...');
  
  const recipes = await fetchAllRecipes();
  
  if (recipes.length > 0) {
    await saveData(recipes);
    console.log('数据获取完成！');
  } else {
    console.log('未获取到任何菜谱数据');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  fetchAllRecipes,
  saveData,
  main
};