/**
 * 通过 git clone 获取 HowToCook 仓库的所有图片
 * 
 * 原理：HowToCook 仓库使用 Git LFS 存储图片，直接 HTTP 下载会拿到指针文件。
 * 通过 git clone --filter=blob:none 只下载需要的 blob，自动解析 LFS。
 * 然后从本地仓库目录中复制图片到我们的 images 目录。
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../data');
const RECIPES_FILE = path.join(DATA_DIR, 'recipes.json');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const TEMP_REPO_DIR = path.join(DATA_DIR, '.howtocook-repo');

// HowToCook 仓库地址
const REPO_URL = 'https://github.com/Anduin2017/HowToCook.git';

// 菜谱分类目录
const DISH_CATEGORIES = [
  'vegetable_dish', 'meat_dish', 'aquatic', 'breakfast',
  'staple', 'semi-finished', 'soup', 'drink', 'condiment', 'dessert'
];

/**
 * 克隆仓库（浅克隆 + LFS）
 */
function cloneRepo() {
  if (fs.existsSync(TEMP_REPO_DIR)) {
    console.log('仓库目录已存在，跳过克隆');
    return;
  }

  console.log('正在克隆 HowToCook 仓库（含 LFS 图片）...');
  console.log('这可能需要几分钟，取决于网络速度...\n');

  try {
    // 使用 --depth=1 浅克隆减少下载量
    // 通过 -c 设置代理
    execSync(
      `git -c http.proxy=http://127.0.0.1:55219 -c https.proxy=http://127.0.0.1:55219 clone --depth=1 ${REPO_URL} "${TEMP_REPO_DIR}"`,
      {
        timeout: 600000, // 10分钟超时
        stdio: 'pipe',
        windowsHide: true,
      }
    );
    console.log('仓库克隆完成！');
  } catch (e) {
    console.error('仓库克隆失败:', e.message);
    // 清理失败的克隆
    try { fs.removeSync(TEMP_REPO_DIR); } catch (_) {}
    throw e;
  }
}

/**
 * 扫描仓库目录，找到所有 .jpg 图片文件
 * 返回 Map: 菜名 -> 图片文件路径
 */
function scanRepoImages() {
  const dishesPath = path.join(TEMP_REPO_DIR, 'dishes');
  const imageMap = new Map();

  for (const category of DISH_CATEGORIES) {
    const categoryPath = path.join(dishesPath, category);
    if (!fs.existsSync(categoryPath)) continue;

    const entries = fs.readdirSync(categoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // 目录类型：扫描里面的 .jpg 文件
        const dirPath = path.join(categoryPath, entry.name);
        const files = fs.readdirSync(dirPath);
        const jpgFiles = files.filter(f => f.endsWith('.jpg'));

        if (jpgFiles.length > 0) {
          // 优先选择与目录同名的文件，否则取第一个
          const exactMatch = jpgFiles.find(f => f === `${entry.name}.jpg`);
          const selectedFile = exactMatch || jpgFiles[0];
          imageMap.set(entry.name, {
            filePath: path.join(dirPath, selectedFile),
            category
          });
        }
      }
    }
  }

  console.log(`扫描到 ${imageMap.size} 个有图片的菜目录`);
  return imageMap;
}

/**
 * 匹配菜谱并复制图片
 */
async function matchAndCopyImages(imageMap) {
  if (!await fs.pathExists(RECIPES_FILE)) {
    console.log('未找到 recipes.json，请先运行导入');
    return { total: 0, copied: 0 };
  }

  const recipes = await fs.readJson(RECIPES_FILE);
  const missingRecipes = recipes.filter(r => !r.imageUrl);

  console.log(`共 ${recipes.length} 道菜谱，${missingRecipes.length} 道缺失图片\n`);

  await fs.ensureDir(IMAGES_DIR);

  let copied = 0;
  let matched = 0;

  for (let i = 0; i < missingRecipes.length; i++) {
    const recipe = missingRecipes[i];
    const progress = `[${i + 1}/${missingRecipes.length}]`;

    // 去掉括号后缀
    const baseName = recipe.name.replace(/[（(].*?[）)]/, '').trim();
    const namesToTry = [recipe.name];
    if (baseName !== recipe.name) namesToTry.push(baseName);

    let found = false;
    for (const name of namesToTry) {
      if (imageMap.has(name)) {
        matched++;
        const { filePath } = imageMap.get(name);
        const rawId = recipe.id.replace('howtocook-', '');
        const destPath = path.join(IMAGES_DIR, `${rawId}.jpg`);

        try {
          // 检查源文件大小（LFS 指针文件只有~130字节）
          const stat = fs.statSync(filePath);
          if (stat.size < 1000) {
            console.log(`${progress} ⚠ ${recipe.name} - 文件太小(${stat.size}B)，可能是LFS指针`);
            // 尝试用 git lfs pull 拉取实际文件
            try {
              execSync(`cd "${TEMP_REPO_DIR}" && git lfs pull --include="dishes/*/${name}/*"`, {
                timeout: 60000,
                stdio: 'pipe',
                windowsHide: true
              });
              const newStat = fs.statSync(filePath);
              if (newStat.size < 1000) {
                console.log(`${progress} ✗ ${recipe.name} - LFS pull 后仍为指针文件`);
                found = true;
                break;
              }
            } catch (e) {
              console.log(`${progress} ✗ ${recipe.name} - LFS pull 失败: ${e.message}`);
              found = true;
              break;
            }
          }

          await fs.copy(filePath, destPath, { overwrite: true });
          const idx = recipes.findIndex(r => r.id === recipe.id);
          if (idx !== -1) {
            recipes[idx].imageUrl = `/api/local-image/${rawId}.jpg`;
          }
          copied++;
          console.log(`${progress} ✓ ${recipe.name}`);
          found = true;
        } catch (e) {
          console.log(`${progress} ✗ ${recipe.name} - 复制失败: ${e.message}`);
          found = true;
        }
        break;
      }
    }

    if (!found) {
      // GitHub 仓库没有这道菜的图片
    }
  }

  // 保存更新后的 recipes.json
  await fs.writeJson(RECIPES_FILE, recipes, { spaces: 2 });

  console.log('\n========================================');
  console.log('图片同步完成！');
  console.log(`检查: ${missingRecipes.length}`);
  console.log(`匹配: ${matched}`);
  console.log(`复制: ${copied}`);
  console.log(`仍缺失: ${missingRecipes.length - copied}`);
  console.log('========================================');

  return { total: missingRecipes.length, copied };
}

/**
 * 清理临时仓库目录
 */
function cleanupRepo() {
  if (fs.existsSync(TEMP_REPO_DIR)) {
    console.log('清理临时仓库目录...');
    try {
      fs.removeSync(TEMP_REPO_DIR);
      console.log('清理完成');
    } catch (e) {
      console.error('清理失败（可手动删除）:', e.message);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('通过 Git Clone 同步 HowToCook 图片');
  console.log('========================================\n');

  try {
    // 1. 克隆仓库
    cloneRepo();

    // 2. 扫描图片
    const imageMap = scanRepoImages();

    // 3. 匹配并复制
    const result = await matchAndCopyImages(imageMap);

    // 4. 清理（可选，注释掉可保留仓库用于后续更新）
    // cleanupRepo();

    console.log('\n提示：仓库目录保留在 backend/src/data/.howtocook-repo');
    console.log('如需清理可手动删除，或取消脚本中 cleanupRepo() 的注释');

    return result;
  } catch (error) {
    console.error('同步失败:', error.message);
    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
