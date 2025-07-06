#!/bin/bash

echo "🔍 YunP 系统诊断报告"
echo "===================="
echo ""

echo "📡 网络配置:"
echo "------------"
echo "主机名: $(hostname)"
echo "IP地址: $(hostname -I 2>/dev/null || echo '无法获取')"
echo ""

echo "🔌 端口监听状态:"
echo "---------------"
echo "8080端口:"
ss -tlnp | grep :8080 || echo "端口8080未监听"
echo ""
echo "3001端口:"
ss -tlnp | grep :3001 || echo "端口3001未监听"
echo ""

echo "🔄 进程状态:"
echo "-----------"
ps aux | grep "node.*simple-server" | grep -v grep || echo "YunP服务未运行"
echo ""

echo "🌐 连接测试:"
echo "-----------"
echo "测试localhost:8080..."
if curl -s --connect-timeout 5 http://localhost:8080/api/health > /dev/null; then
    echo "✅ localhost:8080 连接成功"
else
    echo "❌ localhost:8080 连接失败"
fi

echo "测试127.0.0.1:8080..."
if curl -s --connect-timeout 5 http://127.0.0.1:8080/api/health > /dev/null; then
    echo "✅ 127.0.0.1:8080 连接成功"
else
    echo "❌ 127.0.0.1:8080 连接失败"
fi
echo ""

echo "🔥 防火墙状态:"
echo "-------------"
if command -v ufw &> /dev/null; then
    echo "UFW状态: $(sudo ufw status 2>/dev/null || echo '无法检查')"
elif command -v firewall-cmd &> /dev/null; then
    echo "Firewalld状态: $(sudo firewall-cmd --state 2>/dev/null || echo '无法检查')"
else
    echo "未检测到常见防火墙工具"
fi
echo ""

echo "📁 文件系统:"
echo "-----------"
echo "工作目录: $(pwd)"
echo "数据库文件: $(ls -la backend/database.sqlite 2>/dev/null || echo '不存在')"
echo "上传目录: $(ls -ld backend/uploads 2>/dev/null || echo '不存在')"
echo ""

echo "🔧 建议的访问地址:"
echo "----------------"
echo "1. http://localhost:8080"
echo "2. http://127.0.0.1:8080"
echo "3. 下载并打开 yunp-standalone.html 文件"
echo ""

echo "📞 如果仍无法访问，请检查:"
echo "------------------------"
echo "1. 浏览器是否设置了代理"
echo "2. 防火墙是否阻止了8080端口"
echo "3. 是否有其他安全软件阻止访问"
echo "4. 尝试使用不同的浏览器"
echo ""

echo "诊断完成！"
