#!/bin/bash

echo "🚀 启动 YunP 云存储平台..."

# 检查服务是否运行
if ! pgrep -f "node.*simple-server" > /dev/null; then
    echo "📡 启动YunP服务..."
    cd "$(dirname "$0")/backend"
    PORT=8080 node simple-server.js &
    sleep 3
fi

# 测试连接
echo "🔗 测试连接..."
if curl -s http://localhost:8080/api/health > /dev/null; then
    echo "✅ 服务运行正常"
    
    # 尝试打开浏览器
    if command -v xdg-open > /dev/null; then
        echo "🌐 正在打开浏览器..."
        xdg-open http://localhost:8080
    elif command -v open > /dev/null; then
        echo "🌐 正在打开浏览器..."
        open http://localhost:8080
    else
        echo "🌐 请手动打开浏览器访问: http://localhost:8080"
    fi
    
    echo ""
    echo "📝 管理员登录信息:"
    echo "   邮箱: admin@yunp.com"
    echo "   密码: admin123"
    echo ""
    echo "⚠️  首次使用请及时修改密码!"
    
else
    echo "❌ 服务启动失败，请检查错误信息"
fi
