# NAS 优化版：前端已在本地预构建，容器内只需安装后端依赖
FROM node:18-alpine

WORKDIR /app

# 只安装后端依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# 复制后端源码
COPY backend/ ./backend/

# 复制预构建的前端
COPY frontend/dist/ ./frontend/dist/

WORKDIR /app/backend

EXPOSE 7777

CMD ["node", "src/index.js"]
