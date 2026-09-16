# 🍜 Amazing Food

> 家庭局域网点菜系统 — 解决"今天吃什么"的终极方案

一个专为家庭设计的局域网点菜应用。食客浏览菜谱点菜下单，饲养员（厨师）接收订单、管理库存、制定周计划。采用 Apple 风格设计语言，界面简洁优雅。

## ✨ 功能

### 🧑 食客端
- 浏览菜谱九宫格（支持搜索、分类筛选）
- 查看菜谱详情（食材、做法、视频教程链接）
- 一键加入菜单，调整数量后提交点菜
- 🎲 随机推荐（优先推荐库存能做的菜）
- 今日计划摘要 + 一键点菜

### 👨‍🍳 饲养员端
- **订单管理**：接收订单 → 开始做 → 完成，状态流转
- **库存管理**：按分类管理食材库存，点击 +1 快速补货
- **周计划**：规划每周午餐/晚餐菜单，食客端自动展示
- **下厨统计**：近 30 天完成订单、做菜道数、最常做的菜

### 📖 厨艺小课堂
- 基础/学习/进阶三组烹饪技巧文章
- Markdown 渲染，支持代码块、表格等

## 🏗 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Tailwind CSS |
| 后端 | Node.js + Express |
| 数据 | JSON 文件存储（零数据库依赖） |
| 菜谱来源 | [Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook) + [YunYouJun/cook](https://github.com/YunYouJun/cook) |

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 1. 安装依赖

```bash
# 后端
cd backend && npm install

# 前端
cd frontend && npm install
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 按需编辑 .env（Unsplash API Key 可选）
```

### 3. 开发模式

```bash
# 启动后端（端口 7777）
cd backend && npm run dev

# 另开终端，启动前端（端口 5173，自动代理 API）
cd frontend && npm run dev
```

访问 http://localhost:5173 即可使用。

### 4. 生产部署

```bash
# 构建前端
cd frontend && npm run build

# 启动后端（自动托管前端 dist）
cd backend && npm start
```

访问 http://localhost:7777 即可使用。

### 5. Docker 部署（推荐）

```bash
docker compose up -d
```

访问 http://localhost:7777。

## 📁 项目结构

```
Amazing food/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express 装配入口（中间件/路由/cron/listen）
│   │   ├── lib/
│   │   │   ├── dates.js          # 本地时区日期工具
│   │   │   ├── store.js          # JSON 读写 + 写串行锁
│   │   │   ├── respond.js        # 统一响应/错误处理/令牌校验
│   │   │   └── imageCache.js     # Unsplash 图片缓存/下载
│   │   ├── routes/
│   │   │   ├── recipes.js        # 菜谱/标签/方式/工具
│   │   │   ├── ingredients.js    # 食材库存/做菜扣减
│   │   │   ├── orders.js         # 订单管理
│   │   │   ├── mealPlan.js       # 周计划
│   │   │   ├── dietLog.js        # 饮食记录
│   │   │   ├── tips.js           # 厨艺技巧
│   │   │   ├── stats.js          # 下厨统计
│   │   │   ├── admin.js          # 维护接口（可选 ADMIN_TOKEN）
│   │   │   └── images.js         # 图片代理
│   │   ├── data/                 # JSON 数据 + 菜谱图片
│   │   └── scripts/              # 数据同步/清洗脚本
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.vue               # 角色选择入口
│   │   ├── components/
│   │   │   ├── GuestView.vue     # 食客点菜界面
│   │   │   ├── CookView.vue      # 饲养员看板
│   │   │   ├── TipsView.vue      # 厨艺小课堂
│   │   │   └── RecipeDetailModal.vue
│   │   └── style.css             # Apple 设计系统样式
│   └── package.json
├── Design.md                     # 设计规范文档
├── docker-compose.yml
└── README.md
```

## 🔌 API 概览

### 菜谱

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/recipes` | 菜谱列表（支持 search/tag/difficulty/method/tool） |
| GET | `/api/recipes/random` | 随机推荐（count、preferStock） |
| GET | `/api/recipes/recommend` | 按库存推荐 |
| GET | `/api/recipes/:id` | 菜谱详情 |
| GET | `/api/tags` | 所有标签 |
| GET | `/api/methods` | 所有烹饪方式 |
| GET | `/api/tools` | 所有工具 |

### 订单与库存

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/orders` | 创建订单（quantity 必须 1–99 整数） |
| GET | `/api/orders` | 订单列表（可按 status 筛选） |
| PUT | `/api/orders/:id` | 更新状态（completed 自动扣库存+写饮食日志） |
| DELETE | `/api/orders/:id` | 删除订单 |
| GET | `/api/ingredients` | 食材库存（原始 map） |
| GET | `/api/ingredients/all` | 食材+分类列表 |
| POST | `/api/ingredients` | 添加/累加食材 |
| POST | `/api/ingredients/batch` | 批量覆盖库存 |
| PUT | `/api/ingredients/:name` | 更新单个数量 |
| DELETE | `/api/ingredients/:name` | 删除单个食材 |
| DELETE | `/api/ingredients` | 库存清零（保留标签） |
| GET | `/api/ingredients/suggestions` | 食材自动补全 |
| POST | `/api/cook` | 做菜扣减库存 |

### 周计划与饮食

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/meal-plan` | 获取当周计划 |
| PUT | `/api/meal-plan` | 保存周计划 |
| GET | `/api/diet-log` | 饮食记录（date，默认今天） |
| GET | `/api/diet-log/summary` | 营养汇总（days，默认 7） |
| POST | `/api/diet-log` | 手动添加记录 |
| DELETE | `/api/diet-log/:id` | 删除记录 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tips` | 厨艺技巧列表 |
| GET | `/api/tips/:slug` | 技巧文章 markdown |
| GET | `/api/stats/summary` | 下厨统计（近 30 天） |
| GET | `/api/image?name=` | 图片代理（本地→Unsplash→占位图） |
| GET | `/api/status` | 系统状态 |
| POST | `/api/update` | 手动数据同步（维护，可选 ADMIN_TOKEN） |
| POST | `/api/import-howtocook` | 从 HowToCook 导入（维护） |
| POST | `/api/download-missing-images` | 补充下载图片（维护） |
| POST | `/api/images/cache` | 图片批量缓存（维护） |
| POST | `/api/images/download-cached` | 下载已缓存图片（维护） |

> 维护类 POST 接口：配置 `ADMIN_TOKEN` 后需携带 `Authorization: Bearer <token>` 或 `X-Admin-Token` 头；未配置则开放（家庭局域网）。

## 🎨 设计

采用 Apple 设计语言：SF Pro 字体、Action Blue (#0066cc) 单一强调色、胶囊按钮、全出血卡片交替明暗节奏。详细规范见 [Design.md](./Design.md)。

## 📝 License

MIT
