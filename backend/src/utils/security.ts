import crypto from 'crypto';
import { log } from './logger';

// 安全配置常量
export const SECURITY_CONFIG = {
  JWT_MIN_LENGTH: 32,
  PASSWORD_MIN_LENGTH: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15分钟
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24小时
};

// 安全的文件类型白名单
export const SAFE_MIME_TYPES = new Set([
  // 图片 (安全)
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  
  // 视频 (相对安全)
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/wmv',
  'video/flv',
  'video/webm',
  'video/mkv',
  
  // 音频 (安全)
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  'audio/m4a',
  
  // 文档 (相对安全)
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // 文本 (仅纯文本)
  'text/plain',
  'text/csv',
  
  // 压缩文件 (需要额外检查)
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
]);

// 危险文件类型黑名单
export const DANGEROUS_MIME_TYPES = new Set([
  'text/html',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'image/svg+xml', // SVG可能包含脚本
  'application/x-shockwave-flash',
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
]);

// 文件魔数检查
export const FILE_SIGNATURES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/zip': [0x50, 0x4B, 0x03, 0x04],
};

/**
 * 验证JWT密钥安全性
 */
export const validateJWTSecret = (secret: string): boolean => {
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  
  if (secret.length < SECURITY_CONFIG.JWT_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${SECURITY_CONFIG.JWT_MIN_LENGTH} characters long`);
  }
  
  // 检查是否为默认值
  const defaultSecrets = [
    'your-super-secret-jwt-key',
    'your-super-secret-jwt-key-change-this-in-production',
    'secret',
    'jwt-secret',
  ];
  
  if (defaultSecrets.includes(secret)) {
    throw new Error('JWT_SECRET cannot be a default value. Please use a secure random string.');
  }
  
  return true;
};

/**
 * 生成安全的随机密钥
 */
export const generateSecureSecret = (length: number = 64): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * 验证文件类型安全性
 */
export const validateFileType = (mimeType: string, filename: string): boolean => {
  // 检查MIME类型是否在安全列表中
  if (!SAFE_MIME_TYPES.has(mimeType)) {
    log.security(`Blocked unsafe file type: ${mimeType}`, undefined, undefined, { filename });
    return false;
  }
  
  // 检查是否在危险列表中
  if (DANGEROUS_MIME_TYPES.has(mimeType)) {
    log.security(`Blocked dangerous file type: ${mimeType}`, undefined, undefined, { filename });
    return false;
  }
  
  // 检查文件扩展名
  const ext = filename.toLowerCase().split('.').pop();
  const dangerousExtensions = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    'html', 'htm', 'svg', 'php', 'asp', 'jsp', 'sh', 'ps1'
  ];
  
  if (ext && dangerousExtensions.includes(ext)) {
    log.security(`Blocked dangerous file extension: ${ext}`, undefined, undefined, { filename });
    return false;
  }
  
  return true;
};

/**
 * 验证文件内容（魔数检查）
 */
export const validateFileContent = (buffer: Buffer, expectedMimeType: string): boolean => {
  const signature = FILE_SIGNATURES[expectedMimeType as keyof typeof FILE_SIGNATURES];
  
  if (!signature) {
    // 如果没有定义魔数，跳过检查
    return true;
  }
  
  if (buffer.length < signature.length) {
    return false;
  }
  
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      log.security(`File signature mismatch for ${expectedMimeType}`, undefined, undefined, {
        expected: signature,
        actual: Array.from(buffer.slice(0, signature.length))
      });
      return false;
    }
  }
  
  return true;
};

/**
 * 清理文件名，移除危险字符
 */
export const sanitizeFilename = (filename: string): string => {
  // 移除路径遍历字符
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');
  
  // 移除控制字符
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // 限制长度
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const name = sanitized.substring(0, 255 - (ext ? ext.length + 1 : 0));
    sanitized = ext ? `${name}.${ext}` : name;
  }
  
  // 确保不为空
  if (!sanitized.trim()) {
    sanitized = `file_${Date.now()}`;
  }
  
  return sanitized.trim();
};

/**
 * 验证密码强度
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
    feedback.push(`密码长度至少需要${SECURITY_CONFIG.PASSWORD_MIN_LENGTH}个字符`);
  } else {
    score += 1;
  }
  
  if (!/[a-z]/.test(password)) {
    feedback.push('密码需要包含小写字母');
  } else {
    score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    feedback.push('密码需要包含大写字母');
  } else {
    score += 1;
  }
  
  if (!/\d/.test(password)) {
    feedback.push('密码需要包含数字');
  } else {
    score += 1;
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('密码需要包含特殊字符');
  } else {
    score += 1;
  }
  
  // 检查常见弱密码
  const commonPasswords = [
    'password', '123456', 'password123', 'admin', 'qwerty',
    '12345678', '123456789', 'password1', 'abc123'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    feedback.push('不能使用常见的弱密码');
    score = 0;
  }
  
  return {
    isValid: score >= 3 && feedback.length === 0,
    score,
    feedback
  };
};

/**
 * 生成安全的随机令牌
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * 哈希敏感数据
 */
export const hashSensitiveData = (data: string, salt?: string): string => {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512');
  return `${actualSalt}:${hash.toString('hex')}`;
};

/**
 * 验证哈希数据
 */
export const verifyHashedData = (data: string, hashedData: string): boolean => {
  const [salt, hash] = hashedData.split(':');
  const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
  return hash === verifyHash.toString('hex');
};

/**
 * 检查IP是否为内网地址
 */
export const isPrivateIP = (ip: string): boolean => {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  
  return privateRanges.some(range => range.test(ip));
};

/**
 * 速率限制检查
 */
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15分钟
  ) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);
    
    if (!record || now > record.resetTime) {
      this.attempts.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return true;
    }
    
    if (record.count >= this.maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
  
  getRemainingAttempts(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record || Date.now() > record.resetTime) {
      return this.maxAttempts;
    }
    return Math.max(0, this.maxAttempts - record.count);
  }
}
