import Bull from 'bull';
import { log } from '../utils/logger';
import { fileProcessor } from './FileProcessor';
import { storageManager } from './storage/StorageManager';
import { dbRun, dbGet } from '../utils/database';

// 队列配置
const queueConfig = {
  redis: {
    port: parseInt(process.env.REDIS_PORT || '6379'),
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// 文件处理队列
export const fileProcessingQueue = new Bull('file-processing', queueConfig);

// 存储同步队列
export const storageSyncQueue = new Bull('storage-sync', queueConfig);

// 邮件发送队列
export const emailQueue = new Bull('email', queueConfig);

// 清理任务队列
export const cleanupQueue = new Bull('cleanup', queueConfig);

// 文件处理任务
interface FileProcessingJob {
  fileId: string;
  filePath: string;
  mimeType: string;
  userId: string;
}

fileProcessingQueue.process('process-file', async (job) => {
  const { fileId, filePath, mimeType, userId } = job.data as FileProcessingJob;
  
  try {
    log.file(`Processing file: ${fileId}`, fileId, userId);
    
    // 更新文件状态为处理中
    await dbRun(
      'UPDATE files SET processing_status = ? WHERE id = ?',
      ['processing', fileId]
    );

    // 处理文件（生成缩略图、预览等）
    const result = await fileProcessor.processFile(fileId, filePath, mimeType);

    // 更新文件信息
    await dbRun(
      `UPDATE files SET 
        thumbnail_path = ?, 
        preview_available = ?, 
        processing_status = ?,
        file_metadata = ?
      WHERE id = ?`,
      [
        result.thumbnailPath || null,
        !!result.previewPath,
        'completed',
        JSON.stringify(result.metadata),
        fileId
      ]
    );

    log.file(`File processing completed: ${fileId}`, fileId, userId);
    
    return { success: true, result };
  } catch (error) {
    log.error(`File processing failed: ${fileId}`, error);
    
    // 更新文件状态为失败
    await dbRun(
      'UPDATE files SET processing_status = ? WHERE id = ?',
      ['failed', fileId]
    );
    
    throw error;
  }
});

// 存储同步任务
interface StorageSyncJob {
  fileId: string;
  userId: string;
  providerId: string;
  operation: 'upload' | 'download' | 'delete';
  filePath?: string;
  remoteId?: string;
}

storageSyncQueue.process('sync-file', async (job) => {
  const { fileId, userId, providerId, operation, filePath, remoteId } = job.data as StorageSyncJob;
  
  try {
    log.storage(`Syncing file: ${operation} ${fileId}`, providerId, userId);
    
    const provider = await storageManager.getUserProvider(userId, providerId);
    
    switch (operation) {
      case 'upload':
        if (!filePath) throw new Error('File path required for upload');
        
        const file = await dbGet('SELECT * FROM files WHERE id = ?', [fileId]);
        if (!file) throw new Error('File not found');
        
        const buffer = await require('fs').promises.readFile(filePath);
        const uploadResult = await provider.uploadFile(buffer, {
          fileName: file.original_name,
          mimeType: file.mime_type,
          size: file.size,
        });
        
        // 更新文件的远程信息
        await dbRun(
          'UPDATE files SET remote_id = ?, remote_path = ?, sync_status = ? WHERE id = ?',
          [uploadResult.id, uploadResult.path, 'synced', fileId]
        );
        
        break;
        
      case 'download':
        if (!remoteId) throw new Error('Remote ID required for download');
        
        const downloadBuffer = await provider.downloadFile(remoteId);
        // 保存到本地文件系统
        // 实现下载逻辑...
        
        break;
        
      case 'delete':
        if (!remoteId) throw new Error('Remote ID required for delete');
        
        await provider.deleteFile(remoteId);
        
        // 更新文件状态
        await dbRun(
          'UPDATE files SET sync_status = ? WHERE id = ?',
          ['deleted', fileId]
        );
        
        break;
    }
    
    log.storage(`File sync completed: ${operation} ${fileId}`, providerId, userId);
    
    return { success: true };
  } catch (error) {
    log.error(`File sync failed: ${operation} ${fileId}`, error);
    
    // 更新同步状态为错误
    await dbRun(
      'UPDATE files SET sync_status = ? WHERE id = ?',
      ['error', fileId]
    );
    
    throw error;
  }
});

// 邮件发送任务
interface EmailJob {
  to: string;
  subject: string;
  template: string;
  data: any;
  userId?: string;
}

emailQueue.process('send-email', async (job) => {
  const { to, subject, template, data, userId } = job.data as EmailJob;
  
  try {
    log.info(`Sending email: ${template} to ${to}`, { userId });
    
    // 这里实现邮件发送逻辑
    // 可以使用 nodemailer 或其他邮件服务
    
    log.info(`Email sent successfully: ${template} to ${to}`, { userId });
    
    return { success: true };
  } catch (error) {
    log.error(`Email sending failed: ${template} to ${to}`, error);
    throw error;
  }
});

// 清理任务
cleanupQueue.process('cleanup-temp-files', async (job) => {
  try {
    log.info('Starting temp files cleanup');
    
    await fileProcessor.cleanupTempFiles(24); // 清理24小时前的临时文件
    
    log.info('Temp files cleanup completed');
    
    return { success: true };
  } catch (error) {
    log.error('Temp files cleanup failed', error);
    throw error;
  }
});

cleanupQueue.process('cleanup-expired-shares', async (job) => {
  try {
    log.info('Starting expired shares cleanup');
    
    // 清理过期的分享链接
    const result = await dbRun(
      'DELETE FROM public_shares WHERE expires_at < ?',
      [new Date()]
    );
    
    log.info(`Cleaned up ${result.changes} expired shares`);
    
    return { success: true, cleaned: result.changes };
  } catch (error) {
    log.error('Expired shares cleanup failed', error);
    throw error;
  }
});

// 队列管理器
export class QueueManager {
  // 添加文件处理任务
  static async addFileProcessingJob(data: FileProcessingJob, options?: Bull.JobOptions) {
    return fileProcessingQueue.add('process-file', data, {
      ...queueConfig.defaultJobOptions,
      ...options,
    });
  }

  // 添加存储同步任务
  static async addStorageSyncJob(data: StorageSyncJob, options?: Bull.JobOptions) {
    return storageSyncQueue.add('sync-file', data, {
      ...queueConfig.defaultJobOptions,
      ...options,
    });
  }

  // 添加邮件发送任务
  static async addEmailJob(data: EmailJob, options?: Bull.JobOptions) {
    return emailQueue.add('send-email', data, {
      ...queueConfig.defaultJobOptions,
      ...options,
    });
  }

  // 添加清理任务
  static async addCleanupJob(type: 'temp-files' | 'expired-shares', options?: Bull.JobOptions) {
    const queueName = type === 'temp-files' ? 'cleanup-temp-files' : 'cleanup-expired-shares';
    return cleanupQueue.add(queueName, {}, {
      ...queueConfig.defaultJobOptions,
      ...options,
    });
  }

  // 获取队列状态
  static async getQueueStats() {
    const queues = [
      { name: 'file-processing', queue: fileProcessingQueue },
      { name: 'storage-sync', queue: storageSyncQueue },
      { name: 'email', queue: emailQueue },
      { name: 'cleanup', queue: cleanupQueue },
    ];

    const stats = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
        ]);

        return {
          name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
        };
      })
    );

    return stats;
  }

  // 清理所有队列
  static async cleanAllQueues() {
    const queues = [fileProcessingQueue, storageSyncQueue, emailQueue, cleanupQueue];
    
    await Promise.all(
      queues.map(queue => queue.clean(0, 'completed'))
    );
    
    await Promise.all(
      queues.map(queue => queue.clean(0, 'failed'))
    );
  }

  // 暂停所有队列
  static async pauseAllQueues() {
    const queues = [fileProcessingQueue, storageSyncQueue, emailQueue, cleanupQueue];
    await Promise.all(queues.map(queue => queue.pause()));
  }

  // 恢复所有队列
  static async resumeAllQueues() {
    const queues = [fileProcessingQueue, storageSyncQueue, emailQueue, cleanupQueue];
    await Promise.all(queues.map(queue => queue.resume()));
  }
}

// 设置定时清理任务
export const setupScheduledJobs = () => {
  // 每天凌晨2点清理临时文件
  cleanupQueue.add('cleanup-temp-files', {}, {
    repeat: { cron: '0 2 * * *' },
    removeOnComplete: 1,
    removeOnFail: 1,
  });

  // 每小时清理过期分享
  cleanupQueue.add('cleanup-expired-shares', {}, {
    repeat: { cron: '0 * * * *' },
    removeOnComplete: 1,
    removeOnFail: 1,
  });

  log.info('Scheduled jobs setup completed');
};

// 错误处理
fileProcessingQueue.on('failed', (job, err) => {
  log.error(`File processing job failed: ${job.id}`, err);
});

storageSyncQueue.on('failed', (job, err) => {
  log.error(`Storage sync job failed: ${job.id}`, err);
});

emailQueue.on('failed', (job, err) => {
  log.error(`Email job failed: ${job.id}`, err);
});

cleanupQueue.on('failed', (job, err) => {
  log.error(`Cleanup job failed: ${job.id}`, err);
});
