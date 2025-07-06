import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { storageManager } from '../services/storage/StorageManager';
import { StorageProvider as StorageProviderType } from '@shared/types';

const router = express.Router();

// 获取可用的存储提供商
router.get('/providers', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const providers = await storageManager.getAvailableProviders();
  
  res.json({
    success: true,
    data: providers
  });
}));

// 获取用户的存储提供商
router.get('/user-providers', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const providers = await storageManager.getUserProviders(userId);
  
  res.json({
    success: true,
    data: providers
  });
}));

// 设置默认存储提供商
router.put('/user-providers/:id/default', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  
  await storageManager.setDefaultProvider(userId, id);
  
  res.json({
    success: true,
    message: 'Default provider updated successfully'
  });
}));

// 删除用户存储提供商
router.delete('/user-providers/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  
  await storageManager.removeUserProvider(userId, id);
  
  res.json({
    success: true,
    message: 'Provider removed successfully'
  });
}));

// 同步存储提供商配额
router.post('/user-providers/:id/sync', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user!.id;
  
  await storageManager.syncProviderQuota(userId, id);
  
  res.json({
    success: true,
    message: 'Quota synced successfully'
  });
}));

// OneDrive 认证
router.get('/onedrive/auth', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const provider = await storageManager.getProvider('onedrive');
  const authUrl = provider.getAuthUrl(userId);
  
  res.json({
    success: true,
    data: { authUrl }
  });
}));

// OneDrive 回调
router.get('/onedrive/callback', asyncHandler(async (req, res) => {
  const { code, state: userId } = req.query;
  
  if (!code || !userId) {
    throw createError('Missing code or state parameter', 400);
  }
  
  try {
    const tokens = await storageManager.handleProviderCallback('onedrive', code as string, userId as string);
    
    await storageManager.addUserProvider(
      userId as string,
      'onedrive',
      tokens.accessToken,
      tokens.refreshToken,
      'OneDrive'
    );
    
    // 重定向到前端成功页面
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?provider=onedrive&status=success`);
  } catch (error: any) {
    console.error('OneDrive callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?provider=onedrive&status=error&message=${encodeURIComponent(error.message)}`);
  }
}));

// Google Drive 认证
router.get('/googledrive/auth', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const provider = await storageManager.getProvider('googledrive');
  const authUrl = provider.getAuthUrl(userId);
  
  res.json({
    success: true,
    data: { authUrl }
  });
}));

// Google Drive 回调
router.get('/googledrive/callback', asyncHandler(async (req, res) => {
  const { code, state: userId } = req.query;
  
  if (!code || !userId) {
    throw createError('Missing code or state parameter', 400);
  }
  
  try {
    const tokens = await storageManager.handleProviderCallback('googledrive', code as string, userId as string);
    
    await storageManager.addUserProvider(
      userId as string,
      'googledrive',
      tokens.accessToken,
      tokens.refreshToken,
      'Google Drive'
    );
    
    // 重定向到前端成功页面
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?provider=googledrive&status=success`);
  } catch (error: any) {
    console.error('Google Drive callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?provider=googledrive&status=error&message=${encodeURIComponent(error.message)}`);
  }
}));

// 测试存储提供商连接
router.post('/test-connection/:provider', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { provider } = req.params;
  const userId = req.user!.id;
  
  try {
    const storageProvider = await storageManager.getUserProvider(userId, provider as StorageProviderType);
    const quota = await storageProvider.getQuota();
    
    res.json({
      success: true,
      data: {
        connected: true,
        quota
      }
    });
  } catch (error: any) {
    res.json({
      success: false,
      data: {
        connected: false,
        error: error.message
      }
    });
  }
}));

// 获取存储提供商文件列表
router.get('/providers/:provider/files', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { provider } = req.params;
  const { folderId, limit = 50, offset = 0 } = req.query;
  const userId = req.user!.id;
  
  const storageProvider = await storageManager.getUserProvider(userId, provider as StorageProviderType);
  const result = await storageProvider.listFiles(
    folderId as string,
    parseInt(limit as string),
    parseInt(offset as string)
  );
  
  res.json({
    success: true,
    data: result
  });
}));

// 从存储提供商搜索文件
router.get('/providers/:provider/search', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { provider } = req.params;
  const { q: query, limit = 50 } = req.query;
  const userId = req.user!.id;
  
  if (!query) {
    throw createError('Search query is required', 400);
  }
  
  const storageProvider = await storageManager.getUserProvider(userId, provider as StorageProviderType);
  const files = await storageProvider.searchFiles(query as string, {
    limit: parseInt(limit as string)
  });
  
  res.json({
    success: true,
    data: files
  });
}));

// 获取存储提供商配额信息
router.get('/providers/:provider/quota', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { provider } = req.params;
  const userId = req.user!.id;
  
  const storageProvider = await storageManager.getUserProvider(userId, provider as StorageProviderType);
  const quota = await storageProvider.getQuota();
  
  res.json({
    success: true,
    data: quota
  });
}));

// 创建文件夹
router.post('/providers/:provider/folders', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { provider } = req.params;
  const { name, parentId } = req.body;
  const userId = req.user!.id;
  
  if (!name) {
    throw createError('Folder name is required', 400);
  }
  
  const storageProvider = await storageManager.getUserProvider(userId, provider as StorageProviderType);
  const folder = await storageProvider.createFolder(name, parentId);
  
  res.json({
    success: true,
    data: folder,
    message: 'Folder created successfully'
  });
}));

// 删除文件或文件夹
router.delete('/providers/:provider/items/:itemId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { provider, itemId } = req.params;
  const { type = 'file' } = req.query;
  const userId = req.user!.id;
  
  const storageProvider = await storageManager.getUserProvider(userId, provider as StorageProviderType);
  
  if (type === 'folder') {
    await storageProvider.deleteFolder(itemId);
  } else {
    await storageProvider.deleteFile(itemId);
  }
  
  res.json({
    success: true,
    message: `${type === 'folder' ? 'Folder' : 'File'} deleted successfully`
  });
}));

// 批量操作
router.post('/providers/:provider/batch/:operation', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { provider, operation } = req.params;
  const { itemIds, targetFolderId } = req.body;
  const userId = req.user!.id;
  
  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    throw createError('Item IDs are required', 400);
  }
  
  const storageProvider = await storageManager.getUserProvider(userId, provider as StorageProviderType);
  
  let result;
  switch (operation) {
    case 'delete':
      await storageProvider.batchDelete(itemIds);
      result = { deleted: itemIds.length };
      break;
    case 'move':
      if (!targetFolderId) {
        throw createError('Target folder ID is required for move operation', 400);
      }
      await storageProvider.batchMove(itemIds, targetFolderId);
      result = { moved: itemIds.length };
      break;
    case 'copy':
      if (!targetFolderId) {
        throw createError('Target folder ID is required for copy operation', 400);
      }
      const copiedFiles = await storageProvider.batchCopy(itemIds, targetFolderId);
      result = { copied: copiedFiles.length, files: copiedFiles };
      break;
    default:
      throw createError('Invalid operation', 400);
  }
  
  res.json({
    success: true,
    data: result,
    message: `Batch ${operation} completed successfully`
  });
}));

export default router;
