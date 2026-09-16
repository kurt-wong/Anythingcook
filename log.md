# Amazing Food — 项目进程日志

> 流式追加，只增不删。每条带时间戳。

---

## 2026-09-16 23:45 第一性原理审计

### 系统本质

一个家庭的"今天吃什么"决策与执行系统。核心循环：

```
菜谱(外部同步) → 食客浏览/点菜 → 订单 → 饲养员做菜 → 扣库存 + 记饮食 → 统计
                                    ↑
                              周计划(提前规划)
```

四个问题决定架构是否合理：
1. 数据量多大？→ 菜谱 ~1000 道，订单每天 <10 单，饮食日志同量级
2. 并发多高？→ 家庭 2–5 台设备
3. 一致性要求？→ 最终一致即可（点了菜几秒后饲养员看到就行）
4. 可靠性要求？→ 高（每天用，坏了全家没饭吃决策依据）

结论：JSON 文件 + 轮询 + 无鉴权 是正确的最简架构。审计不质疑这四点。

### 逐层审计发现

#### 1. 食材匹配算法 — 存在原理性错误（P1）

`routes/orders.js`、`routes/recipes.js`、`routes/ingredients.js` 三处使用同一模式：

```js
key.includes(item) || item.includes(key)   // key=库存项, item=菜谱用料
```

实测复现（本机验证）：

```
库存 "盐"  vs 用料 "盐酥鸡"  → true  （误命中）
库存 "盐"  vs 用料 "椒盐"    → true  （误命中）
库存 "盐酥鸡" vs 用料 "盐"    → true  （误命中）
```

后果：
- 完成订单时 "盐酥鸡" 会错误扣减 "盐" 的库存（反向也会）
- 库存推荐分数虚高（"有盐" 就能匹配所有含"盐"字的菜）
- 随机推荐 preferStock 同理失真

根因：用字符串包含关系近似"是同一种食材"，但中文食材名是包含关系与语义关系不重合的语言。
"盐" 是 "盐酥鸡" 的子串，但不是它的原料关系。

正确做法（推荐）：**精确匹配 + 归一化 + 显式别名表**
1. 精确相等
2. 归一化后相等（去"的用量为"等后缀、全半角、繁简）
3. 别名表（`ingredientAlias.json`：`{"西红柿": "番茄", "青椒": "柿子椒"}`）人工维护
4. 三者都不中 → 视为不同食材

不做模糊包含。宁可漏匹配（提示缺货），不可错匹配（扣错库存更伤）。

#### 2. 饮食日志与份数脱节（P1）

`orders.js` `completeOrderSideEffects`：

```js
dietLogs.push({
  ...
  calories: recipe?.calories || null,   // ← 未乘 quantity
  // 且记录本身不含 quantity 字段
})
```

点 2 份番茄炒蛋：库存按 2 份扣（正确），饮食日志只记 1 条 1 份热量（错误）。
营养看板长期低估实际摄入。

修正：每条日志写入 `quantity`，`calories = (recipe.calories||0) * quantity`；或按 quantity 展开多条。

#### 3. 前端空态语义混淆（P1）

`GuestView.vue:108`：

```html
<div v-else-if="filteredRecipes.length === 0">
  <p>没有找到匹配的菜品</p>
</div>
```

三种完全不同的状态共用一个文案：
- 真的搜索无结果
- 后端没启动 / 网络断了（fetchRecipes 失败，recipes 恒为空数组）
- 后端返回空库

食客在后端挂掉时看到"没有找到匹配的菜品"，会以为是菜谱问题而不是服务问题。
对一个每天要用的家庭应用，这是可用性缺陷。

修正：增加 `error` 状态；`catch` 时置位；空态区分"搜索无结果 / 加载失败 / 库为空"。

#### 4. 917 张图片无懒加载（P1）

`GuestView.vue` 九宫格：

```html
<img :src="getImageUrl(recipe)" ... />
```

无 `loading="lazy"`。一次渲染 917 个 `<img>`，手机端首屏会请求大量图片。
本地图在 NAS 上单张不大，但 917 个请求对手机 CPU/内存/电量都是浪费。

修正：`loading="lazy"` 一个属性，零成本。配合分页或虚拟滚动可进一步优化，但 lazy 先解决主要矛盾。

#### 5. recipes.json 每请求全盘读取（P2）

统计：`readJson(FILES.recipes)` 在 routes/lib 中出现 19 处调用点。
每个请求都 `fs.readJson` 1007K 文件并 JSON.parse 出 ~476K 载荷。

在 i7 上 ~10ms，NAS 上可能 30–50ms。家庭并发下不是瓶颈，但是纯粹浪费——菜谱一天才变一次。

修正：内存缓存 + mtime 失效。
```js
let cache = null, cacheMtime = 0;
async function loadRecipes() {
  const mtime = (await fs.stat(RECIPES_FILE)).mtimeMs;
  if (cache && mtime === cacheMtime) return cache;
  cache = await fs.readJson(RECIPES_FILE);
  cacheMtime = mtime;
  return cache;
}
```
sync 脚本写文件后 mtime 变化自动失效，不需要额外失效逻辑。

#### 6. 无响应压缩（P2）

未装 `compression` 中间件。476K 的 JSON 在 WiFi 上明文传输。
gzip 后约 80–120K，节省 4–5 倍。两行改动（`npm i compression` + `app.use(compression())`）。

#### 7. 角色与购物车不持久化（P2）

`App.vue` 的 `currentRole`/`guestName` 和 `GuestView` 的 `cartItems` 都是纯内存 ref。
刷新页面全部丢失。家庭成员在自己手机上几乎固定是同一角色，每次都要重新选是反人性的。

修正：`localStorage` 持久化。选菜中途刷新也不丢。10 行以内。

#### 8. scripts/ 死代码约 1500 行（P3）

`backend/src/scripts/` 共 3155 行，其中明显是一次性迭代产物、已完成使命的：

| 文件 | 行数 | 判断 |
|------|------|------|
| cleanIngredients.js | 304 | 清洗已跑完 |
| deepCleanIngredients.js | 310 | 同上第二轮 |
| cleanIngredientNames.js | 47 | 同上 |
| cleanupStuff.js | 153 | 同上 |
| debugNames.js | 26 | 调试残留 |
| classifyIngredients.js | 278 | 分类已产出 ingredientCategoryMap.json |
| generateSvgPlaceholders.js | 149 | 占位图已生成 |
| downloadUnsplashImages.js | 258 | 已被 imageCache.js 取代 |
| runDownloadCached.js | 162 | 同上 |
| syncImagesFromGit.js | 243 | 图片已就位 |
| syncImagesFromWebsite.js | 175 | 同上 |

保留的只有：syncRecipes.js、importFromHowToCook.js、fetchTips.js、fetchData.js。
死代码的代价不是运行时，而是认知负担：下次读代码的人分不清哪些还活着。

建议：移到 `scripts/archive/` 或直接删除（git 历史里有）。

#### 9. Docker 镜像烘焙数据被挂载遮蔽（P3）

`Dockerfile.nas`：`COPY backend/ ./backend/` 把 1474 张图 + 1MB recipes 烘进镜像。
`docker-compose.nas.yml`：又把 `./backend/src/data` 挂载上去。

结果：镜像里那份数据永远不可见（被 mount 遮蔽），白白增大镜像体积和构建上下文传输。
NAS 部署实际用的是 tar 包里宿主机那份数据。

修正：`.dockerignore` 加 `backend/src/data`。镜像只含代码，数据由卷提供。
（需确认：全新部署时数据从哪来？目前 deploy-package 会带上 data，所以没问题。）

#### 10. CookView 934 行接近上限（P3）

三个 tab（订单/库存/周计划）挤在一个组件。未超 1000 行红线，但已到 93%。
按 coding-style 规范（推荐 200–500），建议下次触碰时拆成 OrdersTab / InventoryTab / PlanTab。
现在不动——YAGNI，且拆分有回归风险，收益是可读性不是正确性。

### 审计结论

架构判断全部维持（JSON 存储 / 轮询 / 无鉴权 / Express+Vue）。
真正的债在**算法正确性**（食材匹配）和**前端体验细节**（空态、懒加载、持久化），
不在架构。这些都可以在现有结构内修复，不需要重构。

建议处理顺序：
1. 食材精确匹配（含别名表）— 唯一影响数据正确性的
2. 饮食日志 quantity/热量
3. 前端空态区分 + lazy loading + localStorage
4. recipes 内存缓存 + compression
5. 清理 scripts 死代码 + dockerignore

---

## 2026-09-17 调研后修复 + 周食谱生成

### 调研结论

调研了四个 GitHub 项目：

- **HowToCook**：菜谱模板有严格的原料格式（`咖喱块 115g`），明确禁止"适量"。导入时丢失了每份用量，这是模糊匹配问题的根源
- **CookLikeHOC**：把配料（盐、油、酱油）与主料（肉、菜、蛋）分池。直接启发了调味品分池方案
- **CookHero**：重型 AI 平台，不借鉴架构。产品思路"周计划一键转饮食记录"值得后续考虑
- **cook**：已是数据源，无新可借鉴点

### 实施记录

**A. 食材精确匹配 + 调味品分池**

新建 `lib/match.js`（133 行）：
- `normalizeIngredient()`：去空格、去"的用量为"、去括号注释
- `findIngredientMatch()`：精确 → 归一化 → 别名（双向），废弃 `key.includes(item)`
- `isMainIngredient()`：基于 ingredientCategoryMap 六大主料分类，不在其中的视为调味品
- `scoreRecipe()`：只用主料算匹配度，调味品不参与
- `deductibleKeys()`：只返回可扣的主料键

新建 `data/ingredientAlias.json`：25 组别名（西红柿↔番茄、马铃薯↔土豆等）

三处路由替换：
- `routes/recipes.js`：recommend 用 `scoreRecipe`，preferStock 同理
- `routes/orders.js`：completeOrderSideEffects 用 `deductibleKeys`，只扣主料
- `routes/ingredients.js`：cook 端点同理

**B. 饮食日志 quantity 折算**

`orders.js`：每条日志写入 `quantity`，`calories = recipe.calories * quantity`

**C. 前端修复**

GuestView.vue：
- 空态三分：`loadError`（可重试）/ 库为空（提示同步）/ 搜索无结果（可清除筛选）
- `loading="lazy"` 加到九宫格图片
- 购物车 localStorage 持久化（`af-cart`），`addToCart`/`updateQuantity` 变动时保存

App.vue：
- 角色/食客名 localStorage 持久化（`af-role`/`af-guest-name`）
- 新增 `switchRole()` 函数，切换角色时清除持久化

**D. 性能**

`lib/recipesCache.js`：内存缓存 + `fs.stat` mtime 失效，替换 recipes.js/orders.js/ingredients.js/images.js 四处的 `readJson(FILES.recipes)`

`compression` 中间件加入 index.js

**E. 周食谱智能生成（新功能）**

`lib/mealPlanner.js`（187 行）算法：
1. 按 category/tags 分六池：早餐/荤/素/主食/汤/加餐
2. 每道菜用 `scoreRecipe` 打库存匹配分
3. 按匹配度加权随机选取（mulberry32 可复现 RNG）
4. 午/晚餐：荤（避开昨天同蛋白）+ 素 + 主食(60%) + 汤(30%)
5. 整周不重复；蛋白来源轮换（鸡/猪/牛/羊/水产）
6. 无库存时回退到均匀随机，仍保证荤素搭配

`POST /api/meal-plan/generate` 返回 `{weekStart, days, summary}`，不自动保存

CookView 周计划 tab 加"🎲 智能生成"按钮，调用后填充 planDraft，用户可手动调整再保存

冒烟验证：48 道菜无重复，每天早餐 1 + 午餐 2–3 + 晚餐 2–3 + 加餐 0–1，库存匹配率 79%

### 测试

51/51 通过。新增 match.test.js 23 用例，含"盐不匹配盐酥鸡"回归、调味品分池、别名匹配、deductibleKeys。

### 待做

- P3：scripts/ 死代码归档、.dockerignore 补 backend/src/data
- 推送 GitHub

---

## 2026-09-17 对抗性审查 + 三 CRITICAL bug 修复

### 审查方法

起服务做端到端实测，每个结论有 curl/脚本输出为证，不靠代码阅读推断。

### 发现的三个 CRITICAL bug

**BUG #1：推荐系统完全失效**

```
curl /api/recipes/recommend?count=20
→ 全部 20 条 score=1.00, matched=[]
```

根因：`isMainIngredient()` 只查 `ingredientCategoryMap.json`（54 个词），而菜谱 stuff 里的食材名（"鸡胸肉"、"花生米"、"干辣椒"）大多不在其中。`scoreRecipe` 对 mainStuff 为空的菜走"纯调味品"分支直接返回 score=1。917 道菜中 326 道的 stuff 完全不含 categoryMap 中的任何词 → 全部获得虚假满分。

**BUG #2：别名匹配在 recommend 中未生效**

```
库存设置为 番茄(5), 土豆(3)
curl /api/recipes/recommend?count=50
→ matched 含"西红柿"的菜: 0
→ matched 含"土豆"的菜: 0
```

根因：`isMainIngredient('番茄')` 返回 false（categoryMap 键是"西红柿"不是"番茄"）→ 被当调味品跳过 → `findIngredientMatch` 根本没机会执行。

**BUG #3：周食谱生成荤素搭配约束未生效**

```
tue dinner: 无,无,无,汤与粥     ← 三道菜 category 都是"无"
wed lunch:  荤菜,无,主食         ← 无素菜
14 餐中至少 6 餐缺少真正的素菜
```

根因：mealPlanner.js 把 576 道无 category 的菜默认归入 vegPool（"宁素不荤"），但它们的 category 是"无"不是"素菜"。

### 审查中排除的误判

| 项 | 结论 | 证据 |
|---|------|------|
| 饮食日志 quantity 折算 | 正确 | ASCII recipeId 测试：calories=3580（1790×2）✓ |
| 调味品不扣库存 | 正确 | 代码逻辑正确；"盐消失"是 shell 编码写入乱码键 |
| compression gzip | 生效 | 761723 → 201534 字节（3.8×） |
| 前端空态/lazy/localStorage | 存在 | 构建产物 grep 确认 |

### 修复

**新建 `data/seasonings.json`**：显式调味品白名单（约 100 词：盐/糖/酱油/醋/料酒/蚝油/油/香料/淀粉/水等）。替代"不在 categoryMap 里就是调味品"的反向逻辑。

**重写 `match.js` 的 `isMainIngredient()`**：
- 旧：在 54 词的 categoryMap 里找 → 95% 食材误判为调味品
- 新：不在调味品白名单里的都是主料
- 别名感知：先展开等价形式（自身 + 归一化 + 别名双向），任一形式不在白名单 → 是主料

**修改 `mealPlanner.js`**：
- 无 category 的菜归入 `otherPool` 而非 `vegPool`
- `buildMeal` 中 vegPool 取完回退 otherPool
- summary 加 otherPool 大小

### 修复验证（端到端）

```
=== BUG #1 ===
916/917 道菜有主料参与评分（修复前 326 道虚假满分）
recommend 返回真实 matched：["鸡肉","土豆"] 等

=== BUG #2 ===
库存"番茄" → 菜谱"西红柿" matched ✓
库存"土豆" → 菜谱"马铃薯" matched ✓

=== BUG #3 ===
14/14 餐有素菜（修复前 6 餐缺素）
43 道午晚餐去重后 43 道 ✓

=== 回归 ===
51/51 单元测试通过
```

---

## 2026-09-17 第二轮对抗性审查

### 方法

起服务端到端实测，每个结论有 curl/脚本输出为证。

### 上轮 3 CRITICAL bug 修复确认

| BUG | 验证方法 | 结果 |
|-----|---------|------|
| #1 推荐系统失效 | recommend 返回真实 matched；番茄炒蛋在不同库存下得分 0.33→0.67→1.00 | ✓ |
| #2 别名匹配失效 | 库存"番茄"→菜谱"西红柿" matched；"土豆"→"马铃薯" matched | ✓ |
| #3 荤素搭配失效 | 5 seeds × 14 餐：缺素 0/70，缺蛋白 2/70，无重复 | ✓ |

### 通过的审查项

| 项 | 证据 |
|---|------|
| compression gzip | 761723 → 201534 字节（3.8×） |
| recipesCache | 冷加载 5ms，热加载 0ms，同一对象引用 |
| lazy loading | 构建产物含 `loading:"lazy"` |
| localStorage | 构建产物含 `af-role`/`af-guest-name`/`af-cart` |
| 空态区分 | 构建产物含"无法连接服务器"/"菜谱库为空"/"清除筛选" |
| 做菜扣库存 | 鸡蛋 8→7，番茄 4→3，葱花 notFound |
| 完成订单扣库存 | 鸡蛋 7→5（quantity=2），番茄 3→1 |
| 调味品分池 | 盐/生抽/食用油/白糖/料酒不参与评分不扣库存 |
| 单元测试 | 51/51 通过 |

### 排除的误判

- 饮食日志 calories=null：番茄炒蛋数据本身 calories 字段为 null，代码正确
- 螺蛳粉 stuff=["水"]：数据本身如此，1/917 道菜
- 前 100 条 recommend 全 score=1.00：推荐按分数降序排列，满分菜排前面，正确

### 本轮发现的 LOW 级问题

| 问题 | 说明 |
|------|------|
| matched 数组含原始噪音 | "鸡蛋的用量为"而非归一化后的"鸡蛋"；scoreRecipe 推入原始 item 而非归一化形式 |
| 螺蛳粉走纯调味品分支拿满分 | stuff=["水"]，水在调味品白名单里，主料为空→满分 |
| seed=2026 时 2/14 餐缺蛋白 | otherPool 回退时可能选到无蛋白的菜，概率性边缘情况 |

### 结论

本轮未发现新的 CRITICAL 或 HIGH 问题。项目处于健康状态。

---

## 2026-09-17 三个 LOW 级问题修复

### LOW #1：matched 数组含原始噪音

`scoreRecipe` 的 `matched.push(item)` 推入原始 item（如"鸡蛋的用量为"），改为推入归一化形式。

```
修复前: matched=["鸡蛋的用量为"]
修复后: matched=["鸡蛋"]
```

### LOW #2：螺蛳粉走纯调味品分支拿满分

`scoreRecipe` 对 mainStuff 为空的菜谱返回 `score: 1`，改为返回 `score: 0`。

```
修复前: scoreRecipe(['水'], []) → score=1
修复后: scoreRecipe(['水'], []) → score=0
```

### LOW #3：mealPlanner 缺蛋白

三处修复：
1. `proteinSource` 正则扩展：鸭/鹅/腊肠/腊肉/火腿/蟹/蛤/蚝/鱿鱼
2. 荤位选取：`meatPool` 过滤掉无蛋白的菜
3. otherPool 回退：只选有蛋白的菜

```
修复前: seed=2026 缺蛋白 2/14
修复后: 5 seeds × 14 餐 = 70/70 全部有蛋白
```

### 验证

- 单元测试 51/51 通过
- 端到端 5 seeds 验证 70/70 餐有蛋白

---
