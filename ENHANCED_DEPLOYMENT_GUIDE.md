# YunP 增强版部署指南

## 🚀 快速开始

### 系统要求
- **Node.js**: 16.x 或更高版本
- **数据库**: SQLite 3.x (开发) / PostgreSQL 12+ (生产)
- **Redis**: 6.x 或更高版本 (可选，用于缓存)
- **内存**: 最低 2GB，推荐 4GB+
- **存储**: 最低 10GB，根据用户数据需求调整

### 环境准备

#### 1. 克隆项目
```bash
git clone https://github.com/your-username/YunP.git
cd YunP
```

#### 2. 安装依赖
```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

#### 3. 环境配置
```bash
# 复制环境变量文件
cp backend/.env.example backend/.env

# 编辑环境变量
nano backend/.env
```

#### 4. 关键环境变量配置
```env
# 基础配置
NODE_ENV=production
PORT=3001
DATABASE_URL=./database.sqlite

# 安全配置 (必须修改!)
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
ENCRYPTION_KEY=your-32-character-encryption-key

# 文件存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
DEFAULT_STORAGE_LIMIT=5368709120

# Redis配置 (可选)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 云存储配置 (可选)
ONEDRIVE_CLIENT_ID=your_onedrive_client_id
ONEDRIVE_CLIENT_SECRET=your_onedrive_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# 支付配置 (可选)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 数据库初始化

#### 1. 创建数据库表
```bash
cd backend
npm run init-db
```

#### 2. 执行增强架构
```bash
# 应用增强的数据库架构
sqlite3 database.sqlite < src/database/enhanced-schema.sql
```

#### 3. 创建管理员账户
```bash
npm run create-admin
```

### 启动服务

#### 开发环境
```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:backend  # 后端: http://localhost:3001
npm run dev:frontend # 前端: http://localhost:3000
```

#### 生产环境
```bash
# 构建前端
cd frontend && npm run build

# 启动后端
cd ../backend && npm run start
```

## 🐳 Docker 部署

### 使用 Docker Compose (推荐)
```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 自定义 Docker 配置
```yaml
# docker-compose.override.yml
version: '3.8'
services:
  backend:
    environment:
      - JWT_SECRET=your-production-jwt-secret
      - DATABASE_URL=postgresql://user:pass@postgres:5432/yunp
    volumes:
      - ./uploads:/app/uploads
      - ./backups:/app/backups
  
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: yunp
      POSTGRES_USER: yunp_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 🔧 高级配置

### 1. Nginx 反向代理
```nginx
# /etc/nginx/sites-available/yunp
server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL配置
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 文件上传大小限制
    client_max_body_size 100M;
    
    # 前端静态文件
    location / {
        root /var/www/yunp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 文件下载优化
    location /uploads/ {
        alias /var/www/yunp/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. SSL 证书配置
```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. 系统服务配置
```ini
# /etc/systemd/system/yunp.service
[Unit]
Description=YunP Cloud Storage Backend
After=network.target

[Service]
Type=simple
User=yunp
WorkingDirectory=/var/www/yunp/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/app.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 启用服务
sudo systemctl enable yunp
sudo systemctl start yunp
sudo systemctl status yunp
```

## 📊 监控和维护

### 1. 系统监控
```bash
# 安装监控工具
npm install -g pm2

# 使用PM2管理进程
pm2 start backend/dist/app.js --name yunp-backend
pm2 startup
pm2 save

# 监控面板
pm2 monit
```

### 2. 日志管理
```bash
# 配置日志轮转
sudo nano /etc/logrotate.d/yunp

# 内容:
/var/www/yunp/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 yunp yunp
    postrotate
        pm2 reload yunp-backend
    endscript
}
```

### 3. 备份策略
```bash
#!/bin/bash
# backup.sh - 自动备份脚本

BACKUP_DIR="/var/backups/yunp"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
sqlite3 /var/www/yunp/backend/database.sqlite ".backup $BACKUP_DIR/database_$DATE.sqlite"

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /var/www/yunp uploads/

# 备份配置文件
cp /var/www/yunp/backend/.env $BACKUP_DIR/env_$DATE.backup

# 清理30天前的备份
find $BACKUP_DIR -name "*.sqlite" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# 设置定时备份
sudo crontab -e
# 添加: 0 2 * * * /var/www/yunp/scripts/backup.sh
```

## 🔐 安全加固

### 1. 防火墙配置
```bash
# UFW防火墙
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw deny 3001  # 禁止直接访问后端端口
```

### 2. 文件权限
```bash
# 设置正确的文件权限
sudo chown -R yunp:yunp /var/www/yunp
sudo chmod -R 755 /var/www/yunp
sudo chmod -R 700 /var/www/yunp/uploads
sudo chmod 600 /var/www/yunp/backend/.env
```

### 3. 数据库安全
```bash
# SQLite安全设置
chmod 600 /var/www/yunp/backend/database.sqlite
chown yunp:yunp /var/www/yunp/backend/database.sqlite

# PostgreSQL安全设置 (如果使用)
# 1. 创建专用用户
# 2. 限制网络访问
# 3. 启用SSL连接
# 4. 定期更新密码
```

## 🚀 性能优化

### 1. 缓存配置
```bash
# Redis配置优化
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 2. 数据库优化
```sql
-- SQLite优化
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
```

### 3. 文件存储优化
```bash
# 启用文件系统压缩 (如果支持)
sudo mount -o remount,compress=zstd /var/www/yunp/uploads

# 定期清理临时文件
find /tmp -name "yunp_*" -mtime +1 -delete
```

## 📈 扩展部署

### 1. 负载均衡
```nginx
# 多实例负载均衡
upstream yunp_backend {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    location /api/ {
        proxy_pass http://yunp_backend;
    }
}
```

### 2. 数据库集群
```yaml
# PostgreSQL主从复制
version: '3.8'
services:
  postgres-master:
    image: postgres:14
    environment:
      POSTGRES_REPLICATION_MODE: master
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replicator_password
  
  postgres-slave:
    image: postgres:14
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_HOST: postgres-master
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replicator_password
```

### 3. CDN集成
```javascript
// 配置CDN
const CDN_BASE_URL = process.env.CDN_BASE_URL || '';

// 文件URL生成
function getFileUrl(filename) {
  return CDN_BASE_URL ? `${CDN_BASE_URL}/uploads/${filename}` : `/uploads/${filename}`;
}
```

## 🔍 故障排除

### 常见问题

#### 1. 数据库连接失败
```bash
# 检查数据库文件权限
ls -la database.sqlite

# 检查数据库完整性
sqlite3 database.sqlite "PRAGMA integrity_check;"
```

#### 2. 文件上传失败
```bash
# 检查上传目录权限
ls -la uploads/

# 检查磁盘空间
df -h

# 检查文件大小限制
grep MAX_FILE_SIZE .env
```

#### 3. 内存不足
```bash
# 检查内存使用
free -h
ps aux --sort=-%mem | head

# 优化Node.js内存
export NODE_OPTIONS="--max-old-space-size=2048"
```

### 日志分析
```bash
# 查看应用日志
tail -f /var/www/yunp/logs/app.log

# 查看错误日志
grep ERROR /var/www/yunp/logs/app.log

# 查看访问日志
tail -f /var/log/nginx/access.log
```

## 📞 技术支持

如果在部署过程中遇到问题，请：

1. 查看 [故障排除文档](./TROUBLESHOOTING.md)
2. 检查 [GitHub Issues](https://github.com/your-username/YunP/issues)
3. 提交新的 Issue 并提供详细的错误信息
4. 联系技术支持团队

---

**祝您部署成功！** 🎉

YunP团队致力于为您提供最佳的云存储解决方案。
