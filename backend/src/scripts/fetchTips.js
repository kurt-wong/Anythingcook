/**
 * 拉取 HowToCook 烹饪技巧（tips/）到本地
 *
 * 目录结构：
 *   tips/*.md          基础（厨房准备、如何洗碗、如何选择现在吃什么）
 *   tips/learn/*.md    学习（焯水、蒸、煮、腌、凉拌、炒与煎、各厨电）
 *   tips/advanced/*.md 进阶（油温、糖色、专业术语、辅料技巧）
 *
 * 通过 api.github.com 列目录（直连可达），内容经 raw.githubusercontent.com
 * 下载（按需走 HTTP_PROXY 代理，与 syncRecipes 一致）。
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const TIPS_DIR = path.join(DATA_DIR, 'tips');
const INDEX_FILE = path.join(TIPS_DIR, 'index.json');

const API_BASE = 'https://api.github.com/repos/Anduin2017/HowToCook/contents';
const PROXY_URL = process.env.HTTP_PROXY || process.env.http_proxy || '';
const REQUEST_DELAY_MS = 200;

// 目录 -> 展示分组
const GROUPS = [
  { dir: 'tips', group: '基础', label: '厨房基础' },
  { dir: 'tips/learn', group: '学习', label: '技法学习' },
  { dir: 'tips/advanced', group: '进阶', label: '进阶技巧' },
];

fs.ensureDirSync(TIPS_DIR);

function axiosConfig() {
  const config = {
    timeout: 15000,
    headers: {
      'User-Agent': 'Amazing-Food-App/2.0',
      Accept: 'application/vnd.github.v3+json',
    },
  };
  if (PROXY_URL) {
    try {
      const u = new URL(PROXY_URL);
      config.proxy = { host: u.hostname, port: parseInt(u.port, 10) || 80 };
    } catch (e) {
      // 代理地址无效则直连
    }
  }
  return config;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** 文件名 -> slug（去扩展名，保留中文） */
function slugify(filename) {
  return filename.replace(/\.md$/i, '');
}

/** 从 markdown 提取一级标题作为展示名；缺失则用文件名 */
function extractTitle(content, fallback) {
  const m = String(content).match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

/** 列出某个 tips 子目录下的 md 文件 */
async function listDir(dir) {
  try {
    const res = await axios.get(`${API_BASE}/${dir}`, axiosConfig());
    return (res.data || []).filter((f) => f.name && f.name.endsWith('.md'));
  } catch (e) {
    console.error(`[tips] 列目录失败 ${dir}: ${e.message}`);
    return [];
  }
}

/** 下载单个 md 文件内容 */
async function downloadRaw(downloadUrl) {
  const res = await axios.get(downloadUrl, {
    ...axiosConfig(),
    responseType: 'text',
    timeout: 20000,
  });
  return res.data;
}

/** 主流程 */
async function main() {
  console.log('========================================');
  console.log('拉取 HowToCook 烹饪技巧');
  console.log('========================================\n');

  const index = [];
  let failCount = 0;

  for (const { dir, group, label } of GROUPS) {
    console.log(`[${group}] 列出 ${dir} ...`);
    const files = await listDir(dir);
    console.log(`[${group}] 共 ${files.length} 篇`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const slug = slugify(file.name);
      try {
        const content = await downloadRaw(file.download_url);
        const title = extractTitle(content, slug);
        const localFile = `${slug}.md`;
        await fs.writeFile(path.join(TIPS_DIR, localFile), content, 'utf8');
        index.push({ slug, title, group, groupLabel: label, file: localFile });
        console.log(`  ✓ ${title}`);
      } catch (e) {
        failCount++;
        console.error(`  ✗ ${file.name}: ${e.message}`);
      }
      await delay(REQUEST_DELAY_MS);
    }
  }

  await fs.writeJson(
    INDEX_FILE,
    { updatedAt: new Date().toISOString(), tips: index },
    { spaces: 2 }
  );

  console.log('\n========================================');
  console.log(`完成：共 ${index.length} 篇，失败 ${failCount}`);
  console.log(`索引: ${INDEX_FILE}`);
  console.log('========================================');
  return index;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('拉取失败:', err.message);
    process.exit(1);
  });
}

module.exports = { main, slugify, extractTitle };
