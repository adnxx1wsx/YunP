import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

// 性能监控中间件
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };

    // 记录性能数据
    const performanceData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      memoryDelta,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    // 慢请求警告（超过1秒）
    if (duration > 1000) {
      log.performance(`Slow request detected: ${req.method} ${req.originalUrl}`, duration, performanceData);
    }

    // 高内存使用警告（超过50MB）
    if (Math.abs(memoryDelta.heapUsed) > 50 * 1024 * 1024) {
      log.performance(`High memory usage detected: ${req.method} ${req.originalUrl}`, duration, performanceData);
    }

    // 记录所有请求的基本性能信息
    if (process.env.NODE_ENV === 'development' || duration > 500) {
      log.debug(`Request completed: ${req.method} ${req.originalUrl} - ${duration}ms`, performanceData);
    }
  });

  next();
};

// 内存监控
export const memoryMonitor = () => {
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    // 内存使用超过阈值时记录警告
    if (memoryUsageMB.heapUsed > 500) { // 500MB
      log.warn('High memory usage detected', memoryUsageMB);
    }

    // 定期记录内存使用情况
    if (process.env.NODE_ENV === 'development') {
      log.debug('Memory usage', memoryUsageMB);
    }
  }, 60000); // 每分钟检查一次
};

// CPU 监控
export const cpuMonitor = () => {
  let lastCpuUsage = process.cpuUsage();
  
  setInterval(() => {
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);
    const cpuPercent = {
      user: Math.round(currentCpuUsage.user / 1000), // 转换为毫秒
      system: Math.round(currentCpuUsage.system / 1000)
    };

    lastCpuUsage = process.cpuUsage();

    // CPU 使用率过高时记录警告
    const totalCpu = cpuPercent.user + cpuPercent.system;
    if (totalCpu > 80) { // 80% CPU 使用率
      log.warn('High CPU usage detected', cpuPercent);
    }

    // 定期记录 CPU 使用情况
    if (process.env.NODE_ENV === 'development') {
      log.debug('CPU usage', cpuPercent);
    }
  }, 60000); // 每分钟检查一次
};

// 请求统计
interface RequestStats {
  total: number;
  success: number;
  error: number;
  avgResponseTime: number;
  requestsPerMinute: number;
}

class RequestStatsCollector {
  private stats: RequestStats = {
    total: 0,
    success: 0,
    error: 0,
    avgResponseTime: 0,
    requestsPerMinute: 0
  };
  
  private responseTimes: number[] = [];
  private requestTimestamps: number[] = [];

  addRequest(responseTime: number, statusCode: number) {
    this.stats.total++;
    this.responseTimes.push(responseTime);
    this.requestTimestamps.push(Date.now());

    if (statusCode >= 200 && statusCode < 400) {
      this.stats.success++;
    } else {
      this.stats.error++;
    }

    // 计算平均响应时间
    this.stats.avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    // 清理旧数据（保留最近1小时的数据）
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.responseTimes = this.responseTimes.slice(-1000); // 保留最近1000个请求
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneHourAgo);

    // 计算每分钟请求数
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentRequests = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
    this.stats.requestsPerMinute = recentRequests.length;
  }

  getStats(): RequestStats {
    return { ...this.stats };
  }

  reset() {
    this.stats = {
      total: 0,
      success: 0,
      error: 0,
      avgResponseTime: 0,
      requestsPerMinute: 0
    };
    this.responseTimes = [];
    this.requestTimestamps = [];
  }
}

export const requestStatsCollector = new RequestStatsCollector();

// 请求统计中间件
export const requestStats = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    requestStatsCollector.addRequest(responseTime, res.statusCode);
  });

  next();
};

// 健康检查端点的统计信息
export const getHealthStats = () => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    },
    requests: requestStatsCollector.getStats(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };
};
