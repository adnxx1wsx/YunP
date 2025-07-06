#!/bin/bash

# YunP 自动安装脚本
# 适用于 Ubuntu/Debian/CentOS/macOS

set -e

echo "🚀 欢迎使用 YunP 云存储平台安装脚本"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            OS="debian"
        elif [ -f /etc/redhat-release ]; then
            OS="redhat"
        else
            OS="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        log_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
    log_info "检测到操作系统: $OS"
}

# 检查 Node.js
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
        if [ $MAJOR_VERSION -ge 16 ]; then
            log_success "Node.js 版本: v$NODE_VERSION ✓"
            return 0
        else
            log_warning "Node.js 版本过低 (v$NODE_VERSION)，需要 v16 或更高版本"
        fi
    else
        log_warning "未检测到 Node.js"
    fi
    return 1
}

# 安装 Node.js
install_nodejs() {
    log_info "正在安装 Node.js..."
    
    if [[ "$OS" == "debian" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "redhat" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            log_error "请先安装 Homebrew 或手动安装 Node.js"
            exit 1
        fi
    fi
    
    if check_nodejs; then
        log_success "Node.js 安装成功"
    else
        log_error "Node.js 安装失败"
        exit 1
    fi
}

# 安装项目依赖
install_dependencies() {
    log_info "正在安装项目依赖..."
    
    # 安装根目录依赖
    log_info "安装根目录依赖..."
    npm install
    
    # 安装后端依赖
    log_info "安装后端依赖..."
    cd backend
    npm install
    cd ..
    
    # 安装前端依赖
    log_info "安装前端依赖..."
    cd frontend
    npm install
    cd ..
    
    log_success "依赖安装完成"
}

# 配置环境变量
setup_environment() {
    log_info "配置环境变量..."
    
    if [ ! -f backend/.env ]; then
        if [ -f backend/.env.example ]; then
            cp backend/.env.example backend/.env
            log_info "已复制 .env.example 到 .env"
        else
            # 创建基础 .env 文件
            cat > backend/.env << EOF
# 基础配置
NODE_ENV=development
PORT=3001
DATABASE_URL=./database.sqlite

# 安全配置 (请修改为您自己的密钥!)
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# 文件存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
DEFAULT_STORAGE_LIMIT=5368709120

# 邮件配置 (可选)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Redis配置 (可选)
REDIS_URL=redis://localhost:6379
EOF
            log_info "已创建基础 .env 文件"
        fi
    fi
    
    log_warning "请编辑 backend/.env 文件，配置您的具体参数"
    log_warning "特别注意修改 JWT_SECRET 和 ENCRYPTION_KEY"
}

# 初始化数据库
init_database() {
    log_info "初始化数据库..."
    
    cd backend
    
    # 创建数据库目录
    mkdir -p data
    
    # 运行数据库初始化
    if [ -f "src/database/init.sql" ]; then
        node -e "
        const sqlite3 = require('sqlite3').verbose();
        const fs = require('fs');
        const db = new sqlite3.Database('./database.sqlite');
        const sql = fs.readFileSync('./src/database/init.sql', 'utf8');
        db.exec(sql, (err) => {
            if (err) {
                console.error('数据库初始化失败:', err);
                process.exit(1);
            } else {
                console.log('数据库初始化成功');
            }
            db.close();
        });
        "
    fi
    
    # 应用增强架构
    if [ -f "src/database/enhanced-schema.sql" ]; then
        sqlite3 database.sqlite < src/database/enhanced-schema.sql
        log_success "增强数据库架构应用成功"
    fi
    
    cd ..
    log_success "数据库初始化完成"
}

# 创建必要目录
create_directories() {
    log_info "创建必要目录..."
    
    mkdir -p backend/uploads
    mkdir -p backend/logs
    mkdir -p backend/temp
    mkdir -p backend/backups
    
    # 设置权限
    chmod 755 backend/uploads
    chmod 755 backend/logs
    chmod 755 backend/temp
    chmod 755 backend/backups
    
    log_success "目录创建完成"
}

# 构建前端
build_frontend() {
    log_info "构建前端应用..."
    
    cd frontend
    npm run build
    cd ..
    
    log_success "前端构建完成"
}

# 创建启动脚本
create_start_script() {
    log_info "创建启动脚本..."
    
    cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 启动 YunP 云存储平台..."

# 检查环境
if [ ! -f backend/.env ]; then
    echo "❌ 未找到环境配置文件 backend/.env"
    echo "请先运行 ./install.sh 进行安装"
    exit 1
fi

# 启动后端
echo "📡 启动后端服务..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ 后端服务启动成功 (PID: $BACKEND_PID)"
    echo "🌐 访问地址: http://localhost:3001"
    echo ""
    echo "📝 管理员登录信息:"
    echo "   用户名: admin"
    echo "   密码: admin123"
    echo ""
    echo "⚠️  首次使用请及时修改管理员密码!"
    echo ""
    echo "按 Ctrl+C 停止服务"
    
    # 等待用户中断
    trap "echo '🛑 正在停止服务...'; kill $BACKEND_PID; exit 0" INT
    wait $BACKEND_PID
else
    echo "❌ 后端服务启动失败"
    exit 1
fi
EOF

    chmod +x start.sh
    
    # 创建开发启动脚本
    cat > start-dev.sh << 'EOF'
#!/bin/bash

echo "🚀 启动 YunP 开发环境..."

# 检查环境
if [ ! -f backend/.env ]; then
    echo "❌ 未找到环境配置文件 backend/.env"
    exit 1
fi

# 同时启动前后端
npm run dev
EOF

    chmod +x start-dev.sh
    
    log_success "启动脚本创建完成"
}

# 主安装流程
main() {
    echo ""
    log_info "开始安装 YunP 云存储平台..."
    echo ""
    
    # 检测操作系统
    detect_os
    
    # 检查并安装 Node.js
    if ! check_nodejs; then
        read -p "是否安装 Node.js? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_nodejs
        else
            log_error "需要 Node.js 16+ 才能运行 YunP"
            exit 1
        fi
    fi
    
    # 安装依赖
    install_dependencies
    
    # 配置环境
    setup_environment
    
    # 创建目录
    create_directories
    
    # 初始化数据库
    init_database
    
    # 构建前端
    build_frontend
    
    # 创建启动脚本
    create_start_script
    
    echo ""
    log_success "🎉 YunP 安装完成!"
    echo ""
    echo "📋 下一步操作:"
    echo "1. 编辑配置文件: nano backend/.env"
    echo "2. 启动服务: ./start.sh"
    echo "3. 访问系统: http://localhost:3001"
    echo ""
    echo "🔧 开发模式: ./start-dev.sh"
    echo "📖 文档: 查看 README.md 和 docs/ 目录"
    echo ""
    log_warning "⚠️  请务必修改 backend/.env 中的安全密钥!"
}

# 运行主函数
main "$@"
