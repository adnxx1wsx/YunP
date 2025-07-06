import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../utils/database';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validate, folderCreateSchema, folderRenameSchema, validateQuery, paginationSchema } from '../middleware/validation';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = express.Router();

// 获取文件夹列表
router.get('/', authenticateToken, validateQuery(paginationSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { page, limit, sort, order } = req.query as any;
  const { parentId } = req.query;

  const offset = (page - 1) * limit;

  // 构建查询条件
  let whereClause = 'WHERE user_id = ?';
  const queryParams = [userId];

  if (parentId) {
    whereClause += ' AND parent_id = ?';
    queryParams.push(parentId as string);
  } else {
    whereClause += ' AND parent_id IS NULL';
  }

  // 获取文件夹列表
  const folders = await dbAll(
    `SELECT id, name, parent_id, path, created_at, updated_at 
     FROM folders 
     ${whereClause} 
     ORDER BY ${sort} ${order.toUpperCase()} 
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  // 获取总数
  const totalResult = await dbGet(
    `SELECT COUNT(*) as total FROM folders ${whereClause}`,
    queryParams
  );

  const total = totalResult?.total || 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      folders,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    }
  });
}));

// 创建文件夹
router.post('/', authenticateToken, validate(folderCreateSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, parentId } = req.body;
  const userId = req.user!.id;

  // 检查父文件夹是否存在且属于当前用户
  if (parentId) {
    const parentFolder = await dbGet(
      'SELECT id, path FROM folders WHERE id = ? AND user_id = ?',
      [parentId, userId]
    );

    if (!parentFolder) {
      throw createError('Parent folder not found', 404);
    }
  }

  // 检查同级目录下是否已存在同名文件夹
  let existingFolder;
  if (parentId) {
    existingFolder = await dbGet(
      'SELECT id FROM folders WHERE name = ? AND parent_id = ? AND user_id = ?',
      [name, parentId, userId]
    );
  } else {
    existingFolder = await dbGet(
      'SELECT id FROM folders WHERE name = ? AND parent_id IS NULL AND user_id = ?',
      [name, userId]
    );
  }

  if (existingFolder) {
    throw createError('A folder with this name already exists in the current directory', 409);
  }

  // 构建文件夹路径
  let folderPath = name;
  if (parentId) {
    const parentFolder = await dbGet(
      'SELECT path FROM folders WHERE id = ?',
      [parentId]
    );
    folderPath = `${parentFolder.path}/${name}`;
  }

  // 创建文件夹
  const folderId = uuidv4();
  await dbRun(
    'INSERT INTO folders (id, name, parent_id, user_id, path) VALUES (?, ?, ?, ?, ?)',
    [folderId, name, parentId || null, userId, folderPath]
  );

  // 获取创建的文件夹信息
  const folder = await dbGet(
    'SELECT id, name, parent_id, path, created_at, updated_at FROM folders WHERE id = ?',
    [folderId]
  );

  res.status(201).json({
    success: true,
    data: folder,
    message: 'Folder created successfully'
  });
}));

// 获取文件夹详情
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const folder = await dbGet(
    'SELECT id, name, parent_id, path, created_at, updated_at FROM folders WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!folder) {
    throw createError('Folder not found', 404);
  }

  // 获取子文件夹数量
  const subfolderCount = await dbGet(
    'SELECT COUNT(*) as count FROM folders WHERE parent_id = ?',
    [id]
  );

  // 获取文件数量
  const fileCount = await dbGet(
    'SELECT COUNT(*) as count FROM files WHERE folder_id = ?',
    [id]
  );

  res.json({
    success: true,
    data: {
      ...folder,
      subfolderCount: subfolderCount?.count || 0,
      fileCount: fileCount?.count || 0
    }
  });
}));

// 重命名文件夹
router.put('/:id', authenticateToken, validate(folderRenameSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user!.id;

  // 检查文件夹是否存在且属于当前用户
  const folder = await dbGet(
    'SELECT id, name, parent_id, path FROM folders WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!folder) {
    throw createError('Folder not found', 404);
  }

  // 检查同级目录下是否已存在同名文件夹
  let existingFolder;
  if (folder.parent_id) {
    existingFolder = await dbGet(
      'SELECT id FROM folders WHERE name = ? AND parent_id = ? AND user_id = ? AND id != ?',
      [name, folder.parent_id, userId, id]
    );
  } else {
    existingFolder = await dbGet(
      'SELECT id FROM folders WHERE name = ? AND parent_id IS NULL AND user_id = ? AND id != ?',
      [name, userId, id]
    );
  }

  if (existingFolder) {
    throw createError('A folder with this name already exists in the current directory', 409);
  }

  // 构建新路径
  const oldPath = folder.path;
  const pathParts = oldPath.split('/');
  pathParts[pathParts.length - 1] = name;
  const newPath = pathParts.join('/');

  // 更新文件夹名称和路径
  await dbRun(
    'UPDATE folders SET name = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, newPath, id]
  );

  // 更新所有子文件夹的路径
  await dbRun(
    `UPDATE folders 
     SET path = REPLACE(path, ?, ?), updated_at = CURRENT_TIMESTAMP 
     WHERE path LIKE ? AND user_id = ?`,
    [oldPath, newPath, `${oldPath}/%`, userId]
  );

  // 获取更新后的文件夹信息
  const updatedFolder = await dbGet(
    'SELECT id, name, parent_id, path, created_at, updated_at FROM folders WHERE id = ?',
    [id]
  );

  res.json({
    success: true,
    data: updatedFolder,
    message: 'Folder renamed successfully'
  });
}));

// 删除文件夹
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // 检查文件夹是否存在且属于当前用户
  const folder = await dbGet(
    'SELECT id, name, path FROM folders WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!folder) {
    throw createError('Folder not found', 404);
  }

  // 检查文件夹是否为空
  const hasSubfolders = await dbGet(
    'SELECT COUNT(*) as count FROM folders WHERE parent_id = ?',
    [id]
  );

  const hasFiles = await dbGet(
    'SELECT COUNT(*) as count FROM files WHERE folder_id = ?',
    [id]
  );

  if (hasSubfolders?.count > 0 || hasFiles?.count > 0) {
    throw createError('Cannot delete non-empty folder', 400);
  }

  // 移动到回收站
  const trashId = uuidv4();
  await dbRun(
    'INSERT INTO trash (id, original_id, original_type, original_name, original_path, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [trashId, id, 'folder', folder.name, folder.path, userId]
  );

  // 删除文件夹
  await dbRun('DELETE FROM folders WHERE id = ?', [id]);

  res.json({
    success: true,
    message: 'Folder moved to trash successfully'
  });
}));

// 获取文件夹路径（面包屑导航）
router.get('/:id/breadcrumb', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  // 检查文件夹是否存在且属于当前用户
  const folder = await dbGet(
    'SELECT id, name, parent_id FROM folders WHERE id = ? AND user_id = ?',
    [id, userId]
  );

  if (!folder) {
    throw createError('Folder not found', 404);
  }

  const breadcrumb = [];
  let currentFolder = folder;

  // 构建面包屑路径
  while (currentFolder) {
    breadcrumb.unshift({
      id: currentFolder.id,
      name: currentFolder.name
    });

    if (currentFolder.parent_id) {
      currentFolder = await dbGet(
        'SELECT id, name, parent_id FROM folders WHERE id = ?',
        [currentFolder.parent_id]
      );
    } else {
      break;
    }
  }

  res.json({
    success: true,
    data: breadcrumb
  });
}));

export default router;
