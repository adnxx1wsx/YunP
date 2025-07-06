// 用户相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  storageUsed: number;
  storageLimit: number;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserRegistration {
  username: string;
  email: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// 文件相关类型
export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  folderId?: string;
  userId: string;
  isPublic: boolean;
  shareToken?: string;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileUpload {
  file: File;
  folderId?: string;
}

export interface FileShare {
  id: string;
  fileId: string;
  shareToken: string;
  expiresAt?: Date;
  downloadLimit?: number;
  downloadCount: number;
  createdAt: Date;
}

// 文件夹相关类型
export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  userId: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderCreate {
  name: string;
  parentId?: string;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 文件系统项目类型（文件或文件夹）
export interface FileSystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  mimeType?: string;
  isPublic?: boolean;
  shareToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 存储统计类型
export interface StorageStats {
  totalFiles: number;
  totalFolders: number;
  storageUsed: number;
  storageLimit: number;
  recentFiles: FileItem[];
}

// 回收站项目类型
export interface TrashItem {
  id: string;
  originalItem: FileSystemItem;
  deletedAt: Date;
  restorePath: string;
}

// 搜索相关类型
export interface SearchQuery {
  query: string;
  type?: 'file' | 'folder' | 'all';
  folderId?: string;
  mimeType?: string;
}

export interface SearchResult {
  files: FileItem[];
  folders: Folder[];
  total: number;
}

// 错误类型
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// 上传进度类型
export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

// 云存储提供商类型
export type StorageProvider = 'local' | 'onedrive' | 'googledrive' | 'dropbox' | 'aws-s3' | 'azure-blob';

// 云存储配置
export interface StorageConfig {
  provider: StorageProvider;
  config: {
    // OneDrive
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;

    // Google Drive
    googleClientId?: string;
    googleClientSecret?: string;
    googleRedirectUri?: string;

    // Dropbox
    dropboxAppKey?: string;
    dropboxAppSecret?: string;

    // AWS S3
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    awsBucket?: string;

    // Azure Blob
    azureConnectionString?: string;
    azureContainer?: string;

    // 本地存储
    localPath?: string;
  };
}

// 用户存储提供商绑定
export interface UserStorageProvider {
  id: string;
  userId: string;
  provider: StorageProvider;
  displayName: string;
  isDefault: boolean;
  isActive: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  quota: {
    total: number;
    used: number;
    available: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 文件同步状态
export interface FileSyncStatus {
  id: string;
  fileId: string;
  providerId: string;
  remoteId?: string;
  remotePath?: string;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  lastSyncAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 订阅计划类型
export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: {
    storageLimit: number; // 字节
    maxFileSize: number; // 字节
    maxFiles: number;
    cloudProviders: StorageProvider[];
    advancedSharing: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 用户订阅
export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 文件版本历史
export interface FileVersion {
  id: string;
  fileId: string;
  version: number;
  size: number;
  checksum: string;
  path: string;
  providerId?: string;
  remoteId?: string;
  createdAt: Date;
}

// 团队/组织
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  ownerId: string;
  planId: string;
  settings: {
    allowPublicSharing: boolean;
    allowExternalSharing: boolean;
    enforcePasswordPolicy: boolean;
    requireTwoFactor: boolean;
    maxMemberCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 组织成员
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  invitedBy?: string;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 文件权限
export interface FilePermission {
  id: string;
  fileId: string;
  userId?: string;
  organizationId?: string;
  permission: 'read' | 'write' | 'admin';
  grantedBy: string;
  expiresAt?: Date;
  createdAt: Date;
}

// 活动日志
export interface ActivityLog {
  id: string;
  userId: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

// 文件标签
export interface FileTag {
  id: string;
  name: string;
  color: string;
  userId: string;
  organizationId?: string;
  createdAt: Date;
}

// 文件标签关联
export interface FileTagAssociation {
  fileId: string;
  tagId: string;
  createdAt: Date;
}

// 公共分享设置
export interface PublicShare {
  id: string;
  fileId: string;
  token: string;
  password?: string;
  allowDownload: boolean;
  allowPreview: boolean;
  expiresAt?: Date;
  downloadLimit?: number;
  downloadCount: number;
  viewCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// 批量操作
export interface BatchOperation {
  id: string;
  userId: string;
  type: 'move' | 'copy' | 'delete' | 'share' | 'tag';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  failedItems: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// 文件预览配置
export interface PreviewConfig {
  maxFileSize: number;
  supportedTypes: string[];
  thumbnailSizes: number[];
  videoPreviewDuration: number;
}

// 系统配置
export interface SystemConfig {
  maintenance: {
    enabled: boolean;
    message: string;
    startTime?: Date;
    endTime?: Date;
  };
  registration: {
    enabled: boolean;
    requireEmailVerification: boolean;
    allowedDomains?: string[];
  };
  storage: {
    defaultProvider: StorageProvider;
    providers: StorageConfig[];
  };
  features: {
    publicSharing: boolean;
    organizationSupport: boolean;
    apiAccess: boolean;
    webhooks: boolean;
  };
  limits: {
    maxFileSize: number;
    maxFilesPerUser: number;
    maxOrganizationMembers: number;
  };
}
