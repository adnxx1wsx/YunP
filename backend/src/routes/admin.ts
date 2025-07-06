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

export default router;
