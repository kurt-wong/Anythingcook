# Amazing Food — 重启提示词

## 项目概况

家庭局域网点菜系统。仓库：https://github.com/kurt-wong/Anythingcook

**双端口架构**：
- **7777**：食客点菜端（guest.html，角色选择：大小姐/母上大人）
- **9999**：饲养员管理端（cook.html，直接进入看板）

**启动**：`cd "D:\Project\Amazing food\backend" && node src/index.js`

## 技术栈

- 后端：Node.js + Express + compression，JSON 文件存储
- 前端：Vue 3 + Vite 多页构建 + Tailwind CSS
- 数据：917 道菜谱、1474 张本地图、89 种食材（8 分类）

## 核心模块

| 文件 | 职责 |
|------|------|
| `backend/src/index.js` | 双端口装配（createApp 工厂） |
| `backend/src/lib/match.js` | 食材精确匹配 + 调味品分池 |
| `backend/src/lib/mealPlanner.js` | 周食谱生成（三菜一汤、库存优先、蛋白轮换） |
| `backend/src/lib/recipesCache.js` | 菜谱内存缓存 + mtime 失效 |
| `backend/src/lib/store.js` | JSON 读写 + 写串行锁 |
| `backend/src/routes/` | 9 个路由模块（38 个 API 端点） |
| `frontend/src/GuestApp.vue` | 食客端入口 |
| `frontend/src/CookApp.vue` | 饲养员端入口 |
| `frontend/src/components/GuestView.vue` | 食客点菜界面（今明食谱面板、库存优先排序） |
| `frontend/src/components/CookView.vue` | 饲养员看板（订单/库存/周计划三 tab） |

## 关键数据文件

| 文件 | 说明 |
|------|------|
| `data/ingredientCategoryMap.json` | 8 分类 89 种主料（肉类13/蔬菜28/菌菇6/蛋类3/豆制品6/主食25/水产6/水果10） |
| `data/seasonings.json` | 调味品白名单（约120词，不参与评分不扣库存） |
| `data/ingredientAlias.json` | 25 组同物异名（西红柿↔番茄、土豆↔马铃薯等） |
| `data/recipes.json` | 917 道菜谱（每日 cron 同步） |

## 当前状态

- 51/51 单元测试通过
- 两轮对抗性审查，3 CRITICAL + 3 LOW 全部修复
- 工作区干净，最新提交 `0de2d90`
- 详见 `status.md`（完整历史）和 `log.md`（过程日志）

## 注意事项

- 项目路径含空格：`D:\Project\Amazing food`
- 数据文件在 `backend/src/data/`（不是 `backend/data/`）
- 前端多页构建：`frontend/guest.html`、`frontend/cook.html`、`frontend/index.html`
- 所有日期用本地时区（`lib/dates.js`），禁止 `toISOString().slice(0,10)`
- 食材匹配用精确+别名（`lib/match.js`），禁止子串包含
- 库存归零保留键（count:0），不删除键
