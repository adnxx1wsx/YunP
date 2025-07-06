const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

console.log('🗄️ 初始化YunP数据库...');

// 数据库文件路径
const dbPath = path.join(__dirname, '../../database.sqlite');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 基础表结构SQL
const createTablesSQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  is_suspended BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  storage_used INTEGER DEFAULT 0,
  storage_limit INTEGER DEFAULT 5368709120,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);

-- 文件夹表
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 文件表
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  preview_path TEXT,
  checksum TEXT,
  folder_id TEXT,
  user_id TEXT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  share_token TEXT,
  share_expires_at DATETIME,
  download_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 公开分享表
CREATE TABLE IF NOT EXISTS public_shares (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  password TEXT,
  download_limit INTEGER,
  download_count INTEGER DEFAULT 0,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 用户订阅表
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  storage_limit INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  current_period_start DATETIME,
  current_period_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 用户存储提供商表
CREATE TABLE IF NOT EXISTS user_storage_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 活动日志表
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 回收站表
CREATE TABLE IF NOT EXISTS trash (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_id TEXT NOT NULL,
  original_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  original_data TEXT,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

// 创建索引SQL
const createIndexesSQL = `
-- 用户相关索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 文件相关索引
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token);

-- 文件夹相关索引
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- 分享相关索引
CREATE INDEX IF NOT EXISTS idx_public_shares_token ON public_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_public_shares_file_id ON public_shares(file_id);

-- 活动日志索引
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
`;

// 初始化数据库
async function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 创建表
      db.exec(createTablesSQL, (err) => {
        if (err) {
          console.error('❌ 创建表失败:', err.message);
          reject(err);
          return;
        }
        console.log('✅ 基础表创建成功');
      });

      // 创建索引
      db.exec(createIndexesSQL, (err) => {
        if (err) {
          console.error('❌ 创建索引失败:', err.message);
          reject(err);
          return;
        }
        console.log('✅ 索引创建成功');
      });

      // 应用增强架构
      const enhancedSchemaPath = path.join(__dirname, '../database/enhanced-schema.sql');
      if (fs.existsSync(enhancedSchemaPath)) {
        const enhancedSQL = fs.readFileSync(enhancedSchemaPath, 'utf8');
        db.exec(enhancedSQL, (err) => {
          if (err) {
            console.error('❌ 增强架构应用失败:', err.message);
          } else {
            console.log('✅ 增强数据库架构应用成功');
          }
        });
      }

      resolve();
    });
  });
}

// 创建默认管理员用户
async function createAdminUser() {
  return new Promise(async (resolve, reject) => {
    const adminId = uuidv4();
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const insertAdmin = `
      INSERT OR IGNORE INTO users (
        id, username, email, password, role, storage_limit, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    
    db.run(insertAdmin, [
      adminId,
      'admin',
      'admin@yunp.com',
      hashedPassword,
      'admin',
      107374182400 // 100GB for admin
    ], function(err) {
      if (err) {
        console.error('❌ 创建管理员用户失败:', err.message);
        reject(err);
        return;
      }
      
      if (this.changes > 0) {
        console.log('✅ 默认管理员用户创建成功');
        console.log('   用户名: admin');
        console.log('   密码: admin123');
        console.log('   邮箱: admin@yunp.com');
        console.log('   ⚠️  请在首次登录后立即修改密码!');
      } else {
        console.log('ℹ️  管理员用户已存在');
      }
      
      resolve();
    });
  });
}

// 主函数
async function main() {
  try {
    await initDatabase();
    await createAdminUser();
    
    console.log('');
    console.log('🎉 数据库初始化完成!');
    console.log('');
    console.log('📋 下一步:');
    console.log('1. 启动后端服务: npm start');
    console.log('2. 访问系统: http://localhost:3001');
    console.log('3. 使用管理员账户登录');
    console.log('');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('❌ 关闭数据库连接失败:', err.message);
      }
    });
  }
}

// 运行初始化
main();
