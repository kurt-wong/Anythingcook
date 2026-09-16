const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const recipes = fs.readJsonSync(path.join(DATA_DIR, 'recipes.json'));
const cache = fs.readJsonSync(path.join(DATA_DIR, 'image-cache.json'));

const cacheNames = Object.keys(cache).filter(k => cache[k]);
const recipeNames = recipes.map(r => r.name);
const noLocalImage = recipes.filter(r => !r.imageUrl || !r.imageUrl.startsWith('/api/local-image/'));

const matched = cacheNames.filter(n => recipeNames.includes(n));

const result = {
  recipeCount: recipes.length,
  cacheCount: cacheNames.length,
  noLocalImageCount: noLocalImage.length,
  matchedCount: matched.length,
  cacheNamesSample: cacheNames.slice(0, 5),
  recipeNamesSample: recipeNames.slice(0, 5),
  noLocalNamesSample: noLocalImage.slice(0, 5).map(r => r.name),
  matchedSample: matched.slice(0, 5)
};

fs.writeFileSync(path.join(DATA_DIR, 'debug-output.json'), JSON.stringify(result, null, 2));
console.log('Done - check debug-output.json');
