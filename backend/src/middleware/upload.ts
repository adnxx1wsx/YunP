import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { AuthenticatedRequest } from './auth';

// 文件大小限制 (默认 100MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE?.replace(/[^\d]/g, '') || '104857600');

// 允许的文件类型
const ALLOWED_MIME_TYPES = [
  // 图片
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  
  // 视频
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/wmv',
  'video/flv',
  'video/webm',
  
  // 音频
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  
  // 文档
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // 文本
  'text/plain',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  
  // 压缩文件
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip'
];

// 存储配置
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  
  filename: (req: AuthenticatedRequest, file: Express.Multer.File, cb) => {
    // 生成唯一文件名
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueId}${ext}`;
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 检查文件类型
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(`File type ${file.mimetype} is not allowed`) as any;
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }
  
  // 检查文件名
  if (!file.originalname || file.originalname.length > 255) {
    const error = new Error('Invalid filename') as any;
    error.code = 'INVALID_FILENAME';
    return cb(error, false);
  }
  
  cb(null, true);
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
