import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { initDatabase } from './utils/database';
import { log, logStream } from './utils/logger';
import { performanceMonitor, memoryMonitor, cpuMonitor, requestStats, getHealthStats } from './middleware/performance';
import {
  generalRateLimit,
  speedLimiter,
  ipBlacklist,
  suspiciousActivityDetector
} from './middleware/security';
import { setupScheduledJobs } from './services/QueueManager';
import { cache } from './utils/cache';

// 路由导入
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import folderRoutes from './routes/folders';
import userRoutes from './routes/users';
import storageRoutes from './routes/storage';
import billingRoutes from './routes/billing';
import adminRoutes from './routes/admin';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化监控和定时任务
memoryMonitor();
cpuMonitor();
setupScheduledJobs();

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined', { stream: logStream }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 安全和性能中间件
app.use(ipBlacklist);
app.use(suspiciousActivityDetector);
app.use(generalRateLimit);
app.use(speedLimiter);
app.use(performanceMonitor);
app.use(requestStats);

// 静态文件服务 - 用于文件下载和预览
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json(getHealthStats());
});

// 系统状态端点
app.get('/api/system/status', (req, res) => {
  res.json({
    success: true,
    data: {
      ...getHealthStats(),
      cache: cache.getStats(),
      environment: process.env.NODE_ENV,
      features: {
        redis: !!process.env.REDIS_URL,
        email: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
        stripe: !!process.env.STRIPE_SECRET_KEY,
      }
    }
  });
});

// API 根路径
app.get('/api', (req, res) => {
  res.json({
    message: 'YunP Cloud Storage API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      files: '/api/files',
      folders: '/api/folders',
      users: '/api/users',
      storage: '/api/storage',
      billing: '/api/billing'
    }
  });
});

// 错误处理中间件
app.use(notFound);
app.use(errorHandler);

// 初始化数据库并启动服务器
async function startServer() {
  try {
    await initDatabase();
    log.info('Database initialized successfully');

    app.listen(PORT, () => {
      log.info(`Server is running on port ${PORT}`);
      log.info(`Environment: ${process.env.NODE_ENV}`);
      log.info(`API URL: http://localhost:${PORT}/api`);
      log.info('YunP Cloud Storage API started successfully');
    });
  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down gracefully');

  try {
    await cache.destroy();
    log.info('Cache destroyed');
    process.exit(0);
  } catch (error) {
    log.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down gracefully');

  try {
    await cache.destroy();
    log.info('Cache destroyed');
    process.exit(0);
  } catch (error) {
    log.error('Error during shutdown:', error);
    process.exit(1);
  }
});

startServer();

export default app;
