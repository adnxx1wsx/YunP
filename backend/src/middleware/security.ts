import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';
import { cache } from '../utils/cache';

// 基础限流配置
export const createRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: options.message || 'Too many requests, please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      log.security(
        `Rate limit exceeded: ${req.method} ${req.originalUrl}`,
        req.ip,
        req.get('User-Agent')
      );
      
      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  });
};

// 通用API限流
export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP每15分钟最多1000个请求
  message: '请求过于频繁，请稍后再试'
});

// 认证相关限流
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每个IP每15分钟最多10次认证尝试
  message: '登录尝试过于频繁，请15分钟后再试',
  skipSuccessfulRequests: true
});

// 文件上传限流
export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 100, // 每个IP每小时最多100次上传
  message: '上传过于频繁，请稍后再试'
});

// 文件下载限流
export const downloadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 500, // 每个IP每小时最多500次下载
  message: '下载过于频繁，请稍后再试'
});

// 慢速响应中间件
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15分钟
  delayAfter: 100, // 前100个请求正常速度
  delayMs: 500, // 每个后续请求延迟500ms
  maxDelayMs: 20000, // 最大延迟20秒
  skipSuccessfulRequests: true,
  onLimitReached: (req: Request) => {
    log.security(
      `Speed limit reached: ${req.method} ${req.originalUrl}`,
      req.ip,
      req.get('User-Agent')
    );
  }
});

// IP黑名单中间件
const blacklistedIPs = new Set<string>();

export const ipBlacklist = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip;
  
  if (blacklistedIPs.has(clientIP)) {
    log.security(`Blocked request from blacklisted IP: ${clientIP}`, clientIP, req.get('User-Agent'));
    
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }
  
  next();
};

// 添加IP到黑名单
export const addToBlacklist = (ip: string, reason?: string) => {
  blacklistedIPs.add(ip);
  log.security(`IP added to blacklist: ${ip}`, ip, undefined, { reason });
};

// 从黑名单移除IP
export const removeFromBlacklist = (ip: string) => {
  blacklistedIPs.delete(ip);
  log.security(`IP removed from blacklist: ${ip}`, ip);
};

// 可疑活动检测
interface SuspiciousActivity {
  failedLogins: number;
  rapidRequests: number;
  lastActivity: number;
}

const suspiciousActivities = new Map<string, SuspiciousActivity>();

export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip;
  const now = Date.now();
  
  let activity = suspiciousActivities.get(clientIP) || {
    failedLogins: 0,
    rapidRequests: 0,
    lastActivity: now
  };
  
  // 检测快速请求
  if (now - activity.lastActivity < 100) { // 100ms内的请求
    activity.rapidRequests++;
  } else {
    activity.rapidRequests = Math.max(0, activity.rapidRequests - 1);
  }
  
  activity.lastActivity = now;
  suspiciousActivities.set(clientIP, activity);
  
  // 如果检测到可疑活动，记录并可能采取行动
  if (activity.rapidRequests > 50 || activity.failedLogins > 10) {
    log.security(
      `Suspicious activity detected from IP: ${clientIP}`,
      clientIP,
      req.get('User-Agent'),
      { 
        rapidRequests: activity.rapidRequests,
        failedLogins: activity.failedLogins,
        endpoint: req.originalUrl
      }
    );
    
    // 可以选择自动加入黑名单
    if (activity.rapidRequests > 100 || activity.failedLogins > 20) {
      addToBlacklist(clientIP, 'Automated suspicious activity detection');
      
      return res.status(403).json({
        success: false,
        error: 'Access denied due to suspicious activity'
      });
    }
  }
  
  next();
};

// 记录失败登录
export const recordFailedLogin = (ip: string) => {
  const activity = suspiciousActivities.get(ip) || {
    failedLogins: 0,
    rapidRequests: 0,
    lastActivity: Date.now()
  };
  
  activity.failedLogins++;
  suspiciousActivities.set(ip, activity);
};

// 清除成功登录的记录
export const clearFailedLogins = (ip: string) => {
  const activity = suspiciousActivities.get(ip);
  if (activity) {
    activity.failedLogins = 0;
    suspiciousActivities.set(ip, activity);
  }
};

// 文件类型验证中间件
export const fileTypeValidator = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next();
    }
    
    const fileType = req.file.mimetype;
    
    if (!allowedTypes.includes(fileType)) {
      log.security(
        `Blocked file upload with invalid type: ${fileType}`,
        req.ip,
        req.get('User-Agent'),
        { fileName: req.file.originalname }
      );
      
      return res.status(400).json({
        success: false,
        error: `File type ${fileType} is not allowed`
      });
    }
    
    next();
  };
};

// 文件大小验证中间件
export const fileSizeValidator = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next();
    }
    
    if (req.file.size > maxSize) {
      log.security(
        `Blocked file upload exceeding size limit: ${req.file.size} bytes`,
        req.ip,
        req.get('User-Agent'),
        { fileName: req.file.originalname, maxSize }
      );
      
      return res.status(400).json({
        success: false,
        error: `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }
    
    next();
  };
};

// 请求体大小验证
export const requestSizeValidator = (maxSize: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      log.security(
        `Blocked request exceeding size limit: ${contentLength} bytes`,
        req.ip,
        req.get('User-Agent')
      );
      
      return res.status(413).json({
        success: false,
        error: 'Request entity too large'
      });
    }
    
    next();
  };
};

// 解析大小字符串（如 "10MB"）
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024
  };
  
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  return Math.floor(value * units[unit]);
}

// CSRF保护中间件
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // 对于状态改变的请求，检查CSRF令牌
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.get('X-CSRF-Token') || req.body._csrf;
    const sessionToken = req.session?.csrfToken;
    
    if (!token || !sessionToken || token !== sessionToken) {
      log.security(
        `CSRF token mismatch: ${req.method} ${req.originalUrl}`,
        req.ip,
        req.get('User-Agent')
      );
      
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token'
      });
    }
  }
  
  next();
};

// 生成CSRF令牌
export const generateCSRFToken = (): string => {
  return require('crypto').randomBytes(32).toString('hex');
};

// 清理过期的可疑活动记录
setInterval(() => {
  const now = Date.now();
  const expireTime = 24 * 60 * 60 * 1000; // 24小时
  
  for (const [ip, activity] of suspiciousActivities.entries()) {
    if (now - activity.lastActivity > expireTime) {
      suspiciousActivities.delete(ip);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次
