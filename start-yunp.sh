#!/bin/bash

# YunP 云存储平台启动脚本

echo "🚀 启动 YunP 云存储平台..."
echo "================================"

# 检查环境
if [ ! -f backend/.env ]; then
    echo "❌ 未找到环境配置文件 backend/.env"
    echo "请先运行安装脚本进行配置"
    exit 1
fi

# 检查数据库
if [ ! -f backend/database.sqlite ]; then
    echo "📋 初始化数据库..."
    cd backend && node src/scripts/initDatabase.js
    cd ..
fi

# 启动后端服务
echo "📡 启动后端服务..."
cd backend
node simple-server.js &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "⏳ 等待后端服务启动..."
sleep 3

# 检查后端是否启动成功
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ 后端服务启动成功 (PID: $BACKEND_PID)"
    
    # 启动前端开发服务器
    echo "🎨 启动前端服务..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    # 等待前端启动
    sleep 5
    
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "✅ 前端服务启动成功 (PID: $FRONTEND_PID)"
        echo ""
        echo "🎉 YunP 云存储平台启动完成!"
        echo "================================"
        echo "🌐 前端地址: http://localhost:3000"
        echo "📡 后端API: http://localhost:3001"
        echo ""
        echo "📝 默认管理员账户:"
        echo "   邮箱: admin@yunp.com"
        echo "   密码: admin123"
        echo ""
        echo "⚠️  首次使用请及时修改管理员密码!"
        echo ""
        echo "按 Ctrl+C 停止所有服务"
        echo "================================"
        
        # 等待用户中断
        trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '✅ 服务已停止'; exit 0" INT
        
        # 保持脚本运行
        while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; do
            sleep 1
        done
        
        echo "❌ 服务意外停止"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    else
        echo "❌ 前端服务启动失败"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
else
    echo "❌ 后端服务启动失败"
    exit 1
fi
