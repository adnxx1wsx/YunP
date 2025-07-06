import { StorageProvider as StorageProviderType } from '@shared/types';

export interface StorageFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  path: string;
  url?: string;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageFolder {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadOptions {
  fileName: string;
  mimeType: string;
  size: number;
  folderId?: string;
  overwrite?: boolean;
}

export interface DownloadOptions {
  range?: {
    start: number;
    end: number;
  };
}

export interface StorageQuota {
  total: number;
  used: number;
  available: number;
}

export interface StorageProviderConfig {
  provider: StorageProviderType;
  config: Record<string, any>;
}

export abstract class StorageProvider {
  protected config: Record<string, any>;
  protected accessToken?: string;
  protected refreshToken?: string;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  // 认证相关
  abstract authenticate(accessToken?: string, refreshToken?: string): Promise<void>;
  abstract refreshAccessToken(): Promise<string>;
  abstract getAuthUrl(state?: string): string;
  abstract handleCallback(code: string, state?: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }>;

  // 文件操作
  abstract uploadFile(buffer: Buffer, options: UploadOptions): Promise<StorageFile>;
  abstract downloadFile(fileId: string, options?: DownloadOptions): Promise<Buffer>;
  abstract deleteFile(fileId: string): Promise<void>;
  abstract getFile(fileId: string): Promise<StorageFile>;
  abstract listFiles(folderId?: string, limit?: number, offset?: number): Promise<{
    files: StorageFile[];
    folders: StorageFolder[];
    total: number;
  }>;

  // 文件夹操作
  abstract createFolder(name: string, parentId?: string): Promise<StorageFolder>;
  abstract deleteFolder(folderId: string): Promise<void>;
  abstract getFolder(folderId: string): Promise<StorageFolder>;

  // 分享和权限
  abstract createShareLink(fileId: string, options?: {
    expiresAt?: Date;
    password?: string;
    allowEdit?: boolean;
  }): Promise<string>;
  abstract revokeShareLink(fileId: string, shareId: string): Promise<void>;

  // 搜索
  abstract searchFiles(query: string, options?: {
    folderId?: string;
    mimeType?: string;
    limit?: number;
  }): Promise<StorageFile[]>;

  // 存储配额
  abstract getQuota(): Promise<StorageQuota>;

  // 缩略图和预览
  abstract getThumbnail(fileId: string, size?: number): Promise<Buffer | null>;
  abstract getPreviewUrl(fileId: string): Promise<string | null>;

  // 批量操作
  abstract batchDelete(fileIds: string[]): Promise<void>;
  abstract batchMove(fileIds: string[], targetFolderId: string): Promise<void>;
  abstract batchCopy(fileIds: string[], targetFolderId: string): Promise<StorageFile[]>;

  // 版本控制
  abstract getFileVersions?(fileId: string): Promise<Array<{
    id: string;
    version: number;
    size: number;
    createdAt: Date;
  }>>;
  abstract restoreFileVersion?(fileId: string, versionId: string): Promise<StorageFile>;

  // 同步状态
  abstract getSyncStatus?(): Promise<{
    lastSyncAt: Date;
    pendingUploads: number;
    pendingDownloads: number;
    errors: Array<{
      fileId: string;
      error: string;
      timestamp: Date;
    }>;
  }>;

  // 工具方法
  protected generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  protected validateFileName(fileName: string): boolean {
    const invalidChars = /[<>:"/\\|?*]/;
    return !invalidChars.test(fileName) && fileName.length > 0 && fileName.length <= 255;
  }

  protected getMimeTypeFromExtension(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 错误处理
  protected handleError(error: any, context: string): never {
    console.error(`Storage Provider Error (${context}):`, error);
    throw new Error(`Storage operation failed: ${error.message || error}`);
  }
}
