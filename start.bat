@echo off
echo ========================================
echo Amazing Food - 局域网点餐小应用
echo ========================================
echo.

REM 环境变量请配置在 backend\.env（参考 backend\.env.example）
REM 切勿将密钥写入本脚本或提交到仓库

echo 1. 安装后端依赖...
cd backend
call npm install
if errorlevel 1 (
    echo 后端依赖安装失败！
    pause
    exit /b 1
)
cd ..

echo.
echo 2. 安装前端依赖...
cd frontend
call npm install
if errorlevel 1 (
    echo 前端依赖安装失败！
    pause
    exit /b 1
)
cd ..

echo.
echo 3. 构建前端项目...
cd frontend
call npm run build
if errorlevel 1 (
    echo 前端构建失败！
    pause
    exit /b 1
)
cd ..

echo.
echo 4. 启动后端服务器...
echo 服务器将在 http://localhost:7777 启动
echo 局域网访问地址: http://[你的IP地址]:7777
echo.
echo 按 Ctrl+C 停止服务器
echo.
cd backend
call npm start

pause