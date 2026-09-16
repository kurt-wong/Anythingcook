require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const RECIPES_FILE = path.join(__dirname, '../data/recipes.json');
const IMAGES_DIR = path.join(__dirname, '../data/images');
const CACHE_FILE = path.join(__dirname, '../data/image-cache.json');
const PROGRESS_FILE = path.join(__dirname, '../data/.download-progress.json');

const ENGLISH_MAP = {
  '番茄炒蛋': 'scrambled eggs tomato',
  '红烧肉': 'braised pork belly chinese',
  '宫保鸡丁': 'kung pao chicken',
  '麻婆豆腐': 'mapo tofu',
  '糖醋排骨': 'sweet sour ribs chinese',
  '回锅肉': 'twice cooked pork sichuan',
  '鱼香肉丝': 'shredded pork sichuan',
  '水煮鱼': 'sichuan boiled fish',
  '酸辣土豆丝': 'shredded potato stir fry',
  '蛋炒饭': 'egg fried rice',
  '扬州炒饭': 'yangzhou fried rice',
  '炒面': 'stir fried noodles chinese',
  '饺子': 'chinese dumplings',
  '包子': 'steamed buns chinese',
  '馒头': 'steamed bread chinese',
  '粥': 'congee rice porridge',
  '汤面': 'noodle soup chinese',
  '炒饭': 'fried rice chinese',
  '蒸蛋': 'steamed egg custard',
  '煎蛋': 'fried egg sunny side up',
  '烤鸭': 'roast duck chinese',
  '北京烤鸭': 'peking duck',
  '白切鸡': 'white cut chicken cantonese',
  '黄焖鸡': 'braised chicken clay pot',
  '可乐鸡翅': 'cola chicken wings',
  '红烧鸡翅': 'braised chicken wings',
  '红烧鱼': 'braised fish chinese',
  '清蒸鱼': 'steamed fish cantonese',
  '红烧茄子': 'braised eggplant chinese',
  '地三鲜': 'stir fried potato eggplant pepper',
  '干煸四季豆': 'dry fried green beans sichuan',
  '手撕包菜': 'hand torn cabbage stir fry',
  '蒜蓉西兰花': 'garlic broccoli',
  '凉拌黄瓜': 'cucumber salad chinese',
  '皮蛋豆腐': 'century egg tofu',
  '小炒肉': 'hunan pork stir fry',
  '辣椒炒肉': 'pepper pork stir fry',
  '青椒肉丝': 'green pepper shredded pork',
  '木须肉': 'moo shu pork',
  '白灼虾': 'boiled shrimp chinese',
  '蒜蓉虾': 'garlic shrimp',
  '油焖大虾': 'braised prawns chinese',
  '清蒸鲈鱼': 'steamed sea bass',
  '酸菜鱼': 'sauerkraut fish sichuan',
  '水煮肉片': 'sichuan boiled pork slices',
  '口水鸡': 'mouthwatering chicken sichuan',
  '蛋挞': 'egg tart',
  '月饼': 'mooncake chinese',
  '汤圆': 'tangyuan glutinous rice ball',
  '豆腐脑': 'tofu pudding',
  '豆浆': 'soy milk',
  '油条': 'youtiao chinese fried dough',
  '煎饼': 'jianbing chinese crepe',
  '葱油饼': 'scallion pancake',
  '手抓饼': 'chinese layered pancake',
  '烧饼': 'shaobing sesame flatbread',
  '肉夹馍': 'roujiamo chinese burger',
  '凉皮': 'liangpi cold noodle',
  '酸辣粉': 'hot and sour sweet potato noodle',
  '螺蛳粉': 'luosifen river snail noodle',
  '重庆小面': 'chongqing spicy noodle',
  '兰州拉面': 'lanzhou beef noodle soup',
  '刀削面': 'knife shaved noodle',
  '炸酱面': 'zhajiangmian soybean paste noodle',
  '担担面': 'dandan noodle sichuan',
  '云吞面': 'wonton noodle soup',
  '叉烧': 'char siu bbq pork',
  '烧鹅': 'roast goose cantonese',
  '东坡肉': 'dongpo braised pork belly',
  '扣肉': 'steamed pork belly chinese',
  '狮子头': 'lion head meatball chinese',
  '糖醋里脊': 'sweet sour pork tenderloin',
  '锅包肉': 'guo bao rou crispy pork',
  '烤羊肉串': 'lamb skewers chinese bbq',
  '涮羊肉': 'hot pot lamb slices',
  '羊肉汤': 'lamb soup chinese',
  '牛肉面': 'beef noodle soup chinese',
  '番茄牛腩': 'tomato beef brisket stew',
  '土豆炖牛肉': 'potato beef stew',
  '咖喱牛肉': 'curry beef',
  '黑椒牛排': 'black pepper steak',
  '牛排': 'steak grilled',
  '炸鸡': 'fried chicken crispy',
  '披萨': 'pizza',
  '意面': 'pasta spaghetti',
  '三明治': 'sandwich',
  '沙拉': 'salad fresh',
  '冰淇淋': 'ice cream',
  '蛋糕': 'cake dessert',
  '饼干': 'cookies baked',
  '面包': 'bread fresh baked',
  '吐司': 'toast bread',
  '布丁': 'pudding dessert',
  '奶茶': 'milk tea bubble tea',
  '咖啡': 'coffee cup',
  '柠檬水': 'lemonade fresh',
  '酸奶': 'yogurt',
};

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': 'Amazing-Food-App/1.0', ...headers },
      timeout: 15000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location, headers).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode === 403) { reject(new Error('RATE_LIMITED')); return; }
      if (res.statusCode !== 200) { reject(new Error('HTTP_' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': 'Amazing-Food-App/1.0', 'Accept-Version': 'v1', ...headers },
      timeout: 15000,
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 403) { reject(new Error('RATE_LIMITED')); return; }
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sanitizeFilename(name) { return name.replace(/[/\\:*?"<>|]/g, '_').trim(); }

async function searchAndDownload(recipeName) {
  const searchTerms = [];
  if (ENGLISH_MAP[recipeName]) searchTerms.push(ENGLISH_MAP[recipeName]);
  const baseName = recipeName.replace(/[（(].*?[）)]/g, '').trim();
  if (ENGLISH_MAP[baseName]) searchTerms.push(ENGLISH_MAP[baseName]);
  searchTerms.push(baseName + ' chinese food');
  searchTerms.push(recipeName);

  for (const query of searchTerms) {
    try {
      const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
      const result = await httpGetJson(apiUrl, { 'Authorization': `Client-ID ${ACCESS_KEY}` });
      if (result.results && result.results.length > 0) {
        const photo = result.results[0];
        const data = await httpGet(photo.urls.small);
        if (data && data.length > 2000) return { data, photoId: photo.id, query };
      }
    } catch (e) {
      if (e.message === 'RATE_LIMITED') throw e;
    }
  }
  return null;
}

async function main() {
  const recipes = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'));
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
  const progress = fs.existsSync(PROGRESS_FILE) ? JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) : { completed: [], failed: [] };

  const needDownload = recipes.filter(r =>
    r.imageUrl && r.imageUrl.endsWith('.svg') && !progress.completed.includes(r.name)
  );

  console.log('=== Unsplash 批量配图下载 ===');
  console.log('需要下载:', needDownload.length);
  console.log('已完成:', progress.completed.length);
  console.log('限速: 50次/小时，每次间隔75秒');
  console.log('');

  let downloaded = 0;
  let skipped = 0;
  let rateLimited = false;

  for (let i = 0; i < needDownload.length; i++) {
    const recipe = needDownload[i];
    const label = `[${i + 1}/${needDownload.length}]`;

    if (i > 0) await sleep(2000);

    try {
      const result = await searchAndDownload(recipe.name);
      if (result) {
        const safeName = sanitizeFilename(recipe.name);
        fs.writeFileSync(path.join(IMAGES_DIR, safeName + '.jpg'), result.data);
        const idx = recipes.findIndex(r => r.id === recipe.id);
        if (idx !== -1) recipes[idx].imageUrl = '/api/local-image/' + safeName + '.jpg';
        cache[recipe.name] = 'https://images.unsplash.com/photo-' + result.photoId;
        progress.completed.push(recipe.name);
        downloaded++;
        console.log(`${label} ✓ ${recipe.name} (${result.query})`);
      } else {
        progress.failed.push(recipe.name);
        skipped++;
        console.log(`${label} ✗ ${recipe.name} - 未找到`);
      }
    } catch (e) {
      if (e.message === 'RATE_LIMITED') {
        console.log(`\n⚠ 速率限制，已下载 ${downloaded} 张，进度已保存`);
        rateLimited = true;
        break;
      }
      progress.failed.push(recipe.name);
      skipped++;
      console.log(`${label} ✗ ${recipe.name} - ${e.message}`);
    }

    if ((downloaded + skipped) % 5 === 0) {
      fs.writeFileSync(RECIPES_FILE, JSON.stringify(recipes, null, 2));
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      console.log(`--- 进度已保存 (${downloaded}下载, ${skipped}跳过) ---`);
    }
  }

  fs.writeFileSync(RECIPES_FILE, JSON.stringify(recipes, null, 2));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  console.log('\n========================================');
  console.log('本次下载:', downloaded, '| 本次跳过:', skipped);
  console.log('速率限制:', rateLimited ? '是（稍后重跑继续）' : '否');
  const final = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'));
  console.log('JPG 真实照片:', final.filter(r => r.imageUrl && r.imageUrl.endsWith('.jpg')).length);
  console.log('SVG 占位图:', final.filter(r => r.imageUrl && r.imageUrl.endsWith('.svg')).length);
}

main().catch(console.error);
