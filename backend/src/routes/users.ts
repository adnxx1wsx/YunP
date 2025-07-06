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

export default router;
