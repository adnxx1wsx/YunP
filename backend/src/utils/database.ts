import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';

const DATABASE_PATH = process.env.DATABASE_URL || './database.sqlite';

let db: sqlite3.Database;

export const getDatabase = (): sqlite3.Database => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

export const initDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DATABASE_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      createTables()
        .then(() => resolve())
        .catch(reject);
    });
  });
};

const createTables = async (): Promise<void> => {
  const queries = [
    // 用户表
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      storage_used INTEGER DEFAULT 0,
      storage_limit INTEGER DEFAULT 5368709120,
      email_verified BOOLEAN DEFAULT FALSE,
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      two_factor_secret TEXT,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 文件夹表
    `CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      user_id TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES folders (id) ON DELETE CASCADE
    )`,
    
    // 文件表
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      path TEXT NOT NULL,
      folder_id TEXT,
      user_id TEXT NOT NULL,
      provider_id TEXT,
      remote_id TEXT,
      remote_path TEXT,
      checksum TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      share_token TEXT,
      download_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      thumbnail_path TEXT,
      preview_available BOOLEAN DEFAULT FALSE,
      sync_status TEXT DEFAULT 'synced',
      last_sync_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL,
      FOREIGN KEY (provider_id) REFERENCES user_storage_providers (id) ON DELETE SET NULL
    )`,
    
    // 文件分享表
    `CREATE TABLE IF NOT EXISTS file_shares (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      share_token TEXT UNIQUE NOT NULL,
      expires_at DATETIME,
      download_limit INTEGER,
      download_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
    )`,
    
    // 回收站表
    `CREATE TABLE IF NOT EXISTS trash (
      id TEXT PRIMARY KEY,
      original_id TEXT NOT NULL,
      original_type TEXT NOT NULL CHECK (original_type IN ('file', 'folder')),
      original_name TEXT NOT NULL,
      original_path TEXT NOT NULL,
      user_id TEXT NOT NULL,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // 用户存储提供商表
    `CREATE TABLE IF NOT EXISTS user_storage_providers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_default BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      access_token TEXT,
      refresh_token TEXT,
      expires_at DATETIME,
      quota_total INTEGER DEFAULT 0,
      quota_used INTEGER DEFAULT 0,
      quota_available INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // 订阅计划表
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      currency TEXT DEFAULT 'USD',
      interval TEXT CHECK (interval IN ('month', 'year')) NOT NULL,
      storage_limit INTEGER NOT NULL,
      max_file_size INTEGER NOT NULL,
      max_files INTEGER NOT NULL,
      cloud_providers TEXT, -- JSON array
      advanced_sharing BOOLEAN DEFAULT FALSE,
      api_access BOOLEAN DEFAULT FALSE,
      priority_support BOOLEAN DEFAULT FALSE,
      custom_branding BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 用户订阅表
    `CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT CHECK (status IN ('active', 'canceled', 'expired', 'past_due')) NOT NULL,
      current_period_start DATETIME NOT NULL,
      current_period_end DATETIME NOT NULL,
      cancel_at_period_end BOOLEAN DEFAULT FALSE,
      stripe_subscription_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans (id) ON DELETE RESTRICT
    )`,

    // 文件版本表
    `CREATE TABLE IF NOT EXISTS file_versions (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      size INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      path TEXT NOT NULL,
      provider_id TEXT,
      remote_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
      FOREIGN KEY (provider_id) REFERENCES user_storage_providers (id) ON DELETE SET NULL
    )`,

    // 组织表
    `CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      logo TEXT,
      owner_id TEXT NOT NULL,
      plan_id TEXT,
      allow_public_sharing BOOLEAN DEFAULT TRUE,
      allow_external_sharing BOOLEAN DEFAULT TRUE,
      enforce_password_policy BOOLEAN DEFAULT FALSE,
      require_two_factor BOOLEAN DEFAULT FALSE,
      max_member_count INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES subscription_plans (id) ON DELETE SET NULL
    )`,

    // 组织成员表
    `CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) NOT NULL,
      permissions TEXT, -- JSON array
      invited_by TEXT,
      joined_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL,
      UNIQUE(organization_id, user_id)
    )`,

    // 文件权限表
    `CREATE TABLE IF NOT EXISTS file_permissions (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      user_id TEXT,
      organization_id TEXT,
      permission TEXT CHECK (permission IN ('read', 'write', 'admin')) NOT NULL,
      granted_by TEXT NOT NULL,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // 活动日志表
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      organization_id TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      metadata TEXT, -- JSON
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
    )`,

    // 文件标签表
    `CREATE TABLE IF NOT EXISTS file_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      user_id TEXT NOT NULL,
      organization_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
      UNIQUE(name, user_id, organization_id)
    )`,

    // 文件标签关联表
    `CREATE TABLE IF NOT EXISTS file_tag_associations (
      file_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (file_id, tag_id),
      FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES file_tags (id) ON DELETE CASCADE
    )`,

    // 公共分享表
    `CREATE TABLE IF NOT EXISTS public_shares (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      password TEXT,
      allow_download BOOLEAN DEFAULT TRUE,
      allow_preview BOOLEAN DEFAULT TRUE,
      expires_at DATETIME,
      download_limit INTEGER,
      download_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // 批量操作表
    `CREATE TABLE IF NOT EXISTS batch_operations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT CHECK (type IN ('move', 'copy', 'delete', 'share', 'tag')) NOT NULL,
      status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
      total_items INTEGER NOT NULL,
      processed_items INTEGER DEFAULT 0,
      failed_items INTEGER DEFAULT 0,
      metadata TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // 系统配置表
    `CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT CHECK (type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 邮件验证表
    `CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`,

    // 密码重置表
    `CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`
  ];
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)',
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)',
    'CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders (parent_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_user_id ON files (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files (folder_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_share_token ON files (share_token)',
    'CREATE INDEX IF NOT EXISTS idx_files_provider_id ON files (provider_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_remote_id ON files (remote_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_sync_status ON files (sync_status)',
    'CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares (share_token)',
    'CREATE INDEX IF NOT EXISTS idx_trash_user_id ON trash (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_storage_providers_user_id ON user_storage_providers (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_storage_providers_provider ON user_storage_providers (provider)',
    'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status)',
    'CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions (file_id)',
    'CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members (organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_permissions_file_id ON file_permissions (file_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_permissions_user_id ON file_permissions (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at)',
    'CREATE INDEX IF NOT EXISTS idx_file_tags_user_id ON file_tags (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_tags_org_id ON file_tags (organization_id)',
    'CREATE INDEX IF NOT EXISTS idx_public_shares_token ON public_shares (token)',
    'CREATE INDEX IF NOT EXISTS idx_public_shares_file_id ON public_shares (file_id)',
    'CREATE INDEX IF NOT EXISTS idx_batch_operations_user_id ON batch_operations (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_batch_operations_status ON batch_operations (status)',
    'CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications (token)',
    'CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token)'
  ];
  
  return new Promise((resolve, reject) => {
    const allQueries = [...queries, ...indexes];
    let completed = 0;
    
    const executeNext = () => {
      if (completed >= allQueries.length) {
        console.log('All database tables and indexes created successfully');
        resolve();
        return;
      }
      
      const query = allQueries[completed];
      db.run(query, (err) => {
        if (err) {
          console.error(`Error executing query: ${query}`, err);
          reject(err);
          return;
        }
        
        completed++;
        executeNext();
      });
    };
    
    executeNext();
  });
};

// 数据库查询辅助函数
export const dbGet = <T = any>(query: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T);
      }
    });
  });
};

export const dbAll = <T = any>(query: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
};

export const dbRun = (query: string, params: any[] = []): Promise<sqlite3.RunResult> => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

// 确保上传目录存在
export const ensureUploadDir = async (): Promise<void> => {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log(`Created upload directory: ${uploadDir}`);
  }
};
