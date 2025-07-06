import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { dbGet, dbAll, dbRun } from '../utils/database';
import { QueueManager } from '../services/QueueManager';
import { cache } from '../utils/cache';
import { log } from '../utils/logger';
import { getHealthStats } from '../middleware/performance';

const router = express.Router();

// 管理员权限检查中间件
const requireAdmin = async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const userId = req.user!.id;
  
  // 检查用户是否为管理员
  const user = await dbGet('SELECT is_admin FROM users WHERE id = ?', [userId]);
  
  if (!user || !user.is_admin) {
    throw createError('Access denied. Admin privileges required.', 403);
  }
  
  next();
};

// 所有管理员路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取系统统计信息
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const stats = await Promise.all([
    // 用户统计
    dbGet('SELECT COUNT(*) as total FROM users'),
    dbGet('SELECT COUNT(*) as active FROM users WHERE last_login_at > datetime("now", "-30 days")'),
    dbGet('SELECT COUNT(*) as new FROM users WHERE created_at > datetime("now", "-7 days")'),
    
    // 文件统计
    dbGet('SELECT COUNT(*) as total, SUM(size) as totalSize FROM files'),
    dbGet('SELECT COUNT(*) as uploaded FROM files WHERE created_at > datetime("now", "-24 hours")'),
    
    // 存储统计
    dbGet('SELECT SUM(storage_used) as totalUsed, SUM(storage_limit) as totalLimit FROM users'),
    
    // 订阅统计
    dbGet('SELECT COUNT(*) as active FROM user_subscriptions WHERE status = "active"'),
    dbGet('SELECT COUNT(*) as canceled FROM user_subscriptions WHERE status = "canceled"'),
  ]);

  const [
    userTotal, userActive, userNew,
    fileStats, fileUploaded,
    storageStats,
    subscriptionActive, subscriptionCanceled
  ] = stats;

  res.json({
    success: true,
    data: {
      users: {
        total: userTotal.total,
        active: userActive.active,
        new: userNew.new
      },
      files: {
        total: fileStats.total,
        totalSize: fileStats.totalSize || 0,
        uploadedToday: fileUploaded.uploaded
      },
      storage: {
        used: storageStats.totalUsed || 0,
        limit: storageStats.totalLimit || 0,
        utilization: storageStats.totalLimit ? 
          Math.round((storageStats.totalUsed / storageStats.totalLimit) * 100) : 0
      },
      subscriptions: {
        active: subscriptionActive.active,
        canceled: subscriptionCanceled.canceled
      },
      system: getHealthStats()
    }
  });
}));

// 获取用户列表
router.get('/users', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { page = 1, limit = 20, search, status } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let whereClause = '';
  const params: any[] = [];

  if (search) {
    whereClause += ' WHERE (username LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status) {
    const statusClause = status === 'active' ? 
      'last_login_at > datetime("now", "-30 days")' : 
      'last_login_at IS NULL OR last_login_at <= datetime("now", "-30 days")';
    
    whereClause += whereClause ? ` AND ${statusClause}` : ` WHERE ${statusClause}`;
  }

  const users = await dbAll(
    `SELECT id, username, email, storage_used, storage_limit, 
            email_verified, is_admin, created_at, last_login_at
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit as string), offset]
  );

  const totalCount = await dbGet(
    `SELECT COUNT(*) as count FROM users ${whereClause}`,
    params
  );

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / parseInt(limit as string))
      }
    }
  });
}));

// 获取用户详情
router.get('/users/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  const user = await dbGet(
    `SELECT id, username, email, storage_used, storage_limit, 
            email_verified, is_admin, created_at, last_login_at, updated_at
     FROM users WHERE id = ?`,
    [id]
  );

  if (!user) {
    throw createError('User not found', 404);
  }

  // 获取用户的文件统计
  const fileStats = await dbGet(
    'SELECT COUNT(*) as fileCount, SUM(size) as totalSize FROM files WHERE user_id = ?',
    [id]
  );

  // 获取用户的订阅信息
  const subscription = await dbGet(
    `SELECT us.*, sp.display_name as plan_name 
     FROM user_subscriptions us
     JOIN subscription_plans sp ON us.plan_id = sp.id
     WHERE us.user_id = ? AND us.status = 'active'
     ORDER BY us.created_at DESC LIMIT 1`,
    [id]
  );

  // 获取用户的存储提供商
  const providers = await dbAll(
    'SELECT provider, display_name, is_default, quota_used, quota_total FROM user_storage_providers WHERE user_id = ? AND is_active = 1',
    [id]
  );

  res.json({
    success: true,
    data: {
      user,
      stats: {
        fileCount: fileStats.fileCount || 0,
        totalSize: fileStats.totalSize || 0
      },
      subscription,
      providers
    }
  });
}));

// 更新用户信息
router.put('/users/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { storage_limit, is_admin, email_verified } = req.body;

  const user = await dbGet('SELECT id FROM users WHERE id = ?', [id]);
  if (!user) {
    throw createError('User not found', 404);
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (storage_limit !== undefined) {
    updates.push('storage_limit = ?');
    params.push(storage_limit);
  }

  if (is_admin !== undefined) {
    updates.push('is_admin = ?');
    params.push(is_admin);
  }

  if (email_verified !== undefined) {
    updates.push('email_verified = ?');
    params.push(email_verified);
  }

  if (updates.length === 0) {
    throw createError('No valid fields to update', 400);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await dbRun(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  log.info(`Admin ${req.user!.id} updated user ${id}`, { 
    adminId: req.user!.id, 
    targetUserId: id, 
    updates: req.body 
  });

  res.json({
    success: true,
    message: 'User updated successfully'
  });
}));

// 删除用户
router.delete('/users/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  if (id === req.user!.id) {
    throw createError('Cannot delete your own account', 400);
  }

  const user = await dbGet('SELECT id, username FROM users WHERE id = ?', [id]);
  if (!user) {
    throw createError('User not found', 404);
  }

  // 删除用户（级联删除会处理相关数据）
  await dbRun('DELETE FROM users WHERE id = ?', [id]);

  log.warn(`Admin ${req.user!.id} deleted user ${id} (${user.username})`, {
    adminId: req.user!.id,
    deletedUserId: id,
    deletedUsername: user.username
  });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

// 获取系统日志
router.get('/logs', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { level = 'info', limit = 100, page = 1 } = req.query;
  
  // 这里应该从日志文件或日志数据库读取
  // 简化实现，返回活动日志
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  
  const logs = await dbAll(
    `SELECT * FROM activity_logs 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [parseInt(limit as string), offset]
  );

  const totalCount = await dbGet('SELECT COUNT(*) as count FROM activity_logs');

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / parseInt(limit as string))
      }
    }
  });
}));

// 获取队列状态
router.get('/queues', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const stats = await QueueManager.getQueueStats();
  
  res.json({
    success: true,
    data: stats
  });
}));

// 清理队列
router.post('/queues/clean', asyncHandler(async (req: AuthenticatedRequest, res) => {
  await QueueManager.cleanAllQueues();
  
  log.info(`Admin ${req.user!.id} cleaned all queues`);
  
  res.json({
    success: true,
    message: 'All queues cleaned successfully'
  });
}));

// 获取缓存统计
router.get('/cache', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const stats = cache.getStats();
  
  res.json({
    success: true,
    data: stats
  });
}));

// 清理缓存
router.delete('/cache', asyncHandler(async (req: AuthenticatedRequest, res) => {
  await cache.clear();
  
  log.info(`Admin ${req.user!.id} cleared cache`);
  
  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
}));

// 系统配置
router.get('/config', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const configs = await dbAll('SELECT key, value, type, description FROM system_config ORDER BY key');
  
  res.json({
    success: true,
    data: configs
  });
}));

// 更新系统配置
router.put('/config/:key', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { key } = req.params;
  const { value, type = 'string' } = req.body;

  await dbRun(
    'INSERT OR REPLACE INTO system_config (key, value, type, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
    [key, value, type]
  );

  log.info(`Admin ${req.user!.id} updated system config: ${key}`, {
    adminId: req.user!.id,
    configKey: key,
    newValue: value
  });

  res.json({
    success: true,
    message: 'Configuration updated successfully'
  });
}));

// 获取文件列表（管理员）
router.get('/files', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { page = 1, limit = 20, search, type, dateRange } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let whereClause = '';
  const params: any[] = [];

  if (search) {
    whereClause += ' WHERE (f.original_name LIKE ? OR f.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (type && type !== 'all') {
    const typeClause = type === 'image' ? 'f.mime_type LIKE "image/%"' :
                      type === 'video' ? 'f.mime_type LIKE "video/%"' :
                      type === 'document' ? 'f.mime_type LIKE "application/%" OR f.mime_type LIKE "text/%"' :
                      'f.mime_type NOT LIKE "image/%" AND f.mime_type NOT LIKE "video/%" AND f.mime_type NOT LIKE "application/%" AND f.mime_type NOT LIKE "text/%"';

    whereClause += whereClause ? ` AND ${typeClause}` : ` WHERE ${typeClause}`;
  }

  if (dateRange && dateRange !== 'all') {
    const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 0;
    if (days > 0) {
      const dateClause = `f.created_at > datetime("now", "-${days} days")`;
      whereClause += whereClause ? ` AND ${dateClause}` : ` WHERE ${dateClause}`;
    }
  }

  const files = await dbAll(
    `SELECT f.id, f.original_name as name, f.size, f.mime_type, f.created_at,
            u.username, u.email
     FROM files f
     JOIN users u ON f.user_id = u.id
     ${whereClause}
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit as string), offset]
  );

  const totalCount = await dbGet(
    `SELECT COUNT(*) as count
     FROM files f
     JOIN users u ON f.user_id = u.id
     ${whereClause}`,
    params
  );

  res.json({
    success: true,
    data: {
      files,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / parseInt(limit as string))
      }
    }
  });
}));

// 删除文件（管理员）
router.delete('/files/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  const file = await dbGet('SELECT * FROM files WHERE id = ?', [id]);
  if (!file) {
    throw createError('File not found', 404);
  }

  // 删除物理文件
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const filePath = path.join(process.env.UPLOAD_DIR || './uploads', file.name);
    await fs.unlink(filePath);
  } catch (error) {
    log.warn(`Failed to delete physical file: ${file.name}`, error);
  }

  // 删除数据库记录
  await dbRun('DELETE FROM files WHERE id = ?', [id]);

  log.info(`Admin ${req.user!.id} deleted file ${id}`);

  res.json({
    success: true,
    message: 'File deleted successfully'
  });
}));

// 获取系统信息
router.get('/system', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const os = require('os');
  const process = require('process');

  const systemInfo = {
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
    },
    cpu: {
      model: os.cpus()[0].model,
      cores: os.cpus().length,
      loadAverage: os.loadavg()
    },
    platform: {
      type: os.type(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release()
    },
    network: os.networkInterfaces()
  };

  res.json({
    success: true,
    data: systemInfo
  });
}));

// 获取系统配置
router.get('/config', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const configs = await dbAll('SELECT * FROM system_config ORDER BY key');

  res.json({
    success: true,
    data: configs
  });
}));

// 更新系统配置
router.put('/config/:key', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { key } = req.params;
  const { value, type = 'string' } = req.body;

  await dbRun(
    `INSERT OR REPLACE INTO system_config (key, value, type, updated_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [key, String(value), type]
  );

  log.info(`Admin ${req.user!.id} updated config ${key} = ${value}`);

  res.json({
    success: true,
    message: 'Configuration updated successfully'
  });
}));

// 获取活动日志
router.get('/activity-logs', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { page = 1, limit = 50, action, userId, dateRange } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let whereClause = '';
  const params: any[] = [];

  if (action) {
    whereClause += ' WHERE action = ?';
    params.push(action);
  }

  if (userId) {
    const userClause = 'user_id = ?';
    whereClause += whereClause ? ` AND ${userClause}` : ` WHERE ${userClause}`;
    params.push(userId);
  }

  if (dateRange && dateRange !== 'all') {
    const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 0;
    if (days > 0) {
      const dateClause = `created_at > datetime("now", "-${days} days")`;
      whereClause += whereClause ? ` AND ${dateClause}` : ` WHERE ${dateClause}`;
    }
  }

  const logs = await dbAll(
    `SELECT al.*, u.username
     FROM activity_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit as string), offset]
  );

  const totalCount = await dbGet(
    `SELECT COUNT(*) as count FROM activity_logs ${whereClause}`,
    params
  );

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / parseInt(limit as string))
      }
    }
  });
}));

// 系统备份
router.post('/backup', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const fs = require('fs').promises;
  const path = require('path');
  const archiver = require('archiver');

  const backupDir = path.join(process.cwd(), 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.zip`);

  // 确保备份目录存在
  await fs.mkdir(backupDir, { recursive: true });

  const output = require('fs').createWriteStream(backupFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);

  // 添加数据库文件
  const dbPath = process.env.DATABASE_URL || './database.sqlite';
  if (await fs.access(dbPath).then(() => true).catch(() => false)) {
    archive.file(dbPath, { name: 'database.sqlite' });
  }

  // 添加上传文件目录
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (await fs.access(uploadDir).then(() => true).catch(() => false)) {
    archive.directory(uploadDir, 'uploads');
  }

  await archive.finalize();

  log.info(`Admin ${req.user!.id} created system backup: ${backupFile}`);

  res.json({
    success: true,
    message: 'Backup created successfully',
    data: {
      filename: path.basename(backupFile),
      size: (await fs.stat(backupFile)).size
    }
  });
}));

// 获取用户活动统计
router.get('/analytics/users', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { period = '30d' } = req.query;

  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;

  // 用户注册趋势
  const registrationTrend = await dbAll(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM users
     WHERE created_at > datetime('now', '-${days} days')
     GROUP BY DATE(created_at)
     ORDER BY date`,
    []
  );

  // 活跃用户趋势
  const activityTrend = await dbAll(
    `SELECT DATE(last_login_at) as date, COUNT(DISTINCT user_id) as count
     FROM activity_logs
     WHERE created_at > datetime('now', '-${days} days')
     GROUP BY DATE(last_login_at)
     ORDER BY date`,
    []
  );

  // 用户地理分布（模拟数据）
  const geoDistribution = [
    { country: 'China', users: 1250, percentage: 65 },
    { country: 'United States', users: 380, percentage: 20 },
    { country: 'Japan', users: 190, percentage: 10 },
    { country: 'Others', users: 95, percentage: 5 }
  ];

  res.json({
    success: true,
    data: {
      registrationTrend,
      activityTrend,
      geoDistribution,
      summary: {
        totalUsers: await dbGet('SELECT COUNT(*) as count FROM users').then(r => r.count),
        activeUsers: await dbGet('SELECT COUNT(*) as count FROM users WHERE last_login_at > datetime("now", "-30 days")').then(r => r.count),
        newUsers: await dbGet('SELECT COUNT(*) as count FROM users WHERE created_at > datetime("now", "-7 days")').then(r => r.count)
      }
    }
  });
}));

// 获取文件统计分析
router.get('/analytics/files', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { period = '30d' } = req.query;

  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;

  // 文件上传趋势
  const uploadTrend = await dbAll(
    `SELECT DATE(created_at) as date, COUNT(*) as count, SUM(size) as totalSize
     FROM files
     WHERE created_at > datetime('now', '-${days} days')
     GROUP BY DATE(created_at)
     ORDER BY date`,
    []
  );

  // 文件类型分布
  const typeDistribution = await dbAll(
    `SELECT
       CASE
         WHEN mime_type LIKE 'image/%' THEN 'Images'
         WHEN mime_type LIKE 'video/%' THEN 'Videos'
         WHEN mime_type LIKE 'audio/%' THEN 'Audio'
         WHEN mime_type LIKE 'application/pdf' OR mime_type LIKE 'text/%' THEN 'Documents'
         ELSE 'Others'
       END as type,
       COUNT(*) as count,
       SUM(size) as totalSize
     FROM files
     GROUP BY type
     ORDER BY count DESC`,
    []
  );

  // 存储使用统计
  const storageStats = await dbGet(
    `SELECT
       COUNT(*) as totalFiles,
       SUM(size) as totalSize,
       AVG(size) as avgSize,
       MAX(size) as maxSize
     FROM files`,
    []
  );

  res.json({
    success: true,
    data: {
      uploadTrend,
      typeDistribution,
      storageStats,
      summary: {
        totalFiles: storageStats.totalFiles,
        totalSize: storageStats.totalSize,
        avgFileSize: storageStats.avgSize,
        largestFile: storageStats.maxSize
      }
    }
  });
}));

// 系统健康检查
router.get('/health', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'healthy',
      storage: 'healthy',
      cache: 'healthy',
      queue: 'healthy'
    },
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  };

  try {
    // 检查数据库连接
    await dbGet('SELECT 1');
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }

  try {
    // 检查缓存
    await cache.get('health-check');
    health.services.cache = 'healthy';
  } catch (error) {
    health.services.cache = 'unhealthy';
    health.status = 'degraded';
  }

  res.json({
    success: true,
    data: health
  });
}));

// 发送系统通知
router.post('/notifications', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { title, message, type = 'info', targetUsers = 'all' } = req.body;

  // 创建系统通知
  const notificationId = uuidv4();

  if (targetUsers === 'all') {
    // 发送给所有用户
    const users = await dbAll('SELECT id FROM users');

    for (const user of users) {
      await dbRun(
        `INSERT INTO notifications (id, user_id, title, message, type, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [uuidv4(), user.id, title, message, type]
      );
    }
  } else if (Array.isArray(targetUsers)) {
    // 发送给指定用户
    for (const userId of targetUsers) {
      await dbRun(
        `INSERT INTO notifications (id, user_id, title, message, type, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [uuidv4(), userId, title, message, type]
      );
    }
  }

  log.info(`Admin ${req.user!.id} sent notification: ${title}`);

  res.json({
    success: true,
    message: 'Notification sent successfully'
  });
}));

// 批量用户操作
router.post('/users/batch', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { action, userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw createError('Invalid user IDs', 400);
  }

  let result;

  switch (action) {
    case 'suspend':
      result = await dbRun(
        `UPDATE users SET is_suspended = TRUE, updated_at = datetime('now')
         WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      );
      break;

    case 'unsuspend':
      result = await dbRun(
        `UPDATE users SET is_suspended = FALSE, updated_at = datetime('now')
         WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      );
      break;

    case 'delete':
      // 软删除用户
      result = await dbRun(
        `UPDATE users SET is_deleted = TRUE, deleted_at = datetime('now')
         WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      );
      break;

    default:
      throw createError('Invalid action', 400);
  }

  log.info(`Admin ${req.user!.id} performed batch ${action} on ${userIds.length} users`);

  res.json({
    success: true,
    message: `Batch ${action} completed`,
    data: {
      affected: result.changes
    }
  });
}));

// 系统维护模式
router.post('/maintenance', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { enabled, message = 'System maintenance in progress' } = req.body;

  await dbRun(
    `INSERT OR REPLACE INTO system_config (key, value, type, updated_at)
     VALUES ('maintenance_mode', ?, 'boolean', datetime('now'))`,
    [enabled ? 'true' : 'false']
  );

  if (enabled) {
    await dbRun(
      `INSERT OR REPLACE INTO system_config (key, value, type, updated_at)
       VALUES ('maintenance_message', ?, 'string', datetime('now'))`,
      [message]
    );
  }

  log.info(`Admin ${req.user!.id} ${enabled ? 'enabled' : 'disabled'} maintenance mode`);

  res.json({
    success: true,
    message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`
  });
}));

// 清理系统数据
router.post('/cleanup', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { type } = req.body;

  let result = { cleaned: 0 };

  switch (type) {
    case 'temp_files':
      // 清理临时文件
      const fs = require('fs').promises;
      const path = require('path');
      const tempDir = path.join(process.cwd(), 'temp');

      try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file));
        }
        result.cleaned = files.length;
      } catch (error) {
        // 目录不存在或为空
      }
      break;

    case 'old_logs':
      // 清理30天前的日志
      const oldLogs = await dbRun(
        'DELETE FROM activity_logs WHERE created_at < datetime("now", "-30 days")'
      );
      result.cleaned = oldLogs.changes;
      break;

    case 'expired_shares':
      // 清理过期的分享
      const expiredShares = await dbRun(
        'DELETE FROM public_shares WHERE expires_at IS NOT NULL AND expires_at < datetime("now")'
      );
      result.cleaned = expiredShares.changes;
      break;

    case 'orphaned_files':
      // 清理孤立文件
      const orphanedFiles = await dbRun(
        'DELETE FROM files WHERE user_id NOT IN (SELECT id FROM users)'
      );
      result.cleaned = orphanedFiles.changes;
      break;

    default:
      throw createError('Invalid cleanup type', 400);
  }

  log.info(`Admin ${req.user!.id} performed ${type} cleanup, cleaned ${result.cleaned} items`);

  res.json({
    success: true,
    message: `Cleanup completed: ${result.cleaned} items cleaned`,
    data: result
  });
}));

export default router;
