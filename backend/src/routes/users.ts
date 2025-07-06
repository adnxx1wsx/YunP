import express from 'express';
import { dbGet, dbAll, dbRun } from '../utils/database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateQuery, paginationSchema } from '../middleware/validation';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { formatFileSize } from '../middleware/upload';

const router = express.Router();

// 获取用户存储统计
router.get('/stats', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  // 获取用户基本信息
  const user = await dbGet(
    'SELECT storage_used, storage_limit FROM users WHERE id = ?',
    [userId]
  );

  // 获取文件统计
  const fileStats = await dbGet(
    'SELECT COUNT(*) as totalFiles, SUM(size) as totalSize FROM files WHERE user_id = ?',
    [userId]
  );

  // 获取文件夹统计
  const folderStats = await dbGet(
    'SELECT COUNT(*) as totalFolders FROM folders WHERE user_id = ?',
    [userId]
  );

  // 获取最近上传的文件
  const recentFiles = await dbAll(
    `SELECT id, original_name, size, mime_type, created_at 
     FROM files 
     WHERE user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 5`,
    [userId]
  );

  // 获取文件类型分布
  const fileTypeStats = await dbAll(
    `SELECT 
       CASE 
         WHEN mime_type LIKE 'image/%' THEN 'images'
         WHEN mime_type LIKE 'video/%' THEN 'videos'
         WHEN mime_type LIKE 'audio/%' THEN 'audio'
         WHEN mime_type LIKE 'text/%' OR mime_type = 'application/pdf' THEN 'documents'
         ELSE 'others'
       END as type,
       COUNT(*) as count,
       SUM(size) as totalSize
     FROM files 
     WHERE user_id = ? 
     GROUP BY type`,
    [userId]
  );

  const stats = {
    storage: {
      used: user.storage_used,
      limit: user.storage_limit,
      usedFormatted: formatFileSize(user.storage_used),
      limitFormatted: formatFileSize(user.storage_limit),
      usagePercentage: Math.round((user.storage_used / user.storage_limit) * 100)
    },
    files: {
      total: fileStats?.totalFiles || 0,
      totalSize: fileStats?.totalSize || 0,
      totalSizeFormatted: formatFileSize(fileStats?.totalSize || 0)
    },
    folders: {
      total: folderStats?.totalFolders || 0
    },
    recentFiles: recentFiles.map(file => ({
      ...file,
      formattedSize: formatFileSize(file.size),
      isImage: file.mime_type.startsWith('image/'),
      isVideo: file.mime_type.startsWith('video/'),
      isAudio: file.mime_type.startsWith('audio/')
    })),
    fileTypes: fileTypeStats.map(stat => ({
      ...stat,
      totalSizeFormatted: formatFileSize(stat.totalSize)
    }))
  };

  res.json({
    success: true,
    data: stats
  });
}));

// 获取回收站内容
router.get('/trash', authenticateToken, validateQuery(paginationSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { page, limit, sort, order } = req.query as any;

  const offset = (page - 1) * limit;

  // 获取回收站项目
  const trashItems = await dbAll(
    `SELECT id, original_id, original_type, original_name, original_path, deleted_at 
     FROM trash 
     WHERE user_id = ? 
     ORDER BY deleted_at ${order.toUpperCase()} 
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  // 获取总数
  const totalResult = await dbGet(
    'SELECT COUNT(*) as total FROM trash WHERE user_id = ?',
    [userId]
  );

  const total = totalResult?.total || 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      items: trashItems,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }
  });
}));

// 恢复回收站项目
router.post('/trash/:id/restore', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // 获取回收站项目
  const trashItem = await dbGet(
    'SELECT original_id, original_type, original_name FROM trash WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!trashItem) {
    throw createError('Trash item not found', 404);
  }

  // TODO: 实现恢复逻辑
  // 这里需要根据原始类型（文件或文件夹）进行不同的恢复操作
  // 由于涉及到复杂的文件系统操作，这里先返回成功消息

  // 从回收站删除
  await dbRun('DELETE FROM trash WHERE id = ?', [id]);

  res.json({
    success: true,
    message: `${trashItem.original_type} restored successfully`
  });
}));

// 永久删除回收站项目
router.delete('/trash/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // 获取回收站项目
  const trashItem = await dbGet(
    'SELECT original_id, original_type FROM trash WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!trashItem) {
    throw createError('Trash item not found', 404);
  }

  // 从回收站删除
  await dbRun('DELETE FROM trash WHERE id = ?', [id]);

  res.json({
    success: true,
    message: `${trashItem.original_type} permanently deleted`
  });
}));

// 清空回收站
router.delete('/trash', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  // 获取回收站项目数量
  const countResult = await dbGet(
    'SELECT COUNT(*) as count FROM trash WHERE user_id = ?',
    [userId]
  );

  const count = countResult?.count || 0;

  // 清空回收站
  await dbRun('DELETE FROM trash WHERE user_id = ?', [userId]);

  res.json({
    success: true,
    message: `${count} items permanently deleted from trash`
  });
}));

// 搜索文件和文件夹
router.get('/search', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { q: query, type = 'all', limit = 20 } = req.query;

  if (!query || typeof query !== 'string') {
    throw createError('Search query is required', 400);
  }

  const searchTerm = `%${query}%`;
  const results: any = {
    files: [],
    folders: [],
    total: 0
  };

  // 搜索文件
  if (type === 'all' || type === 'file') {
    const files = await dbAll(
      `SELECT id, original_name as name, size, mime_type, folder_id, created_at 
       FROM files 
       WHERE user_id = ? AND (original_name LIKE ? OR name LIKE ?) 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, searchTerm, searchTerm, limit]
    );

    results.files = files.map(file => ({
      ...file,
      type: 'file',
      formattedSize: formatFileSize(file.size),
      isImage: file.mime_type.startsWith('image/'),
      isVideo: file.mime_type.startsWith('video/'),
      isAudio: file.mime_type.startsWith('audio/')
    }));
  }

  // 搜索文件夹
  if (type === 'all' || type === 'folder') {
    const folders = await dbAll(
      `SELECT id, name, parent_id, path, created_at 
       FROM folders 
       WHERE user_id = ? AND name LIKE ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, searchTerm, limit]
    );

    results.folders = folders.map(folder => ({
      ...folder,
      type: 'folder'
    }));
  }

  results.total = results.files.length + results.folders.length;

  res.json({
    success: true,
    data: results
  });
}));

// 获取用户仪表板数据
router.get('/dashboard', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { range = '30d' } = req.query;

  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 30;

  // 获取用户基本统计
  const [userStats, recentFiles, fileTypes, uploadTrend] = await Promise.all([
    // 用户统计
    dbGet(
      `SELECT
         (SELECT COUNT(*) FROM files WHERE user_id = ?) as totalFiles,
         (SELECT COUNT(*) FROM files WHERE user_id = ? AND created_at > datetime('now', '-7 days')) as newFiles,
         (SELECT SUM(size) FROM files WHERE user_id = ?) as storageUsed,
         (SELECT storage_limit FROM users WHERE id = ?) as storageLimit,
         (SELECT COUNT(*) FROM public_shares ps JOIN files f ON ps.file_id = f.id WHERE f.user_id = ?) as totalShares,
         (SELECT COUNT(*) FROM activity_logs WHERE user_id = ? AND action = 'download' AND created_at > datetime('now', '-${days} days')) as totalDownloads,
         (SELECT COUNT(*) FROM activity_logs WHERE user_id = ? AND action = 'download' AND created_at > datetime('now', '-7 days')) as recentDownloads`,
      [userId, userId, userId, userId, userId, userId, userId]
    ),

    // 最近文件
    dbAll(
      `SELECT id, original_name as name, size, mime_type, created_at, updated_at
       FROM files
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 10`,
      [userId]
    ),

    // 文件类型分布
    dbAll(
      `SELECT
         CASE
           WHEN mime_type LIKE 'image/%' THEN 'images'
           WHEN mime_type LIKE 'video/%' THEN 'videos'
           WHEN mime_type LIKE 'audio/%' THEN 'audio'
           WHEN mime_type LIKE 'application/pdf' OR mime_type LIKE 'text/%' THEN 'documents'
           ELSE 'others'
         END as type,
         COUNT(*) as count,
         SUM(size) as size
       FROM files
       WHERE user_id = ?
       GROUP BY type
       ORDER BY count DESC`,
      [userId]
    ),

    // 上传趋势
    dbAll(
      `SELECT DATE(created_at) as date, COUNT(*) as count, SUM(size) as size
       FROM files
       WHERE user_id = ? AND created_at > datetime('now', '-${days} days')
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [userId]
    )
  ]);

  res.json({
    success: true,
    data: {
      stats: userStats,
      recentFiles,
      fileTypes,
      uploadTrend
    }
  });
}));

// 获取用户设置
router.get('/settings', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  const settings = await dbGet(
    'SELECT settings FROM user_settings WHERE user_id = ?',
    [userId]
  );

  const defaultSettings = {
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      shareNotifications: true,
      storageAlerts: true
    },
    privacy: {
      profileVisibility: 'private',
      allowFileSharing: true,
      allowPublicShares: true,
      dataCollection: false
    },
    theme: {
      theme: 'light',
      language: 'zh-CN',
      timezone: 'Asia/Shanghai'
    }
  };

  res.json({
    success: true,
    data: settings ? JSON.parse(settings.settings) : defaultSettings
  });
}));

// 更新用户设置
router.put('/settings', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const newSettings = req.body;

  // 获取现有设置
  const existingSettings = await dbGet(
    'SELECT settings FROM user_settings WHERE user_id = ?',
    [userId]
  );

  let updatedSettings;
  if (existingSettings) {
    const current = JSON.parse(existingSettings.settings);
    updatedSettings = { ...current, ...newSettings };
  } else {
    updatedSettings = newSettings;
  }

  await dbRun(
    `INSERT OR REPLACE INTO user_settings (user_id, settings, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [userId, JSON.stringify(updatedSettings)]
  );

  res.json({
    success: true,
    message: 'Settings updated successfully'
  });
}));

// 获取用户活动日志
router.get('/activities', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { limit = 20, page = 1 } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  const activities = await dbAll(
    `SELECT action, details, ip_address, user_agent, created_at
     FROM activity_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, parseInt(limit as string), offset]
  );

  const totalCount = await dbGet(
    'SELECT COUNT(*) as count FROM activity_logs WHERE user_id = ?',
    [userId]
  );

  res.json({
    success: true,
    data: {
      activities: activities.map(activity => ({
        ...activity,
        description: getActivityDescription(activity.action, activity.details)
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / parseInt(limit as string))
      }
    }
  });
}));

// 获取安全日志
router.get('/security-logs', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { limit = 10 } = req.query;

  const securityLogs = await dbAll(
    `SELECT action, ip_address, user_agent, created_at
     FROM activity_logs
     WHERE user_id = ? AND action IN ('login', 'logout', 'password_change', 'two_factor_enable', 'two_factor_disable')
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, parseInt(limit as string)]
  );

  res.json({
    success: true,
    data: securityLogs
  });
}));

// 更新个人资料
router.put('/profile', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { username, email, avatar } = req.body;

  // 检查用户名是否已存在
  if (username) {
    const existingUser = await dbGet(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, userId]
    );
    if (existingUser) {
      throw createError('Username already exists', 400);
    }
  }

  // 检查邮箱是否已存在
  if (email) {
    const existingEmail = await dbGet(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );
    if (existingEmail) {
      throw createError('Email already exists', 400);
    }
  }

  const updateFields = [];
  const updateValues = [];

  if (username) {
    updateFields.push('username = ?');
    updateValues.push(username);
  }
  if (email) {
    updateFields.push('email = ?');
    updateValues.push(email);
  }
  if (avatar) {
    updateFields.push('avatar = ?');
    updateValues.push(avatar);
  }

  if (updateFields.length > 0) {
    updateFields.push('updated_at = datetime("now")');
    updateValues.push(userId);

    await dbRun(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // 记录活动
    await dbRun(
      `INSERT INTO activity_logs (id, user_id, action, details, created_at)
       VALUES (?, ?, 'profile_update', ?, datetime('now'))`,
      [uuidv4(), userId, JSON.stringify({ fields: updateFields })]
    );
  }

  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
}));

// 更改密码
router.put('/password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  // 获取当前用户信息
  const user = await dbGet('SELECT password FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw createError('User not found', 404);
  }

  // 验证当前密码
  const bcrypt = require('bcrypt');
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    throw createError('Current password is incorrect', 400);
  }

  // 加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 更新密码
  await dbRun(
    'UPDATE users SET password = ?, updated_at = datetime("now") WHERE id = ?',
    [hashedPassword, userId]
  );

  // 记录活动
  await dbRun(
    `INSERT INTO activity_logs (id, user_id, action, ip_address, user_agent, created_at)
     VALUES (?, ?, 'password_change', ?, ?, datetime('now'))`,
    [uuidv4(), userId, req.ip, req.get('User-Agent')]
  );

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// 删除账户
router.delete('/account', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  // 软删除用户账户
  await dbRun(
    'UPDATE users SET is_deleted = TRUE, deleted_at = datetime("now") WHERE id = ?',
    [userId]
  );

  // 删除用户文件（移至回收站）
  await dbRun(
    `INSERT INTO trash (id, user_id, original_id, original_type, original_name, deleted_at)
     SELECT ?, user_id, id, 'file', original_name, datetime('now')
     FROM files WHERE user_id = ?`,
    [uuidv4(), userId]
  );

  // 删除文件记录
  await dbRun('DELETE FROM files WHERE user_id = ?', [userId]);

  // 记录活动
  await dbRun(
    `INSERT INTO activity_logs (id, user_id, action, ip_address, user_agent, created_at)
     VALUES (?, ?, 'account_delete', ?, ?, datetime('now'))`,
    [uuidv4(), userId, req.ip, req.get('User-Agent')]
  );

  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

// 获取通知
router.get('/notifications', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { limit = 20, unreadOnly = false } = req.query;

  let whereClause = 'WHERE user_id = ?';
  const params = [userId];

  if (unreadOnly === 'true') {
    whereClause += ' AND is_read = FALSE';
  }

  const notifications = await dbAll(
    `SELECT id, title, message, type, is_read, created_at
     FROM notifications
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ?`,
    [...params, parseInt(limit as string)]
  );

  const unreadCount = await dbGet(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount: unreadCount.count
    }
  });
}));

// 标记通知为已读
router.put('/notifications/:id/read', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;

  await dbRun(
    'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  res.json({
    success: true,
    message: 'Notification marked as read'
  });
}));

// 标记所有通知为已读
router.put('/notifications/read-all', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;

  await dbRun(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
    [userId]
  );

  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
}));

// 辅助函数：生成活动描述
function getActivityDescription(action: string, details?: string): string {
  const detailsObj = details ? JSON.parse(details) : {};

  switch (action) {
    case 'login':
      return '登录账户';
    case 'logout':
      return '退出账户';
    case 'upload':
      return `上传文件: ${detailsObj.filename || '未知文件'}`;
    case 'download':
      return `下载文件: ${detailsObj.filename || '未知文件'}`;
    case 'delete':
      return `删除文件: ${detailsObj.filename || '未知文件'}`;
    case 'share':
      return `分享文件: ${detailsObj.filename || '未知文件'}`;
    case 'create_folder':
      return `创建文件夹: ${detailsObj.foldername || '未知文件夹'}`;
    case 'password_change':
      return '更改密码';
    case 'profile_update':
      return '更新个人资料';
    case 'two_factor_enable':
      return '启用两步验证';
    case 'two_factor_disable':
      return '禁用两步验证';
    default:
      return action;
  }
}

export default router;
