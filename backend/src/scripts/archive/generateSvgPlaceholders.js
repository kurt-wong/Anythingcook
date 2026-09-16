const fs = require('fs');
const path = require('path');

const RECIPES_FILE = path.join(__dirname, '../data/recipes.json');
const IMAGES_DIR = path.join(__dirname, '../data/images');
const recipes = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'));

const needNewSvg = recipes.filter(r => r.imageUrl && r.imageUrl.endsWith('.svg'));
console.log('需要重新生成:', needNewSvg.length);

function analyzeDish(name, category) {
  const features = { colors: [], shapes: [] };
  if (/肉|鸡|鸭|牛|猪|羊|排骨|肘|蹄|翅|腿|里脊|五花|肥牛|牛腩|牛柳|蛙/.test(name)) {
    features.colors = ['#8B4513','#D2691E','#CD853F','#A0522D']; features.shapes = ['meat'];
  }
  if (/虾|鱼|蟹|贝|蚝|鳝|鲈|鲤|鲫/.test(name)) {
    features.colors = ['#FF6347','#FF7F50','#20B2AA','#4682B4']; features.shapes = ['seafood'];
  }
  if (/菜|瓜|菇|笋|藕|豆|茄|椒|芹|韭|菠|莴|萝卜|土豆|番茄|黄瓜|白菜|包菜/.test(name)) {
    features.colors = ['#228B22','#32CD32','#90EE90','#FF6347']; features.shapes = ['vegetable'];
  }
  if (/蛋/.test(name)) {
    features.colors = ['#FFD700','#FFF8DC','#FFA500']; features.shapes = ['egg'];
  }
  if (/面|饭|饺|饼|粥|粉|米|面包|吐司/.test(name)) {
    features.colors = ['#DEB887','#F5DEB3','#D2B48C']; features.shapes = ['staple'];
  }
  if (/汤|羹/.test(name)) {
    features.colors = ['#FFA07A','#FFDAB9','#FFE4B5']; features.shapes = ['soup'];
  }
  if (/茶|咖啡|奶|汁|酒|饮|特调|冰/.test(name)) {
    features.colors = ['#DDA0DD','#9370DB','#87CEEB']; features.shapes = ['drink'];
  }
  if (/蛋糕|甜|冰淇淋|奶冻|饼干|挞|布丁|慕斯/.test(name)) {
    features.colors = ['#FFB6C1','#FF69B4','#FF1493']; features.shapes = ['dessert'];
  }
  if (/凉拌|沙拉/.test(name)) {
    features.colors = ['#98FB98','#00FA9A','#7CFC00']; features.shapes = ['cold'];
  }
  if (/炸|烤|煎|烙/.test(name)) {
    features.colors = ['#DAA520','#B8860B','#CD853F']; features.shapes = ['fried'];
  }
  if (features.colors.length === 0) {
    const catColors = {
      '家常菜':['#FF8C00','#FFA500','#FFD700'],'素菜':['#228B22','#32CD32','#90EE90'],
      '荤菜':['#8B4513','#A0522D','#CD853F'],'水产':['#4682B4','#20B2AA','#5F9EA0'],
      '早餐':['#FFD700','#FFA500','#FFE4B5'],'主食':['#DEB887','#D2B48C','#F5DEB3'],
      '汤与粥':['#FFA07A','#FFDAB9','#FFE4B5'],'饮品':['#DDA0DD','#9370DB','#87CEEB'],
      '甜品':['#FFB6C1','#FF69B4','#FF1493'],'酱料和其它材料':['#CD5C5C','#DC143C','#B22222'],
      '半成品加工':['#DAA520','#B8860B','#F4A460'],
    };
    features.colors = catColors[category] || catColors['家常菜'];
  }
  return features;
}

function generateDishSvg(name, category, features) {
  const c = features.colors;
  const displayName = name.length > 10 ? name.slice(0, 10) + '…' : name;
  const shape = features.shapes[0] || 'default';

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">';
  svg += '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">';
  svg += '<stop offset="0%" style="stop-color:' + c[0] + '22"/><stop offset="100%" style="stop-color:' + c[1] + '11"/>';
  svg += '</linearGradient><radialGradient id="glow" cx="50%" cy="40%" r="50%">';
  svg += '<stop offset="0%" style="stop-color:' + c[0] + '33"/><stop offset="100%" style="stop-color:transparent"/>';
  svg += '</radialGradient></defs>';
  svg += '<rect width="400" height="300" fill="#fafafa" rx="12"/>';
  svg += '<rect width="400" height="300" fill="url(#bg)" rx="12"/>';
  svg += '<ellipse cx="200" cy="130" rx="120" ry="80" fill="url(#glow)"/>';
  svg += '<ellipse cx="200" cy="160" rx="100" ry="30" fill="white" opacity="0.9"/>';
  svg += '<ellipse cx="200" cy="155" rx="90" ry="25" fill="white"/>';
  svg += '<ellipse cx="200" cy="155" rx="85" ry="22" fill="' + c[0] + '15"/>';

  if (shape === 'meat') {
    svg += '<rect x="160" y="130" width="35" height="25" rx="5" fill="' + c[0] + '" opacity="0.8"/>';
    svg += '<rect x="195" y="125" width="30" height="28" rx="5" fill="' + c[1] + '" opacity="0.8"/>';
    svg += '<rect x="175" y="145" width="40" height="20" rx="5" fill="' + c[2] + '" opacity="0.7"/>';
    svg += '<ellipse cx="185" cy="138" rx="8" ry="4" fill="white" opacity="0.3"/>';
  } else if (shape === 'seafood') {
    if (/虾/.test(name)) {
      svg += '<path d="M170,150 Q185,125 210,135 Q230,145 220,160 Q200,170 180,160 Z" fill="' + c[0] + '" opacity="0.8"/>';
      svg += '<circle cx="215" cy="138" r="2" fill="#333"/>';
    } else {
      svg += '<ellipse cx="200" cy="145" rx="45" ry="18" fill="' + c[0] + '" opacity="0.8"/>';
      svg += '<polygon points="245,145 265,135 265,155" fill="' + c[1] + '" opacity="0.8"/>';
      svg += '<circle cx="175" cy="142" r="3" fill="#333" opacity="0.6"/>';
    }
  } else if (shape === 'vegetable') {
    svg += '<ellipse cx="185" cy="145" rx="20" ry="12" fill="' + c[0] + '" opacity="0.8" transform="rotate(-20 185 145)"/>';
    svg += '<ellipse cx="215" cy="140" rx="18" ry="10" fill="' + c[1] + '" opacity="0.8" transform="rotate(15 215 140)"/>';
    svg += '<ellipse cx="200" cy="155" rx="22" ry="11" fill="' + c[2] + '" opacity="0.7" transform="rotate(-5 200 155)"/>';
  } else if (shape === 'egg') {
    svg += '<ellipse cx="200" cy="145" rx="28" ry="20" fill="#FFFACD" opacity="0.9"/>';
    svg += '<ellipse cx="200" cy="145" rx="15" ry="12" fill="' + c[0] + '" opacity="0.8"/>';
    svg += '<ellipse cx="195" cy="142" rx="5" ry="3" fill="white" opacity="0.4"/>';
  } else if (shape === 'staple') {
    svg += '<ellipse cx="200" cy="148" rx="40" ry="18" fill="' + c[0] + '" opacity="0.8"/>';
    svg += '<ellipse cx="195" cy="142" rx="30" ry="14" fill="' + c[1] + '" opacity="0.7"/>';
    svg += '<ellipse cx="205" cy="145" rx="25" ry="12" fill="' + c[2] + '" opacity="0.6"/>';
  } else if (shape === 'soup') {
    svg += '<ellipse cx="200" cy="150" rx="42" ry="22" fill="' + c[0] + '" opacity="0.6"/>';
    svg += '<ellipse cx="200" cy="148" rx="38" ry="18" fill="' + c[1] + '" opacity="0.5"/>';
    svg += '<path d="M185,125 Q188,115 185,105" stroke="#ccc" stroke-width="2" fill="none" opacity="0.5"/>';
    svg += '<path d="M200,120 Q203,108 200,98" stroke="#ccc" stroke-width="2" fill="none" opacity="0.5"/>';
  } else if (shape === 'drink') {
    svg += '<rect x="185" y="110" width="30" height="55" rx="3" fill="' + c[0] + '" opacity="0.6"/>';
    svg += '<rect x="187" y="115" width="26" height="45" rx="2" fill="' + c[1] + '" opacity="0.5"/>';
    svg += '<line x1="210" y1="100" x2="205" y2="155" stroke="#FF69B4" stroke-width="3" opacity="0.7"/>';
  } else if (shape === 'dessert') {
    svg += '<rect x="175" y="130" width="50" height="30" rx="5" fill="' + c[0] + '" opacity="0.8"/>';
    svg += '<rect x="175" y="125" width="50" height="12" rx="3" fill="' + c[1] + '" opacity="0.9"/>';
    svg += '<circle cx="190" cy="122" r="4" fill="#FF1493" opacity="0.7"/>';
    svg += '<circle cx="210" cy="122" r="4" fill="#FF69B4" opacity="0.7"/>';
  } else if (shape === 'fried') {
    svg += '<ellipse cx="190" cy="145" rx="18" ry="14" fill="' + c[0] + '" opacity="0.8"/>';
    svg += '<ellipse cx="215" cy="142" rx="16" ry="12" fill="' + c[1] + '" opacity="0.8"/>';
    svg += '<ellipse cx="200" cy="155" rx="20" ry="10" fill="' + c[2] + '" opacity="0.7"/>';
  } else {
    svg += '<circle cx="190" cy="145" r="16" fill="' + c[0] + '" opacity="0.8"/>';
    svg += '<circle cx="215" cy="142" r="14" fill="' + c[1] + '" opacity="0.8"/>';
    svg += '<circle cx="200" cy="158" r="12" fill="' + c[2] + '" opacity="0.7"/>';
  }

  svg += '<text x="200" y="220" font-family="system-ui,sans-serif" font-size="20" font-weight="600" fill="#1d1d1f" text-anchor="middle">' + displayName + '</text>';
  svg += '<text x="200" y="245" font-family="system-ui,sans-serif" font-size="12" fill="#999" text-anchor="middle">' + (category || '家常菜') + '</text>';
  svg += '<rect x="170" y="260" width="60" height="2" rx="1" fill="' + c[0] + '" opacity="0.4"/>';
  svg += '</svg>';
  return svg;
}

let generated = 0;
for (const recipe of needNewSvg) {
  const features = analyzeDish(recipe.name, recipe.category);
  const svg = generateDishSvg(recipe.name, recipe.category, features);
  const safeName = recipe.name.replace(/[/\\:*?"<>|]/g, '_').trim();
  fs.writeFileSync(path.join(IMAGES_DIR, safeName + '.svg'), svg, 'utf8');
  const idx = recipes.findIndex(r => r.id === recipe.id);
  if (idx !== -1) recipes[idx].imageUrl = '/api/local-image/' + safeName + '.svg';
  generated++;
}

fs.writeFileSync(RECIPES_FILE, JSON.stringify(recipes, null, 2));
console.log('重新生成:', generated);

const final = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf8'));
console.log('JPG 真实照片:', final.filter(r => r.imageUrl && r.imageUrl.endsWith('.jpg')).length);
console.log('SVG 风格插图:', final.filter(r => r.imageUrl && r.imageUrl.endsWith('.svg')).length);
console.log('总菜谱:', final.length);
