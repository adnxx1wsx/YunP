import winston from 'winston';
import path from 'path';

// 创建日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 创建控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// 创建日志传输器
const transports: winston.transport[] = [
  // 控制台输出
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  })
];

// 生产环境添加文件日志
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_DIR || './logs';
  
  // 错误日志
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // 组合日志
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // 访问日志
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'access.log'),
      level: 'info',
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
}

// 创建 logger 实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_DIR || './logs', 'exceptions.log') 
    })
  ],
  // 处理未处理的 Promise 拒绝
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_DIR || './logs', 'rejections.log') 
    })
  ]
});

// 开发环境下不退出进程
if (process.env.NODE_ENV !== 'production') {
  logger.exitOnError = false;
}

// 创建流接口供 Morgan 使用
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// 导出不同级别的日志方法
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  
  // 特定业务日志
  auth: (message: string, userId?: string, meta?: any) => 
    logger.info(`[AUTH] ${message}`, { userId, ...meta }),
  
  file: (message: string, fileId?: string, userId?: string, meta?: any) => 
    logger.info(`[FILE] ${message}`, { fileId, userId, ...meta }),
  
  storage: (message: string, provider?: string, userId?: string, meta?: any) => 
    logger.info(`[STORAGE] ${message}`, { provider, userId, ...meta }),
  
  billing: (message: string, userId?: string, subscriptionId?: string, meta?: any) => 
    logger.info(`[BILLING] ${message}`, { userId, subscriptionId, ...meta }),
  
  security: (message: string, ip?: string, userAgent?: string, meta?: any) => 
    logger.warn(`[SECURITY] ${message}`, { ip, userAgent, ...meta }),
  
  performance: (message: string, duration?: number, meta?: any) => 
    logger.info(`[PERFORMANCE] ${message}`, { duration, ...meta })
};

export default logger;
