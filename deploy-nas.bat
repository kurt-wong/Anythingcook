@echo off
chcp 65001 >nul
echo ========================================
echo Amazing Food - NAS 部署打包脚本
echo ========================================
echo.

set PACKAGE_DIR=amazing-food-deploy

if exist %PACKAGE_DIR% rmdir /s /q %PACKAGE_DIR%

echo 1. 构建前端...
cd frontend
call npm run build
if errorlevel 1 (
    echo 前端构建失败！
    pause
    exit /b 1
)
cd ..

echo.
echo 2. 创建打包目录...
mkdir %PACKAGE_DIR%
mkdir %PACKAGE_DIR%\backend
mkdir %PACKAGE_DIR%\frontend

echo.
echo 3. 复制文件...
xcopy /E /I /Y /Q backend\src %PACKAGE_DIR%\backend\src
copy /Y backend\package.json %PACKAGE_DIR%\backend\ >nul
copy /Y backend\package-lock.json %PACKAGE_DIR%\backend\ >nul 2>nul
copy /Y backend\Dockerfile.nas %PACKAGE_DIR%\backend\ >nul
copy /Y backend\.env.example %PACKAGE_DIR%\backend\ >nul
xcopy /E /I /Y /Q frontend\dist %PACKAGE_DIR%\frontend\dist
copy /Y docker-compose.nas.yml %PACKAGE_DIR%\docker-compose.yml >nul

echo.
echo 4. 打包完成！目录: %PACKAGE_DIR%
echo.
echo ========================================
echo NAS 部署步骤：
echo ========================================
echo.
echo 1. 将 %PACKAGE_DIR% 整个文件夹上传到 NAS:
echo    群晖 File Station -> anythingcook 文件夹
echo.
echo 2. SSH 登录 NAS:
echo    ssh 你的用户名@192.168.0.100
echo.
echo 3. 进入项目目录:
echo    cd /volume1/anythingcook/%PACKAGE_DIR%
echo.
echo 4. 创建 .env 文件（可选，配置 Unsplash Key）:
echo    cp backend/.env.example backend/.env
echo    vi backend/.env
echo.
echo 5. 构建并启动:
echo    docker-compose up -d
echo.
echo 6. 访问应用:
echo    http://192.168.0.100:7777
echo.
echo ========================================
pause
