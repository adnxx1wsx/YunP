import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  User,
  UserLogin,
  UserRegistration,
  AuthResponse,
  FileItem,
  Folder,
  FolderCreate,
  ApiResponse,
  PaginatedResponse,
  StorageStats,
  SearchResult,
  TrashItem,
  UserStorageProvider,
  SubscriptionPlan,
  UserSubscription,
  StorageProvider as StorageProviderType
} from '@shared/types';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期或无效，清除本地存储并重定向到登录页
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关 API
export const authApi = {
  login: (data: UserLogin): Promise<AxiosResponse<ApiResponse<AuthResponse>>> =>
    api.post('/auth/login', data),
  
  register: (data: UserRegistration): Promise<AxiosResponse<ApiResponse<AuthResponse>>> =>
    api.post('/auth/register', data),
  
  getMe: (): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.get('/auth/me'),
  
  updateProfile: (data: Partial<User>): Promise<AxiosResponse<ApiResponse<User>>> =>
    api.put('/auth/profile', data),
  
  changePassword: (data: { currentPassword: string; newPassword: string }): Promise<AxiosResponse<ApiResponse>> =>
    api.put('/auth/password', data),
  
  logout: (): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/auth/logout'),
};

// 文件相关 API
export const fileApi = {
  getFiles: (params?: {
    folderId?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
    search?: string;
  }): Promise<AxiosResponse<ApiResponse<PaginatedResponse<FileItem>>>> =>
    api.get('/files', { params }),
  
  uploadFile: (file: File, folderId?: string, onProgress?: (progress: number) => void): Promise<AxiosResponse<ApiResponse<FileItem>>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }
    
    return api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },
  
  getFile: (id: string): Promise<AxiosResponse<ApiResponse<FileItem>>> =>
    api.get(`/files/${id}`),
  
  downloadFile: (id: string, token?: string): string => {
    const params = token ? `?token=${token}` : '';
    return `/api/files/${id}/download${params}`;
  },
  
  previewFile: (id: string, token?: string): string => {
    const params = token ? `?token=${token}` : '';
    return `/api/files/${id}/preview${params}`;
  },
  
  shareFile: (id: string, data?: {
    expiresAt?: Date;
    downloadLimit?: number;
  }): Promise<AxiosResponse<ApiResponse<{
    shareToken: string;
    shareUrl: string;
    expiresAt?: Date;
    downloadLimit?: number;
  }>>> =>
    api.post(`/files/${id}/share`, data),
  
  unshareFile: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/files/${id}/share`),
  
  deleteFile: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/files/${id}`),
};

// 文件夹相关 API
export const folderApi = {
  getFolders: (params?: {
    parentId?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
  }): Promise<AxiosResponse<ApiResponse<PaginatedResponse<Folder>>>> =>
    api.get('/folders', { params }),
  
  createFolder: (data: FolderCreate): Promise<AxiosResponse<ApiResponse<Folder>>> =>
    api.post('/folders', data),
  
  getFolder: (id: string): Promise<AxiosResponse<ApiResponse<Folder & {
    subfolderCount: number;
    fileCount: number;
  }>>> =>
    api.get(`/folders/${id}`),
  
  renameFolder: (id: string, name: string): Promise<AxiosResponse<ApiResponse<Folder>>> =>
    api.put(`/folders/${id}`, { name }),
  
  deleteFolder: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/folders/${id}`),
  
  getBreadcrumb: (id: string): Promise<AxiosResponse<ApiResponse<Array<{
    id: string;
    name: string;
  }>>>> =>
    api.get(`/folders/${id}/breadcrumb`),
};

// 用户相关 API
export const userApi = {
  getStats: (): Promise<AxiosResponse<ApiResponse<StorageStats>>> =>
    api.get('/users/stats'),
  
  getTrash: (params?: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: string;
  }): Promise<AxiosResponse<ApiResponse<PaginatedResponse<TrashItem>>>> =>
    api.get('/users/trash', { params }),
  
  restoreTrashItem: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/users/trash/${id}/restore`),
  
  deleteTrashItem: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/users/trash/${id}`),
  
  emptyTrash: (): Promise<AxiosResponse<ApiResponse>> =>
    api.delete('/users/trash'),
  
  search: (params: {
    q: string;
    type?: 'file' | 'folder' | 'all';
    limit?: number;
  }): Promise<AxiosResponse<ApiResponse<SearchResult>>> =>
    api.get('/users/search', { params }),
};

// 存储提供商相关 API
export const storageApi = {
  getProviders: (): Promise<AxiosResponse<ApiResponse<Array<{
    provider: StorageProviderType;
    displayName: string;
    isConfigured: boolean;
    authUrl?: string;
  }>>>> =>
    api.get('/storage/providers'),

  getUserProviders: (): Promise<AxiosResponse<ApiResponse<UserStorageProvider[]>>> =>
    api.get('/storage/user-providers'),

  setDefaultProvider: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/storage/user-providers/${id}/default`),

  removeProvider: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/storage/user-providers/${id}`),

  syncProviderQuota: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.post(`/storage/user-providers/${id}/sync`),

  getAuthUrl: (provider: StorageProviderType): Promise<AxiosResponse<ApiResponse<{ authUrl: string }>>> =>
    api.get(`/storage/${provider}/auth`),

  testConnection: (provider: StorageProviderType): Promise<AxiosResponse<ApiResponse<{
    connected: boolean;
    quota?: any;
    error?: string;
  }>>> =>
    api.post(`/storage/test-connection/${provider}`),

  getProviderFiles: (provider: StorageProviderType, params?: {
    folderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AxiosResponse<ApiResponse<{
    files: any[];
    folders: any[];
    total: number;
  }>>> =>
    api.get(`/storage/providers/${provider}/files`, { params }),

  searchProviderFiles: (provider: StorageProviderType, params: {
    q: string;
    limit?: number;
  }): Promise<AxiosResponse<ApiResponse<any[]>>> =>
    api.get(`/storage/providers/${provider}/search`, { params }),

  getProviderQuota: (provider: StorageProviderType): Promise<AxiosResponse<ApiResponse<{
    total: number;
    used: number;
    available: number;
  }>>> =>
    api.get(`/storage/providers/${provider}/quota`),

  createProviderFolder: (provider: StorageProviderType, data: {
    name: string;
    parentId?: string;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/storage/providers/${provider}/folders`, data),

  deleteProviderItem: (provider: StorageProviderType, itemId: string, type: 'file' | 'folder' = 'file'): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/storage/providers/${provider}/items/${itemId}`, { params: { type } }),

  batchOperation: (provider: StorageProviderType, operation: 'delete' | 'move' | 'copy', data: {
    itemIds: string[];
    targetFolderId?: string;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.post(`/storage/providers/${provider}/batch/${operation}`, data),
};

// 订阅和计费相关 API
export const billingApi = {
  getPlans: (): Promise<AxiosResponse<ApiResponse<SubscriptionPlan[]>>> =>
    api.get('/billing/plans'),

  getSubscription: (): Promise<AxiosResponse<ApiResponse<UserSubscription>>> =>
    api.get('/billing/subscription'),

  subscribe: (data: {
    planId: string;
    paymentMethodId: string;
  }): Promise<AxiosResponse<ApiResponse<{
    subscriptionId: string;
    clientSecret: string;
    status: string;
  }>>> =>
    api.post('/billing/subscribe', data),

  cancelSubscription: (immediate: boolean = false): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/billing/cancel', { immediate }),

  resumeSubscription: (): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/billing/resume'),

  getInvoices: (params?: {
    limit?: number;
    offset?: number;
  }): Promise<AxiosResponse<ApiResponse<Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: Date;
    paidAt?: Date;
    invoiceUrl?: string;
    invoicePdf?: string;
  }>>>> =>
    api.get('/billing/invoices', { params }),
};

// 管理员相关 API
export const adminApi = {
  getStats: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/stats'),

  getUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/users', { params }),

  getUserDetail: (id: string): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get(`/admin/users/${id}`),

  updateUser: (id: string, data: any): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/admin/users/${id}`, data),

  deleteUser: (id: string): Promise<AxiosResponse<ApiResponse>> =>
    api.delete(`/admin/users/${id}`),

  getLogs: (params?: {
    level?: string;
    limit?: number;
    page?: number;
  }): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/logs', { params }),

  getQueues: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/queues'),

  cleanQueues: (): Promise<AxiosResponse<ApiResponse>> =>
    api.post('/admin/queues/clean'),

  getCache: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/cache'),

  clearCache: (): Promise<AxiosResponse<ApiResponse>> =>
    api.delete('/admin/cache'),

  getConfig: (): Promise<AxiosResponse<ApiResponse<any>>> =>
    api.get('/admin/config'),

  updateConfig: (key: string, data: { value: any; type?: string }): Promise<AxiosResponse<ApiResponse>> =>
    api.put(`/admin/config/${key}`, data),
};

export default api;
