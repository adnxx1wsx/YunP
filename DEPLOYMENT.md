# YunP 部署指南

本文档介绍如何在生产环境中部署 YunP 云盘系统。

## 🚀 快速部署

### 使用 Docker Compose（推荐）

1. **克隆项目**
```bash
git clone https://github.com/your-username/yunp.git
cd yunp
```

2. **配置环境变量**
```bash
cp backend/.env.example backend/.env
# 编辑 .env 文件，配置生产环境变量
nano backend/.env
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **初始化数据库**
```bash
docker-compose exec backend npm run init-db
docker-compose exec backend npm run init-plans
```

### 手动部署

#### 1. 环境准备
- Node.js 18+
- Nginx（可选，用于反向代理）
- SSL 证书（生产环境推荐）

#### 2. 构建项目
```bash
# 安装依赖
npm run install:all

# 构建前后端
npm run build
```

#### 3. 配置环境变量
```bash
# 生产环境配置
export NODE_ENV=production
export PORT=3001
export DATABASE_URL=/path/to/production/database.sqlite
export JWT_SECRET=your-super-secure-jwt-secret
export UPLOAD_DIR=/path/to/uploads

# 云存储配置
export ONEDRIVE_CLIENT_ID=your_onedrive_client_id
export ONEDRIVE_CLIENT_SECRET=your_onedrive_client_secret
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret

# Stripe 配置
export STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
export STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

#### 4. 启动服务
```bash
# 使用 PM2 管理进程
npm install -g pm2
pm2 start backend/dist/app.js --name yunp-backend

# 或使用 systemd
sudo systemctl start yunp
```

## 🔧 Nginx 配置

创建 `/etc/nginx/sites-available/yunp` 文件：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # 前端静态文件
    location / {
        root /path/to/yunp/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 文件上传大小限制
        client_max_body_size 100M;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

启用站点：
```bash
sudo ln -s /etc/nginx/sites-available/yunp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🗄️ 数据库配置

### SQLite（默认）
- 适合小型部署
- 数据文件位置：`backend/database.sqlite`
- 备份：定期复制数据库文件

### PostgreSQL（推荐生产环境）
1. **安装 PostgreSQL**
```bash
sudo apt install postgresql postgresql-contrib
```

2. **创建数据库和用户**
```sql
CREATE DATABASE yunp;
CREATE USER yunp_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE yunp TO yunp_user;
```

3. **更新环境变量**
```bash
export DATABASE_URL=postgresql://yunp_user:secure_password@localhost:5432/yunp
```

## 🔐 SSL 证书配置

### 使用 Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 自动续期
```bash
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 监控和日志

### 使用 PM2 监控
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs yunp-backend

# 监控面板
pm2 monit
```

### 日志配置
在 `backend/.env` 中配置：
```bash
LOG_LEVEL=info
LOG_FILE=/var/log/yunp/app.log
```

### 系统监控
推荐使用以下工具：
- **Prometheus + Grafana** - 系统监控
- **ELK Stack** - 日志分析
- **Uptime Robot** - 服务可用性监控

## 🔄 备份策略

### 数据库备份
```bash
# SQLite 备份
cp backend/database.sqlite backup/database-$(date +%Y%m%d).sqlite

# PostgreSQL 备份
pg_dump yunp > backup/yunp-$(date +%Y%m%d).sql
```

### 文件备份
```bash
# 备份上传的文件
tar -czf backup/uploads-$(date +%Y%m%d).tar.gz backend/uploads/
```

### 自动备份脚本
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/path/to/backup"
DATE=$(date +%Y%m%d)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp backend/database.sqlite $BACKUP_DIR/database-$DATE.sqlite

# 备份文件
tar -czf $BACKUP_DIR/uploads-$DATE.tar.gz backend/uploads/

# 删除 7 天前的备份
find $BACKUP_DIR -name "*.sqlite" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

添加到 crontab：
```bash
0 2 * * * /path/to/backup.sh
```

## 🚨 故障排除

### 常见问题

1. **文件上传失败**
   - 检查磁盘空间
   - 检查文件权限
   - 检查 Nginx 上传大小限制

2. **云存储连接失败**
   - 验证 API 密钥
   - 检查网络连接
   - 查看错误日志

3. **数据库连接错误**
   - 检查数据库服务状态
   - 验证连接字符串
   - 检查权限设置

### 日志查看
```bash
# 应用日志
pm2 logs yunp-backend

# Nginx 日志
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# 系统日志
sudo journalctl -u yunp -f
```

## 🔧 性能优化

### 应用层优化
- 启用 Redis 缓存
- 配置文件压缩
- 使用 CDN 加速静态资源

### 数据库优化
- 定期清理日志
- 优化查询索引
- 配置连接池

### 服务器优化
- 调整文件描述符限制
- 配置内存和 CPU 限制
- 启用 HTTP/2

## 📈 扩展部署

### 负载均衡
使用 Nginx 或 HAProxy 进行负载均衡：

```nginx
upstream yunp_backend {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    location /api {
        proxy_pass http://yunp_backend;
    }
}
```

### 容器化部署
使用 Docker Swarm 或 Kubernetes 进行容器编排。

### 云平台部署
- **AWS**: 使用 ECS、RDS、S3
- **Azure**: 使用 Container Instances、SQL Database、Blob Storage
- **Google Cloud**: 使用 Cloud Run、Cloud SQL、Cloud Storage

---

如需更多帮助，请查看项目文档或提交 Issue。
