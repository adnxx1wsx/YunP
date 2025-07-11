import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { AuthenticatedRequest } from './auth';
import {
  SAFE_MIME_TYPES,
  validateFileType,
  validateFileContent,
  sanitizeFilename
} from '../utils/security';
import { log } from '../utils/logger';

// 文件大小限制 (默认 100MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE?.replace(/[^\d]/g, '') || '104857600');

// 注意：现在使用安全的文件类型列表 (从 security.ts 导入)

// 存储配置
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  
  filename: (req: AuthenticatedRequest, file: Express.Multer.File, cb) => {
    // 清理原始文件名
    const sanitizedName = sanitizeFilename(file.originalname);

    // 生成唯一文件名
    const uniqueId = uuidv4();
    const ext = path.extname(sanitizedName);
    const filename = `${uniqueId}${ext}`;

    // 记录文件上传
    log.file(`File upload: ${sanitizedName} -> ${filename}`, file.fieldname, req.user?.id);

    cb(null, filename);
  }
});

// 安全的文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  try {
    // 使用安全验证函数检查文件类型
    if (!validateFileType(file.mimetype, file.originalname)) {
      const error = new Error(`File type ${file.mimetype} is not allowed for security reasons`) as any;
      error.code = 'INVALID_FILE_TYPE';
      log.security(`Blocked unsafe file upload: ${file.mimetype}`, req.ip, req.get('User-Agent'), {
        filename: file.originalname,
        userId: (req as AuthenticatedRequest).user?.id
      });
      return cb(error, false);
    }

    // 检查文件名
    if (!file.originalname || file.originalname.length > 255) {
      const error = new Error('Invalid filename') as any;
      error.code = 'INVALID_FILENAME';
      return cb(error, false);
    }

    // 检查文件名中的危险字符
    const sanitizedName = sanitizeFilename(file.originalname);
    if (sanitizedName !== file.originalname) {
      log.security(`File name sanitized: ${file.originalname} -> ${sanitizedName}`, req.ip, req.get('User-Agent'));
    }

    cb(null, true);
  } catch (error) {
    log.error('File filter error:', error);
    const filterError = new Error('File validation failed') as any;
    filterError.code = 'VALIDATION_ERROR';
    cb(filterError, false);
  }
};

// Multer 配置
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // 最多同时上传10个文件
    fieldSize: 1024 * 1024, // 1MB
    fieldNameSize: 100,
    fields: 10
  }
});

// 单文件上传中间件
export const uploadSingle = upload.single('file');

// 多文件上传中间件
export const uploadMultiple = upload.array('files', 10);

// 错误处理中间件
export const handleUploadError = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    let message = 'File upload error';
    let statusCode = 400;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum is 10 files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts';
        break;
      default:
        message = error.message;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: message,
      code: error.code
    });
  }
  
  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: error.message,
      allowedTypes: ALLOWED_MIME_TYPES
    });
  }
  
  if (error.code === 'INVALID_FILENAME') {
    return res.status(400).json({
      success: false,
      error: 'Invalid filename. Filename must be between 1 and 255 characters'
    });
  }
  
  next(error);
};

// 获取文件扩展名
export const getFileExtension = (filename: string): string => {
  return path.extname(filename).toLowerCase();
};

// 检查是否为图片文件
export const isImageFile = (mimetype: string): boolean => {
  return mimetype.startsWith('image/');
};

// 检查是否为视频文件
export const isVideoFile = (mimetype: string): boolean => {
  return mimetype.startsWith('video/');
};

// 检查是否为音频文件
export const isAudioFile = (mimetype: string): boolean => {
  return mimetype.startsWith('audio/');
};

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
