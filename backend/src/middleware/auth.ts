import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbGet } from '../utils/database';
import { validateJWTSecret } from '../utils/security';
import { log } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      log.error('JWT_SECRET not configured');
      throw new Error('JWT_SECRET not configured');
    }

    // 验证JWT密钥安全性（仅在开发环境）
    if (process.env.NODE_ENV !== 'production') {
      try {
        validateJWTSecret(jwtSecret);
      } catch (error) {
        log.error('JWT Secret validation failed:', error);
        throw error;
      }
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    
    // 验证用户是否仍然存在
    const user = await dbGet(
      'SELECT id, username, email FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid token - user not found'
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    } else {
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    
    const user = await dbGet(
      'SELECT id, username, email FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // 可选认证失败时不返回错误，继续处理请求
    next();
  }
};
