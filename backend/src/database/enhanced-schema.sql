-- 增强的数据库表结构
-- 为YunP云盘系统添加更多功能表

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  settings TEXT NOT NULL, -- JSON格式存储设置
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string', -- string, number, boolean, json
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, success, warning, error
  is_read BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 文件标签表
CREATE TABLE IF NOT EXISTS file_tags (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(file_id, tag_name)
);

-- 文件收藏表
CREATE TABLE IF NOT EXISTS file_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(user_id, file_id)
);

-- 文件版本表
CREATE TABLE IF NOT EXISTS file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  checksum TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 文件评论表
CREATE TABLE IF NOT EXISTS file_comments (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id TEXT, -- 用于回复评论
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES file_comments(id) ON DELETE CASCADE
);

-- 团队表
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  max_members INTEGER DEFAULT 10,
  storage_limit INTEGER DEFAULT 10737418240, -- 10GB
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 团队成员表
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- owner, admin, member, viewer
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(team_id, user_id)
);

-- 团队文件夹表
CREATE TABLE IF NOT EXISTS team_folders (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  permissions TEXT DEFAULT 'read_write', -- read_only, read_write, admin
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES team_folders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 文件权限表
CREATE TABLE IF NOT EXISTS file_permissions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT,
  team_id TEXT,
  permission TEXT NOT NULL, -- read, write, admin
  granted_by TEXT NOT NULL,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- 文件同步状态表
CREATE TABLE IF NOT EXISTS file_sync_status (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- onedrive, googledrive, dropbox, etc.
  remote_id TEXT,
  remote_path TEXT,
  sync_status TEXT DEFAULT 'pending', -- pending, syncing, synced, error
  last_sync_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 下载统计表
CREATE TABLE IF NOT EXISTS download_stats (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  download_size INTEGER,
  download_time INTEGER, -- 下载耗时（毫秒）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 存储使用统计表
CREATE TABLE IF NOT EXISTS storage_usage_stats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  total_files INTEGER DEFAULT 0,
  total_size INTEGER DEFAULT 0,
  uploaded_files INTEGER DEFAULT 0,
  uploaded_size INTEGER DEFAULT 0,
  deleted_files INTEGER DEFAULT 0,
  deleted_size INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, date)
);

-- API密钥表
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  permissions TEXT DEFAULT 'read', -- read, write, admin
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Webhook表
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON数组，如["file.upload", "file.delete"]
  secret TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT, -- file, folder, user, team, etc.
  resource_id TEXT,
  old_values TEXT, -- JSON格式
  new_values TEXT, -- JSON格式
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 系统任务表
CREATE TABLE IF NOT EXISTS system_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- backup, cleanup, sync, etc.
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  progress INTEGER DEFAULT 0, -- 0-100
  result TEXT, -- JSON格式的结果
  error_message TEXT,
  scheduled_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 文件缩略图表
CREATE TABLE IF NOT EXISTS file_thumbnails (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  size TEXT NOT NULL, -- small, medium, large
  width INTEGER,
  height INTEGER,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  UNIQUE(file_id, size)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_file_tags_file_id ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag_name ON file_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_file_favorites_user_id ON file_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_file_id ON file_comments(file_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_file_permissions_file_id ON file_permissions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_sync_status_file_id ON file_sync_status(file_id);
CREATE INDEX IF NOT EXISTS idx_download_stats_file_id ON download_stats(file_id);
CREATE INDEX IF NOT EXISTS idx_download_stats_created_at ON download_stats(created_at);
CREATE INDEX IF NOT EXISTS idx_storage_usage_stats_user_id ON storage_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_usage_stats_date ON storage_usage_stats(date);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_tasks_status ON system_tasks(status);
CREATE INDEX IF NOT EXISTS idx_file_thumbnails_file_id ON file_thumbnails(file_id);

-- 插入默认系统配置
INSERT OR IGNORE INTO system_config (key, value, type, description) VALUES
('site_name', 'YunP Cloud Storage', 'string', '网站名称'),
('site_description', '安全、快速、可靠的云存储服务', 'string', '网站描述'),
('max_file_size', '104857600', 'number', '最大文件大小（字节）'),
('allowed_file_types', '["image/*", "video/*", "audio/*", "application/pdf", "text/*"]', 'json', '允许的文件类型'),
('default_storage_limit', '5368709120', 'number', '默认存储限制（字节）'),
('enable_registration', 'true', 'boolean', '是否允许用户注册'),
('enable_file_sharing', 'true', 'boolean', '是否允许文件分享'),
('enable_teams', 'true', 'boolean', '是否启用团队功能'),
('maintenance_mode', 'false', 'boolean', '维护模式'),
('backup_retention_days', '30', 'number', '备份保留天数'),
('session_timeout', '86400', 'number', '会话超时时间（秒）'),
('rate_limit_requests', '100', 'number', '速率限制请求数'),
('rate_limit_window', '900', 'number', '速率限制时间窗口（秒）');
