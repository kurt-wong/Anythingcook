# Amazing Food — 项目状态

> 快照式状态文档。每次状态变更在文末按时间戳追加，不删除历史。

## 2026-09-16 对抗性审查后 + 第一性原理审计快照

### 定位

家庭局域网点菜系统。两个角色：食客（浏览/点菜）、饲养员（接单/库存/周计划）。数据用 JSON 文件存储，零数据库依赖，部署到群晖 NAS。

### 代码规模

| 部分 | 行数 | 说明 |
|------|------|------|
| backend/src/index.js | 94 | 装配入口 |
| backend/src/lib/ (4 文件) | 394 | dates / store / respond / imageCache |
| backend/src/routes/ (9 文件) | 999 | 全部 API |
| backend 后端合计 | 1487 | 拆分前为单文件 1637 行 |
| backend/src/scripts/ | 3155 | 一次性数据脚本（约半数已成死代码） |
| frontend/src/ | 2304 | 4 组件 + 样式 |
| 单元测试 | 3 个文件 / 28 用例 | dates、store、orders 校验 |

### 数据

| 文件 | 大小 | 性质 |
|------|------|------|
| recipes.json | 1007K（有效载荷约 476K） | 只读为主，每日 cron 同步 |
| image-cache.json | 153K | 名称→Unsplash URL |
| ingredients.json | 2.1K | 有状态，频繁读改写 |
| orders.json / dietLog.json / mealPlan.json | 小 | 有状态 |
| images/ | 1474 个文件 | 本地图 |
| tips/ | 18 篇 md | 只读 |

### 已修复（本日对抗性审查）

- HIGH：H1 数据卷挂载路径、H2/H3 时区（weekStart 与饮食日志日期）、H4 订单 quantity 校验
- MEDIUM：M1 字段空值保护、M2 二次解码、M3 库存归零语义、M4 图片缓存 O(n²)、M5 markdown XSS、M6 维护接口令牌、M7 JSON 写串行锁
- LOW：L1–L6 全部处理
- 治理：后端拆分、28 测试、git init、推送至 github.com/kurt-wong/Anythingcook（commit bf43dd8）

### 审计发现的遗留问题（待处理）

按第一性原理审计，详见 log.md 同日条目。优先级：

| 级别 | 问题 |
|------|------|
| P1 正确性 | 食材模糊匹配误命中（"盐"匹配"盐酥鸡"） |
| P1 正确性 | 饮食日志未按 quantity 折算热量/份数 |
| P1 可用性 | 前端加载失败与"无匹配菜品"共用同一空态 |
| P1 性能 | 917 张菜谱图无 lazy loading |
| P2 性能 | recipes.json 每请求全量读盘解析（约 19 处调用点） |
| P2 性能 | 无 gzip 压缩 |
| P2 可用性 | 角色/购物车不持久化，刷新即丢 |
| P3 卫生 | scripts/ 约 1500 行死代码；Docker 镜像烘焙数据被挂载遮蔽 |

### 技术判断（第一性原理结论，维持不变）

- JSON 文件存储：家庭并发 <10、年订单量 <1万，正确选择，不上 SQLite
- 轮询而非 SSE/WebSocket：LAN 2–3 台设备，正确选择
- Express + Vue3 SPA：与 Apple 风格交互复杂度匹配，不过度
- 无鉴权 + ADMIN_TOKEN 护维护接口：家庭 LAN 场景合理

---

## 2026-09-17 调研后修复 + 周食谱生成 完成快照

### 本轮完成

**P1 食材精确匹配（借鉴 HowToCook 精确命名 + CookLikeHOC 配料分池）**
- 新建 `lib/match.js`：精确 → 归一化 → 别名表，废弃子串包含
- 新建 `data/ingredientAlias.json`：25 组常见同物异名
- 调味品分池：不在 ingredientCategoryMap 六大主料分类里的食材不参与推荐评分、不扣库存
- 回归测试："盐不匹配盐酥鸡"通过

**P1 饮食日志 quantity 折算**
- 每条日志写入 `quantity` 字段，`calories` 乘以份数

**P1 前端修复**
- 空态区分三种：加载失败（可重试）/ 库为空 / 搜索无结果
- 图片 `loading="lazy"`
- localStorage 持久化角色（`af-role`）、食客名（`af-guest-name`）、购物车（`af-cart`）

**P2 性能**
- `lib/recipesCache.js`：内存缓存 + mtime 失效，替换全部 19 处读盘点
- `compression` 中间件

**新功能：周食谱智能生成**
- `lib/mealPlanner.js`：基于库存匹配度 + 健康配比（荤素搭配、蛋白轮换、整周不重复）
- `POST /api/meal-plan/generate`：返回 `{weekStart, days, summary}`
- CookView 周计划 tab 新增"🎲 智能生成"按钮
- 冒烟验证：48 道菜无重复，库存匹配率 79%（当前库存全为 0 时的基线）

### 测试与构建

- 51/51 单元测试通过（新增 match.js 23 用例）
- 前端 build 通过
- 后端加载正常

### 代码规模变化

| 部分 | 上轮 | 本轮 |
|------|------|------|
| backend/src/lib/ | 4 文件 / 394 行 | 6 文件 / ~700 行（+match.js +recipesCache.js +mealPlanner.js） |
| 单元测试 | 28 用例 | 51 用例 |
| frontend/src/ | 2304 行 | ~2350 行 |

### 待处理

- P3：scripts/ 死代码归档、.dockerignore 补 backend/src/data
- 推送至 GitHub

---

## 2026-09-17 对抗性审查 + 三 CRITICAL bug 修复

### 对抗性审查结论

对上轮全部任务做了端到端实测（非代码阅读推断），发现 3 个 CRITICAL bug，全部指向同一根因：`isMainIngredient()` 判定范围太窄（只查 54 词的 categoryMap）。

| BUG | 症状 | 根因 |
|-----|------|------|
| #1 | recommend 全部 score=1.00 matched=[] | 326/917 道菜的 stuff 不含 categoryMap 任何词 → 走"纯调味品"分支返回满分 |
| #2 | 别名库存（番茄/土豆）被推荐忽略 | isMainIngredient 不查别名表 → 被当调味品跳过 |
| #3 | 周食谱 14 餐中 6 餐缺素菜 | 576 道无 category 的菜被默认归入 vegPool |

### 修复方案

1. **新建 `data/seasonings.json`**：显式调味品白名单（约 100 词），替代"不在 categoryMap 里就是调味品"的反向逻辑
2. **重写 `match.js` 的 `isMainIngredient()`**：不在调味品白名单里的一律是主料；检查别名等价形式
3. **修改 `mealPlanner.js`**：无 category 的菜归入 `otherPool` 而非 `vegPool`；buildMeal 中 vegPool 取完回退 otherPool

### 修复验证（端到端）

| 验证项 | 结果 |
|--------|------|
| recommend 返回真实 matched | ✓ 916/917 道菜有主料参与评分（修复前 326 道虚假满分） |
| 别名匹配 | ✓ 库存"番茄"匹配菜谱"西红柿"；"土豆"匹配"马铃薯" |
| 周食谱荤素搭配 | ✓ 14/14 餐有素菜（修复前 6 餐缺素） |
| 周食谱无重复 | ✓ 43 道午晚餐去重后 43 道 |
| 单元测试 | 51/51 通过 |

### 非 bug（审查中排除的误判）

- 饮食日志 quantity 折算：代码正确，之前 null 是 shell 编码问题
- 调味品不扣库存：代码逻辑正确，之前"盐消失"是测试写入乱码键
- compression gzip：761723 → 201534 字节（3.8×）生效
- 前端空态/lazy loading/localStorage：构建产物中均存在

---

## 2026-09-17 第二轮对抗性审查

### 上轮 3 CRITICAL bug 修复确认

| BUG | 验证方法 | 结果 |
|-----|---------|------|
| #1 推荐系统失效 | recommend 返回真实 matched；番茄炒蛋在不同库存下得分 0.33→0.67→1.00 | ✓ |
| #2 别名匹配失效 | 库存"番茄"→菜谱"西红柿" matched；"土豆"→"马铃薯" matched | ✓ |
| #3 荤素搭配失效 | 5 seeds × 14 餐：缺素 0/70，缺蛋白 2/70，无重复 | ✓ |

### 通过的审查项

- compression gzip 3.8× 生效
- recipesCache：冷 5ms / 热 0ms，同一对象引用
- lazy loading / localStorage / 空态区分：构建产物确认存在
- 做菜扣库存：鸡蛋 8→7，番茄 4→3，葱花 notFound
- 完成订单扣库存：quantity=2 正确扣减
- 调味品分池：盐/生抽/食用油不参与评分不扣库存
- 单元测试 51/51 通过

### 本轮发现的 LOW 级问题（不影响核心功能）

| 问题 | 说明 |
|------|------|
| matched 数组含原始噪音 | "鸡蛋的用量为"而非归一化后的"鸡蛋"；scoreRecipe 推入原始 item |
| 螺蛳粉 stuff=["水"] 走纯调味品分支拿满分 | 1/917 道菜，数据本身如此 |
| seed=2026 时 2/14 餐缺蛋白 | otherPool 回退时可能选到无蛋白的菜，概率性边缘情况 |

### 结论

本轮未发现新的 CRITICAL 或 HIGH 问题。项目处于健康状态。

---

## 2026-09-17 三个 LOW 级问题修复

### 修复内容

| 问题 | 修复 |
|------|------|
| LOW #1 matched 含原始噪音 | `scoreRecipe` 的 matched/missing 改推归一化形式（"鸡蛋的用量为"→"鸡蛋"） |
| LOW #2 螺蛳粉拿满分 | 无主料菜谱返回 score=0 而非 1，不再误导推荐 |
| LOW #3 缺蛋白 | proteinSource 正则扩展（鸭/鹅/腊肠/腊肉/火腿/蟹/蛤/蚝/鱿鱼）；荤位选取过滤无蛋白菜；otherPool 回退只选有蛋白的 |

### 验证

- LOW #1：`scoreRecipe(['鸡蛋的用量为'], ['鸡蛋'])` → matched=["鸡蛋"] ✓
- LOW #2：`scoreRecipe(['水'], [])` → score=0 ✓
- LOW #3：5 seeds × 14 餐 = 70/70 全部有蛋白 ✓
- 单元测试 51/51 通过

### 当前状态

所有已知 CRITICAL/HIGH/MEDIUM/LOW 问题均已修复。项目处于健康状态。

---

## 2026-09-17 食客端今明食谱 + 三菜一汤 + 库存优先

### 需求

1. 食客端默认展示当日和次日完整食谱（早/午/晚/加餐）
2. 午餐/晚餐按三菜一汤标准生成（3 道菜 + 1 道汤）
3. 食客可点击增加/删除食谱中的菜品
4. 展现的菜品以有库存优先为通用标准

### 改动

| 文件 | 改动 |
|------|------|
| `lib/mealPlanner.js` | `buildMeal` 改为三菜一汤：荤+素+混合+汤（汤必选） |
| `routes/mealPlan.js` | 新增 `POST /api/meal-plan/dish`（加菜）、`DELETE /api/meal-plan/dish`（删菜） |
| `GuestView.vue` | 替换「今日摘要」为「今明食谱面板」（两日分组、加菜/删菜按钮、库存绿点、选菜弹窗）；recommend count 8→100 |

### 验证

- 单元测试 51/51 通过
- 生成周计划：每餐 4 道（3菜+1汤）✓
- 加菜 API：mon lunch 4→5 道 ✓
- 删菜 API：mon lunch 5→4 道 ✓
- 前端 build 通过
