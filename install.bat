@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🚀 欢迎使用 YunP 云存储平台安装脚本 (Windows)
echo ==================================================

:: 检查 Node.js
echo 📋 检查系统环境...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js
    echo 请先安装 Node.js 16+ 版本: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js 版本: %NODE_VERSION%

:: 检查 npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm 未正确安装
    pause
    exit /b 1
)

echo ✅ npm 可用

:: 安装依赖
echo.
echo 📦 正在安装项目依赖...
echo 这可能需要几分钟时间，请耐心等待...

echo 📦 安装根目录依赖...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 根目录依赖安装失败
    pause
    exit /b 1
)

echo 📦 安装后端依赖...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
cd ..

echo 📦 安装前端依赖...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
cd ..

echo ✅ 依赖安装完成

:: 配置环境变量
echo.
echo ⚙️ 配置环境变量...

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo ✅ 已复制 .env.example 到 .env
    ) else (
        echo 📝 创建基础 .env 文件...
        (
            echo # 基础配置
            echo NODE_ENV=development
            echo PORT=3001
            echo DATABASE_URL=./database.sqlite
            echo.
            echo # 安全配置 ^(请修改为您自己的密钥!^)
            echo JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
            echo ENCRYPTION_KEY=your-32-character-encryption-key
            echo.
            echo # 文件存储
            echo UPLOAD_DIR=./uploads
            echo MAX_FILE_SIZE=104857600
            echo DEFAULT_STORAGE_LIMIT=5368709120
            echo.
            echo # 邮件配置 ^(可选^)
            echo SMTP_HOST=
            echo SMTP_PORT=587
            echo SMTP_USER=
            echo SMTP_PASS=
            echo.
            echo # Redis配置 ^(可选^)
            echo REDIS_URL=redis://localhost:6379
        ) > "backend\.env"
        echo ✅ 已创建基础 .env 文件
    )
)

:: 创建必要目录
echo.
echo 📁 创建必要目录...
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\logs" mkdir "backend\logs"
if not exist "backend\temp" mkdir "backend\temp"
if not exist "backend\backups" mkdir "backend\backups"
echo ✅ 目录创建完成

:: 初始化数据库
echo.
echo 🗄️ 初始化数据库...
cd backend

:: 检查是否有数据库初始化脚本
if exist "src\database\init.sql" (
    echo 📋 运行数据库初始化脚本...
    :: 这里需要 sqlite3 命令行工具，如果没有则跳过
    where sqlite3 >nul 2>&1
    if !errorlevel! equ 0 (
        sqlite3 database.sqlite < src\database\init.sql
        echo ✅ 基础数据库初始化完成
    ) else (
        echo ⚠️ 未找到 sqlite3 命令，将在首次运行时自动初始化数据库
    )
)

:: 应用增强架构
if exist "src\database\enhanced-schema.sql" (
    where sqlite3 >nul 2>&1
    if !errorlevel! equ 0 (
        sqlite3 database.sqlite < src\database\enhanced-schema.sql
        echo ✅ 增强数据库架构应用成功
    )
)

cd ..

:: 构建前端
echo.
echo 🏗️ 构建前端应用...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo ❌ 前端构建失败
    pause
    exit /b 1
)
cd ..
echo ✅ 前端构建完成

:: 创建启动脚本
echo.
echo 📝 创建启动脚本...

:: 创建生产启动脚本
(
    echo @echo off
    echo chcp 65001 ^>nul
    echo echo 🚀 启动 YunP 云存储平台...
    echo.
    echo if not exist "backend\.env" ^(
    echo     echo ❌ 未找到环境配置文件 backend\.env
    echo     echo 请先运行 install.bat 进行安装
    echo     pause
    echo     exit /b 1
    echo ^)
    echo.
    echo echo 📡 启动后端服务...
    echo cd backend
    echo start "YunP Backend" cmd /k "npm start"
    echo cd ..
    echo.
    echo echo ✅ 后端服务已启动
    echo echo 🌐 访问地址: http://localhost:3001
    echo echo.
    echo echo 📝 管理员登录信息:
    echo echo    用户名: admin
    echo echo    密码: admin123
    echo echo.
    echo echo ⚠️  首次使用请及时修改管理员密码!
    echo echo.
    echo echo 按任意键关闭此窗口...
    echo pause ^>nul
) > start.bat

:: 创建开发启动脚本
(
    echo @echo off
    echo chcp 65001 ^>nul
    echo echo 🚀 启动 YunP 开发环境...
    echo.
    echo if not exist "backend\.env" ^(
    echo     echo ❌ 未找到环境配置文件 backend\.env
    echo     pause
    echo     exit /b 1
    echo ^)
    echo.
    echo echo 🔧 启动开发模式 ^(前后端同时启动^)...
    echo call npm run dev
) > start-dev.bat

echo ✅ 启动脚本创建完成

:: 安装完成
echo.
echo ========================================
echo 🎉 YunP 安装完成!
echo ========================================
echo.
echo 📋 下一步操作:
echo 1. 编辑配置文件: notepad backend\.env
echo 2. 启动服务: start.bat
echo 3. 访问系统: http://localhost:3001
echo.
echo 🔧 开发模式: start-dev.bat
echo 📖 文档: 查看 README.md 和 docs\ 目录
echo.
echo ⚠️  请务必修改 backend\.env 中的安全密钥!
echo    特别是 JWT_SECRET 和 ENCRYPTION_KEY
echo.
echo 按任意键退出安装程序...
pause >nul
