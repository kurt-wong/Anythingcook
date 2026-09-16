FROM node:18-alpine

WORKDIR /app

# 安装后端依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# 安装前端依赖并构建
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# 复制后端源码和数据
COPY backend/ ./backend/

WORKDIR /app/backend

EXPOSE 7777

CMD ["node", "src/index.js"]
