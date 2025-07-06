import { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: any;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // 处理特定类型的错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // 记录错误
  if (statusCode >= 500) {
    log.error('Server Error:', err, {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      body: req.body,
      params: req.params,
      query: req.query
    });
  } else if (statusCode >= 400) {
    log.warn('Client Error:', {
      message: err.message,
      code: err.code,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id
    });
  }

  // 发送错误响应
  const response: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.url,
    method: req.method
  };

  // 添加错误代码
  if (err.code) {
    response.code = err.code;
  }

  // 开发环境下添加详细信息
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.details;
  }

  // 生产环境下隐藏敏感信息
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    response.error = 'Internal Server Error';
  }

  res.status(statusCode).json(response);
};

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
