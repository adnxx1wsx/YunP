# YunP - 企业级云存储平台 🚀

YunP 是一个功能完整的**企业级云存储解决方案**，基于 Node.js 和 React 构建，提供安全、高效、智能的文件管理体验。

## 🌟 v2.0.0 重大更新

YunP 已从基础云盘系统升级为**企业级全功能云存储平台**，新增了大量高级功能和企业级特性！

### ✨ 核心亮点
- 🔧 **企业级管理后台** - 完整的用户管理、数据分析、系统监控
- 👤 **智能用户仪表板** - 存储分析、活动追踪、个性化设置
- 🛡️ **高级安全防护** - 多层安全机制、审计日志、权限控制
- 📊 **数据可视化分析** - 实时统计、趋势分析、性能监控
- 🎨 **现代化界面** - Material Design、响应式设计、流畅动画
- ⚡ **高性能架构** - 数据库优化、智能缓存、批量操作

### 📈 功能提升对比
| 模块 | v1.x | v2.0 | 提升程度 |
|------|------|------|----------|
| 后台管理 | 基础用户列表 | 全功能管理中心 | ⭐⭐⭐⭐⭐ |
| 用户界面 | 简单文件列表 | 智能仪表板 | ⭐⭐⭐⭐⭐ |
| 安全性 | 基础认证 | 企业级安全 | ⭐⭐⭐⭐⭐ |
| 性能 | 基础功能 | 高性能优化 | ⭐⭐⭐⭐ |

## ✨ 主要功能

### 🗂️ 文件管理
- 文件上传、下载、预览
- 文件夹创建、重命名、删除
- 拖拽上传支持
- 批量操作（移动、复制、删除）
- 文件搜索和过滤
- 回收站功能

### ☁️ 多云存储支持
- **本地存储** - 默认存储方式
- **OneDrive** - 微软云存储
- **Google Drive** - 谷歌云存储
- **Dropbox** - Dropbox 云存储
- **AWS S3** - 亚马逊云存储
- **Azure Blob** - 微软 Azure 存储

### 🔐 用户管理
- 用户注册、登录、认证
- JWT 令牌认证
- 个人资料管理
- 密码修改
- 邮箱验证（可选）
- 双因素认证（可选）

### 💰 订阅计费
- 多种订阅计划
- Stripe 支付集成
- 账单历史查看
- 存储配额管理
- 自动续费和取消

### 🏢 组织支持
- 团队/组织管理
- 成员权限控制
- 文件共享权限
- 组织存储配额

### 🔗 文件分享
- 公开分享链接
- 密码保护分享
- 下载次数限制
- 分享过期时间
- 预览权限控制

### 📊 数据分析
- 存储使用统计
- 文件类型分布
- 用户活动日志
- 下载统计

## 🛠️ 技术栈

### 后端
- **Node.js** + **TypeScript**
- **Express.js** - Web 框架
- **SQLite** - 数据库
- **JWT** - 身份认证
- **Multer** - 文件上传
- **Stripe** - 支付处理
- **Sharp** - 图片处理
- **FFmpeg** - 视频处理

### 前端
- **React 18** + **TypeScript**
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **React Query** - 数据获取
- **React Router** - 路由管理
- **React Hook Form** - 表单处理
- **Lucide React** - 图标库

### 云存储集成
- **Microsoft Graph API** - OneDrive
- **Google Drive API** - Google Drive
- **Dropbox API** - Dropbox
- **AWS SDK** - Amazon S3
- **Azure Storage SDK** - Azure Blob

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn
- Git

### 1. 克隆项目
```bash
git clone https://github.com/your-username/yunp.git
cd yunp
```

### 2. 安装依赖
```bash
# 安装所有依赖
npm run install:all

# 或者分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. 环境配置
```bash
# 复制环境变量文件
cp backend/.env.example backend/.env

# 编辑环境变量
nano backend/.env
```

### 4. 数据库初始化
```bash
cd backend
npm run init-db
npm run init-plans
```

### 5. 启动开发服务器
```bash
# 同时启动前后端
npm run dev

# 或者分别启动
npm run dev:backend  # 后端: http://localhost:3001
npm run dev:frontend # 前端: http://localhost:3000
```

## 🔧 配置说明

### 环境变量配置

#### 基础配置
```env
PORT=3001
NODE_ENV=development
DATABASE_URL=./database.sqlite
JWT_SECRET=your-super-secret-jwt-key
```

#### OneDrive 配置
```env
ONEDRIVE_CLIENT_ID=your_onedrive_client_id
ONEDRIVE_CLIENT_SECRET=your_onedrive_client_secret
ONEDRIVE_REDIRECT_URI=http://localhost:3001/api/storage/onedrive/callback
```

#### Google Drive 配置
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/storage/googledrive/callback
```

#### Stripe 配置
```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### 云存储提供商设置

#### OneDrive 设置
1. 访问 [Azure App Registration](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. 创建新应用注册
3. 配置重定向 URI
4. 获取客户端 ID 和密钥

#### Google Drive 设置
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google Drive API
4. 创建 OAuth 2.0 凭据
5. 配置授权重定向 URI

## 🐳 Docker 部署

### 使用 Docker Compose
```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境部署
```bash
# 使用生产配置
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📁 项目结构

```
yunp/
├── backend/                 # 后端代码
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── middleware/     # 中间件
│   │   ├── utils/          # 工具函数
│   │   └── scripts/        # 脚本文件
│   ├── uploads/            # 文件上传目录
│   └── database.sqlite     # SQLite 数据库
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API 服务
│   │   ├── contexts/       # React Context
│   │   └── utils/          # 工具函数
│   └── dist/               # 构建输出
├── shared/                 # 共享类型定义
└── docker-compose.yml      # Docker 配置
```

## 🔒 安全特性

- JWT 令牌认证
- 密码哈希存储
- 文件类型验证
- 上传大小限制
- 速率限制
- CORS 保护
- XSS 防护
- SQL 注入防护

## 📈 性能优化

- 文件缓存机制
- 图片缩略图生成
- 视频预览生成
- 数据库索引优化
- API 响应压缩
- 静态资源 CDN

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🆘 支持

如果您遇到问题或有疑问，请：

1. 查看 [文档](docs/)
2. 搜索 [Issues](https://github.com/your-username/yunp/issues)
3. 创建新的 Issue
4. 联系支持团队

## 🗺️ 路线图

- [ ] 移动端应用
- [ ] 桌面端应用
- [ ] 更多云存储提供商
- [ ] 高级搜索功能
- [ ] 文件版本控制
- [ ] 协作编辑
- [ ] API 文档
- [ ] 插件系统

---

**YunP** - 让文件存储更简单、更安全、更高效！
