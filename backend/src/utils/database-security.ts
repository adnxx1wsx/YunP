import { dbRun, dbGet, dbAll } from './database';
import { log } from './logger';

/**
 * 数据库安全增强工具
 */

// 创建必要的索引以提高查询性能和安全性
export const createSecurityIndexes = async (): Promise<void> => {
  const indexes = [
    // 用户相关索引
    {
      name: 'idx_users_email',
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      description: '用户邮箱索引'
    },
    {
      name: 'idx_users_username',
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      description: '用户名索引'
    },
    {
      name: 'idx_users_created_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)',
      description: '用户创建时间索引'
    },
    
    // 文件相关索引
    {
      name: 'idx_files_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)',
      description: '文件用户ID索引'
    },
    {
      name: 'idx_files_folder_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id)',
      description: '文件文件夹ID索引'
    },
    {
      name: 'idx_files_user_folder',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_user_folder ON files(user_id, folder_id)',
      description: '文件用户-文件夹复合索引'
    },
    {
      name: 'idx_files_name',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_name ON files(name)',
      description: '文件名索引'
    },
    {
      name: 'idx_files_mime_type',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type)',
      description: '文件类型索引'
    },
    {
      name: 'idx_files_created_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at)',
      description: '文件创建时间索引'
    },
    {
      name: 'idx_files_search',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_search ON files(user_id, name, mime_type)',
      description: '文件搜索复合索引'
    },
    {
      name: 'idx_files_share_token',
      sql: 'CREATE INDEX IF NOT EXISTS idx_files_share_token ON files(share_token)',
      description: '文件分享令牌索引'
    },
    
    // 文件夹相关索引
    {
      name: 'idx_folders_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)',
      description: '文件夹用户ID索引'
    },
    {
      name: 'idx_folders_parent_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)',
      description: '文件夹父级ID索引'
    },
    {
      name: 'idx_folders_user_parent',
      sql: 'CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id)',
      description: '文件夹用户-父级复合索引'
    },
    
    // 分享相关索引
    {
      name: 'idx_public_shares_token',
      sql: 'CREATE INDEX IF NOT EXISTS idx_public_shares_token ON public_shares(share_token)',
      description: '公开分享令牌索引'
    },
    {
      name: 'idx_public_shares_file_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_public_shares_file_id ON public_shares(file_id)',
      description: '公开分享文件ID索引'
    },
    {
      name: 'idx_public_shares_expires_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_public_shares_expires_at ON public_shares(expires_at)',
      description: '公开分享过期时间索引'
    },
    
    // 活动日志索引
    {
      name: 'idx_activity_logs_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)',
      description: '活动日志用户ID索引'
    },
    {
      name: 'idx_activity_logs_created_at',
      sql: 'CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)',
      description: '活动日志创建时间索引'
    },
    {
      name: 'idx_activity_logs_action',
      sql: 'CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)',
      description: '活动日志操作类型索引'
    },
    
    // 订阅相关索引
    {
      name: 'idx_user_subscriptions_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id)',
      description: '用户订阅用户ID索引'
    },
    {
      name: 'idx_user_subscriptions_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)',
      description: '用户订阅状态索引'
    },
    
    // 存储提供商索引
    {
      name: 'idx_user_storage_providers_user_id',
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_storage_providers_user_id ON user_storage_providers(user_id)',
      description: '用户存储提供商用户ID索引'
    },
    {
      name: 'idx_user_storage_providers_provider',
      sql: 'CREATE INDEX IF NOT EXISTS idx_user_storage_providers_provider ON user_storage_providers(provider)',
      description: '用户存储提供商类型索引'
    }
  ];

  log.info('Creating database security indexes...');
  
  for (const index of indexes) {
    try {
      await dbRun(index.sql);
      log.info(`✓ Created index: ${index.name} - ${index.description}`);
    } catch (error) {
      log.error(`✗ Failed to create index ${index.name}:`, error);
    }
  }
  
  log.info('Database security indexes creation completed');
};

/**
 * 清理过期数据
 */
export const cleanupExpiredData = async (): Promise<void> => {
  log.info('Starting expired data cleanup...');
  
  try {
    // 清理过期的分享链接
    const expiredShares = await dbRun(
      'DELETE FROM public_shares WHERE expires_at IS NOT NULL AND expires_at < datetime("now")'
    );
    log.info(`Cleaned up ${expiredShares.changes} expired share links`);
    
    // 清理过期的会话（如果有会话表）
    // const expiredSessions = await dbRun(
    //   'DELETE FROM sessions WHERE expires_at < datetime("now")'
    // );
    
    // 清理旧的活动日志（保留90天）
    const oldLogs = await dbRun(
      'DELETE FROM activity_logs WHERE created_at < datetime("now", "-90 days")'
    );
    log.info(`Cleaned up ${oldLogs.changes} old activity logs`);
    
    // 清理已取消的订阅记录（保留1年）
    const oldSubscriptions = await dbRun(
      'DELETE FROM user_subscriptions WHERE status = "canceled" AND updated_at < datetime("now", "-1 year")'
    );
    log.info(`Cleaned up ${oldSubscriptions.changes} old canceled subscriptions`);
    
  } catch (error) {
    log.error('Error during expired data cleanup:', error);
  }
  
  log.info('Expired data cleanup completed');
};

/**
 * 数据库完整性检查
 */
export const checkDatabaseIntegrity = async (): Promise<{
  isValid: boolean;
  issues: string[];
}> => {
  const issues: string[] = [];
  
  try {
    log.info('Starting database integrity check...');
    
    // 检查孤立的文件记录
    const orphanedFiles = await dbAll(`
      SELECT f.id, f.name 
      FROM files f 
      LEFT JOIN users u ON f.user_id = u.id 
      WHERE u.id IS NULL
    `);
    
    if (orphanedFiles.length > 0) {
      issues.push(`Found ${orphanedFiles.length} orphaned files without valid users`);
    }
    
    // 检查孤立的文件夹记录
    const orphanedFolders = await dbAll(`
      SELECT f.id, f.name 
      FROM folders f 
      LEFT JOIN users u ON f.user_id = u.id 
      WHERE u.id IS NULL
    `);
    
    if (orphanedFolders.length > 0) {
      issues.push(`Found ${orphanedFolders.length} orphaned folders without valid users`);
    }
    
    // 检查无效的父文件夹引用
    const invalidParentRefs = await dbAll(`
      SELECT f.id, f.name 
      FROM folders f 
      WHERE f.parent_id IS NOT NULL 
      AND f.parent_id NOT IN (SELECT id FROM folders)
    `);
    
    if (invalidParentRefs.length > 0) {
      issues.push(`Found ${invalidParentRefs.length} folders with invalid parent references`);
    }
    
    // 检查无效的文件夹引用
    const invalidFolderRefs = await dbAll(`
      SELECT f.id, f.name 
      FROM files f 
      WHERE f.folder_id IS NOT NULL 
      AND f.folder_id NOT IN (SELECT id FROM folders)
    `);
    
    if (invalidFolderRefs.length > 0) {
      issues.push(`Found ${invalidFolderRefs.length} files with invalid folder references`);
    }
    
    // 检查重复的邮箱
    const duplicateEmails = await dbAll(`
      SELECT email, COUNT(*) as count 
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateEmails.length > 0) {
      issues.push(`Found ${duplicateEmails.length} duplicate email addresses`);
    }
    
    // 检查重复的用户名
    const duplicateUsernames = await dbAll(`
      SELECT username, COUNT(*) as count 
      FROM users 
      GROUP BY username 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateUsernames.length > 0) {
      issues.push(`Found ${duplicateUsernames.length} duplicate usernames`);
    }
    
    log.info('Database integrity check completed');
    
    return {
      isValid: issues.length === 0,
      issues
    };
    
  } catch (error) {
    log.error('Error during database integrity check:', error);
    issues.push(`Database integrity check failed: ${error}`);
    
    return {
      isValid: false,
      issues
    };
  }
};

/**
 * 修复数据库完整性问题
 */
export const repairDatabaseIntegrity = async (): Promise<void> => {
  log.info('Starting database integrity repair...');
  
  try {
    // 删除孤立的文件记录
    const orphanedFilesDeleted = await dbRun(`
      DELETE FROM files 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);
    log.info(`Deleted ${orphanedFilesDeleted.changes} orphaned files`);
    
    // 删除孤立的文件夹记录
    const orphanedFoldersDeleted = await dbRun(`
      DELETE FROM folders 
      WHERE user_id NOT IN (SELECT id FROM users)
    `);
    log.info(`Deleted ${orphanedFoldersDeleted.changes} orphaned folders`);
    
    // 修复无效的父文件夹引用（设为NULL）
    const invalidParentRefsFixed = await dbRun(`
      UPDATE folders 
      SET parent_id = NULL 
      WHERE parent_id IS NOT NULL 
      AND parent_id NOT IN (SELECT id FROM folders)
    `);
    log.info(`Fixed ${invalidParentRefsFixed.changes} invalid parent folder references`);
    
    // 修复无效的文件夹引用（设为NULL）
    const invalidFolderRefsFixed = await dbRun(`
      UPDATE files 
      SET folder_id = NULL 
      WHERE folder_id IS NOT NULL 
      AND folder_id NOT IN (SELECT id FROM folders)
    `);
    log.info(`Fixed ${invalidFolderRefsFixed.changes} invalid folder references`);
    
  } catch (error) {
    log.error('Error during database integrity repair:', error);
  }
  
  log.info('Database integrity repair completed');
};

/**
 * 数据库安全初始化
 */
export const initializeDatabaseSecurity = async (): Promise<void> => {
  log.info('Initializing database security...');
  
  try {
    // 创建安全索引
    await createSecurityIndexes();
    
    // 检查数据库完整性
    const integrityCheck = await checkDatabaseIntegrity();
    
    if (!integrityCheck.isValid) {
      log.warn('Database integrity issues found:', integrityCheck.issues);
      
      // 可选：自动修复问题
      if (process.env.AUTO_REPAIR_DB === 'true') {
        await repairDatabaseIntegrity();
      }
    } else {
      log.info('Database integrity check passed');
    }
    
    log.info('Database security initialization completed');
    
  } catch (error) {
    log.error('Error during database security initialization:', error);
    throw error;
  }
};
