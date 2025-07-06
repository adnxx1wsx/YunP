#!/bin/bash

# YunP 云盘系统启动脚本

echo "🚀 启动 YunP 云盘系统..."

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt "18" ]; then
    echo "❌ 错误: 需要 Node.js 18 或更高版本"
    echo "当前版本: $(node -v)"
    echo "请访问 https://nodejs.org/ 下载最新版本"
    exit 1
fi

echo "✅ Node.js 版本检查通过: $(node -v)"

# 检查是否已安装依赖
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装依赖..."
    npm run install:all
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
fi

# 检查是否已初始化数据库
if [ ! -f "backend/database.sqlite" ]; then
    echo "🗄️ 初始化数据库..."
    npm run init-db
    if [ $? -ne 0 ]; then
        echo "❌ 数据库初始化失败"
        exit 1
    fi
    echo "✅ 数据库初始化完成"
fi

# 检查是否已初始化订阅计划
echo "📋 初始化订阅计划..."
npm run init-plans
if [ $? -ne 0 ]; then
    echo "⚠️ 订阅计划初始化失败，但系统仍可正常运行"
fi

# 检查环境变量文件
if [ ! -f "backend/.env" ]; then
    echo "⚙️ 创建环境变量文件..."
    cp backend/.env.example backend/.env
    echo "✅ 已创建 backend/.env 文件"
    echo "📝 请编辑 backend/.env 文件配置您的环境变量"
fi

echo ""
echo "🎉 准备工作完成！"
echo ""
echo "📚 使用说明:"
echo "  - 前端地址: http://localhost:3000"
echo "  - 后端地址: http://localhost:3001"
echo "  - API 文档: http://localhost:3001/api"
echo ""
echo "🔧 配置说明:"
echo "  - 编辑 backend/.env 文件配置云存储提供商"
echo "  - 配置 OneDrive、Google Drive 等第三方存储"
echo "  - 配置 Stripe 支付（可选）"
echo ""

# 启动开发服务器
echo "🚀 启动开发服务器..."
npm run dev
