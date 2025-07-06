import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../utils/database';
import { authenticateToken, AuthenticatedRequest, optionalAuth } from '../middleware/auth';
import { uploadSingle, handleUploadError, formatFileSize } from '../middleware/upload';
import { validate, fileShareSchema, validateQuery, paginationSchema } from '../middleware/validation';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = express.Router();

// 获取文件列表
router.get('/', authenticateToken, validateQuery(paginationSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { page, limit, sort, order } = req.query as any;
  const { folderId, search } = req.query;

  const offset = (page - 1) * limit;

  // 构建查询条件
  let whereClause = 'WHERE user_id = ?';
  const queryParams = [userId];

  if (folderId) {
    whereClause += ' AND folder_id = ?';
    queryParams.push(folderId as string);
  } else if (folderId === null) {
    whereClause += ' AND folder_id IS NULL';
  }

  if (search) {
    whereClause += ' AND (name LIKE ? OR original_name LIKE ?)';
    const searchTerm = `%${search}%`;
    queryParams.push(searchTerm, searchTerm);
  }

  // 获取文件列表
  const files = await dbAll(
    `SELECT id, name, original_name, size, mime_type, folder_id, is_public, 
            share_token, download_count, created_at, updated_at 
     FROM files 
     ${whereClause} 
     ORDER BY ${sort} ${order.toUpperCase()} 
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  // 获取总数
  const totalResult = await dbGet(
    `SELECT COUNT(*) as total FROM files ${whereClause}`,
    queryParams
  );

  const total = totalResult?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // 格式化文件大小
  const formattedFiles = files.map(file => ({
    ...file,
    formattedSize: formatFileSize(file.size),
    isImage: file.mime_type.startsWith('image/'),
    isVideo: file.mime_type.startsWith('video/'),
    isAudio: file.mime_type.startsWith('audio/')
  }));

  res.json({
    success: true,
    data: {
      files: formattedFiles,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }
  });
}));

// 上传文件
router.post('/upload', authenticateToken, (req: AuthenticatedRequest, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      return handleUploadError(err, req, res, next);
    }
    next();
  });
}, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { folderId } = req.body;

  if (!req.file) {
    throw createError('No file uploaded', 400);
  }

  // 检查文件夹是否存在且属于当前用户
  if (folderId) {
    const folder = await dbGet(
      'SELECT id FROM folders WHERE id = ? AND user_id = ?',
      [folderId, userId]
    );

    if (!folder) {
      throw createError('Folder not found', 404);
    }
  }

  // 检查用户存储空间
  const user = await dbGet(
    'SELECT storage_used, storage_limit FROM users WHERE id = ?',
    [userId]
  );

  if (user.storage_used + req.file.size > user.storage_limit) {
    // 删除已上传的文件
    await fs.unlink(req.file.path).catch(() => {});
    throw createError('Storage limit exceeded', 413);
  }

  // 检查同名文件
  const existingFile = await dbGet(
    'SELECT id FROM files WHERE original_name = ? AND folder_id = ? AND user_id = ?',
    [req.file.originalname, folderId || null, userId]
  );

  if (existingFile) {
    // 删除已上传的文件
    await fs.unlink(req.file.path).catch(() => {});
    throw createError('A file with this name already exists in the current folder', 409);
  }

  // 保存文件信息到数据库
  const fileId = uuidv4();
  await dbRun(
    `INSERT INTO files (id, name, original_name, size, mime_type, path, folder_id, user_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fileId,
      req.file.filename,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      req.file.path,
      folderId || null,
      userId
    ]
  );

  // 更新用户存储使用量
  await dbRun(
    'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
    [req.file.size, userId]
  );

  // 获取文件信息
  const file = await dbGet(
    'SELECT id, name, original_name, size, mime_type, folder_id, created_at FROM files WHERE id = ?',
    [fileId]
  );

  res.status(201).json({
    success: true,
    data: {
      ...file,
      formattedSize: formatFileSize(file.size),
      isImage: file.mime_type.startsWith('image/'),
      isVideo: file.mime_type.startsWith('video/'),
      isAudio: file.mime_type.startsWith('audio/')
    },
    message: 'File uploaded successfully'
  });
}));

// 获取文件详情
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const file = await dbGet(
    `SELECT id, name, original_name, size, mime_type, folder_id, is_public, 
            share_token, download_count, created_at, updated_at 
     FROM files WHERE id = ? AND user_id = ?`,
    [id, userId]
  );

  if (!file) {
    throw createError('File not found', 404);
  }

  res.json({
    success: true,
    data: {
      ...file,
      formattedSize: formatFileSize(file.size),
      isImage: file.mime_type.startsWith('image/'),
      isVideo: file.mime_type.startsWith('video/'),
      isAudio: file.mime_type.startsWith('audio/')
    }
  });
}));

// 下载文件
router.get('/:id/download', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { token } = req.query;

  let file;

  if (token) {
    // 通过分享链接下载
    file = await dbGet(
      'SELECT id, name, original_name, path, mime_type, size FROM files WHERE id = ? AND share_token = ?',
      [id, token]
    );

    if (!file) {
      throw createError('File not found or invalid share token', 404);
    }

    // 检查分享是否过期
    const share = await dbGet(
      'SELECT expires_at, download_limit, download_count FROM file_shares WHERE file_id = ? AND share_token = ?',
      [id, token]
    );

    if (share) {
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        throw createError('Share link has expired', 410);
      }

      if (share.download_limit && share.download_count >= share.download_limit) {
        throw createError('Download limit reached', 429);
      }

      // 更新下载次数
      await dbRun(
        'UPDATE file_shares SET download_count = download_count + 1 WHERE file_id = ? AND share_token = ?',
        [id, token]
      );
    }
  } else {
    // 用户直接下载
    if (!req.user) {
      throw createError('Authentication required', 401);
    }

    file = await dbGet(
      'SELECT id, name, original_name, path, mime_type, size FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      throw createError('File not found', 404);
    }
  }

  // 检查文件是否存在
  try {
    await fs.access(file.path);
  } catch {
    throw createError('File not found on disk', 404);
  }

  // 更新下载次数
  await dbRun(
    'UPDATE files SET download_count = download_count + 1 WHERE id = ?',
    [id]
  );

  // 设置响应头
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Length', file.size);

  // 发送文件
  res.sendFile(path.resolve(file.path));
}));

// 预览文件
router.get('/:id/preview', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { token } = req.query;

  let file;

  if (token) {
    // 通过分享链接预览
    file = await dbGet(
      'SELECT id, name, original_name, path, mime_type, size FROM files WHERE id = ? AND share_token = ?',
      [id, token]
    );
  } else {
    // 用户直接预览
    if (!req.user) {
      throw createError('Authentication required', 401);
    }

    file = await dbGet(
      'SELECT id, name, original_name, path, mime_type, size FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
  }

  if (!file) {
    throw createError('File not found', 404);
  }

  // 检查文件是否存在
  try {
    await fs.access(file.path);
  } catch {
    throw createError('File not found on disk', 404);
  }

  // 设置响应头
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Length', file.size);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  // 发送文件
  res.sendFile(path.resolve(file.path));
}));

// 分享文件
router.post('/:id/share', authenticateToken, validate(fileShareSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { expiresAt, downloadLimit } = req.body;
  const userId = req.user!.id;

  // 检查文件是否存在且属于当前用户
  const file = await dbGet(
    'SELECT id, name FROM files WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!file) {
    throw createError('File not found', 404);
  }

  // 生成分享令牌
  const shareToken = uuidv4();

  // 更新文件分享信息
  await dbRun(
    'UPDATE files SET is_public = TRUE, share_token = ? WHERE id = ?',
    [shareToken, id]
  );

  // 创建分享记录
  const shareId = uuidv4();
  await dbRun(
    'INSERT INTO file_shares (id, file_id, share_token, expires_at, download_limit) VALUES (?, ?, ?, ?, ?)',
    [shareId, id, shareToken, expiresAt || null, downloadLimit || null]
  );

  res.json({
    success: true,
    data: {
      shareToken,
      shareUrl: `${req.protocol}://${req.get('host')}/api/files/${id}/download?token=${shareToken}`,
      expiresAt,
      downloadLimit
    },
    message: 'File shared successfully'
  });
}));

// 取消分享
router.delete('/:id/share', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // 检查文件是否存在且属于当前用户
  const file = await dbGet(
    'SELECT id FROM files WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!file) {
    throw createError('File not found', 404);
  }

  // 取消分享
  await dbRun(
    'UPDATE files SET is_public = FALSE, share_token = NULL WHERE id = ?',
    [id]
  );

  // 删除分享记录
  await dbRun(
    'DELETE FROM file_shares WHERE file_id = ?',
    [id]
  );

  res.json({
    success: true,
    message: 'File sharing cancelled successfully'
  });
}));

// 删除文件
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // 检查文件是否存在且属于当前用户
  const file = await dbGet(
    'SELECT id, name, original_name, path, size FROM files WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!file) {
    throw createError('File not found', 404);
  }

  // 移动到回收站
  const trashId = uuidv4();
  await dbRun(
    'INSERT INTO trash (id, original_id, original_type, original_name, original_path, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [trashId, id, 'file', file.original_name, file.path, userId]
  );

  // 删除文件记录
  await dbRun('DELETE FROM files WHERE id = ?', [id]);

  // 更新用户存储使用量
  await dbRun(
    'UPDATE users SET storage_used = storage_used - ? WHERE id = ?',
    [file.size, userId]
  );

  // 删除物理文件
  try {
    await fs.unlink(file.path);
  } catch (error) {
    console.warn('Failed to delete physical file:', error);
  }

  res.json({
    success: true,
    message: 'File moved to trash successfully'
  });
}));

export default router;
