import { StorageProvider as StorageProviderType, StorageConfig } from '@shared/types';
import { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { OneDriveProvider } from './OneDriveProvider';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import { DropboxProvider } from './DropboxProvider';
import { S3Provider } from './S3Provider';
import { AzureBlobProvider } from './AzureBlobProvider';
import { dbGet, dbAll, dbRun } from '../../utils/database';

export class StorageManager {
  private providers: Map<string, StorageProvider> = new Map();
  private defaultProvider: StorageProvider | null = null;

  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    // 初始化本地存储提供商（默认）
    const localProvider = new LocalStorageProvider({
      localPath: process.env.UPLOAD_DIR || './uploads',
    });
    
    this.providers.set('local', localProvider);
    this.defaultProvider = localProvider;

    // 初始化其他云存储提供商
    if (process.env.ONEDRIVE_CLIENT_ID && process.env.ONEDRIVE_CLIENT_SECRET) {
      const oneDriveProvider = new OneDriveProvider({
        clientId: process.env.ONEDRIVE_CLIENT_ID,
        clientSecret: process.env.ONEDRIVE_CLIENT_SECRET,
        redirectUri: process.env.ONEDRIVE_REDIRECT_URI,
      });
      this.providers.set('onedrive', oneDriveProvider);
    }

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const googleDriveProvider = new GoogleDriveProvider({
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
        googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
      });
      this.providers.set('googledrive', googleDriveProvider);
    }

    // 初始化 Dropbox 提供商
    if (process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET) {
      const dropboxProvider = new DropboxProvider({});
      this.providers.set('dropbox', dropboxProvider);
    }

    // 初始化 AWS S3 提供商
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const s3Provider = new S3Provider({});
      this.providers.set('aws-s3', s3Provider);
    }

    // 初始化 Azure Blob 提供商
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      const azureBlobProvider = new AzureBlobProvider({});
      this.providers.set('azure-blob', azureBlobProvider);
    }
  }

  async getProvider(providerId: string): Promise<StorageProvider> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Storage provider ${providerId} not found`);
    }
    return provider;
  }

  async getUserProvider(userId: string, providerId?: string): Promise<StorageProvider> {
    if (providerId) {
      const provider = await this.getProvider(providerId);
      
      // 获取用户的认证信息
      const userProvider = await dbGet(
        'SELECT * FROM user_storage_providers WHERE user_id = ? AND provider = ? AND is_active = 1',
        [userId, providerId]
      );

      if (userProvider && userProvider.access_token) {
        await provider.authenticate(userProvider.access_token, userProvider.refresh_token);
      }

      return provider;
    }

    // 获取用户的默认存储提供商
    const defaultUserProvider = await dbGet(
      'SELECT * FROM user_storage_providers WHERE user_id = ? AND is_default = 1 AND is_active = 1',
      [userId]
    );

    if (defaultUserProvider) {
      return this.getUserProvider(userId, defaultUserProvider.provider);
    }

    // 返回系统默认提供商
    return this.defaultProvider!;
  }

  async addUserProvider(
    userId: string,
    provider: StorageProviderType,
    accessToken: string,
    refreshToken?: string,
    displayName?: string
  ): Promise<void> {
    const providerId = this.generateId();
    
    // 获取提供商配额信息
    const storageProvider = await this.getProvider(provider);
    await storageProvider.authenticate(accessToken, refreshToken);
    const quota = await storageProvider.getQuota();

    // 如果这是用户的第一个提供商，设为默认
    const existingProviders = await dbAll(
      'SELECT COUNT(*) as count FROM user_storage_providers WHERE user_id = ?',
      [userId]
    );
    const isDefault = existingProviders[0].count === 0;

    await dbRun(
      `INSERT INTO user_storage_providers 
       (id, user_id, provider, display_name, is_default, is_active, access_token, refresh_token, quota_total, quota_used, quota_available) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        providerId,
        userId,
        provider,
        displayName || this.getProviderDisplayName(provider),
        isDefault,
        true,
        accessToken,
        refreshToken,
        quota.total,
        quota.used,
        quota.available,
      ]
    );
  }

  async removeUserProvider(userId: string, providerId: string): Promise<void> {
    const userProvider = await dbGet(
      'SELECT * FROM user_storage_providers WHERE id = ? AND user_id = ?',
      [providerId, userId]
    );

    if (!userProvider) {
      throw new Error('Provider not found');
    }

    // 如果删除的是默认提供商，需要设置新的默认提供商
    if (userProvider.is_default) {
      const otherProvider = await dbGet(
        'SELECT id FROM user_storage_providers WHERE user_id = ? AND id != ? AND is_active = 1 LIMIT 1',
        [userId, providerId]
      );

      if (otherProvider) {
        await dbRun(
          'UPDATE user_storage_providers SET is_default = 1 WHERE id = ?',
          [otherProvider.id]
        );
      }
    }

    await dbRun(
      'UPDATE user_storage_providers SET is_active = 0 WHERE id = ?',
      [providerId]
    );
  }

  async setDefaultProvider(userId: string, providerId: string): Promise<void> {
    // 取消当前默认提供商
    await dbRun(
      'UPDATE user_storage_providers SET is_default = 0 WHERE user_id = ? AND is_default = 1',
      [userId]
    );

    // 设置新的默认提供商
    await dbRun(
      'UPDATE user_storage_providers SET is_default = 1 WHERE id = ? AND user_id = ?',
      [providerId, userId]
    );
  }

  async getUserProviders(userId: string): Promise<Array<{
    id: string;
    provider: StorageProviderType;
    displayName: string;
    isDefault: boolean;
    isActive: boolean;
    quota: {
      total: number;
      used: number;
      available: number;
    };
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const providers = await dbAll(
      `SELECT id, provider, display_name, is_default, is_active, 
              quota_total, quota_used, quota_available, created_at, updated_at
       FROM user_storage_providers 
       WHERE user_id = ? AND is_active = 1
       ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );

    return providers.map(p => ({
      id: p.id,
      provider: p.provider,
      displayName: p.display_name,
      isDefault: Boolean(p.is_default),
      isActive: Boolean(p.is_active),
      quota: {
        total: p.quota_total,
        used: p.quota_used,
        available: p.quota_available,
      },
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    }));
  }

  async syncProviderQuota(userId: string, providerId: string): Promise<void> {
    const userProvider = await dbGet(
      'SELECT * FROM user_storage_providers WHERE id = ? AND user_id = ?',
      [providerId, userId]
    );

    if (!userProvider) {
      throw new Error('Provider not found');
    }

    const provider = await this.getProvider(userProvider.provider);
    await provider.authenticate(userProvider.access_token, userProvider.refresh_token);
    
    const quota = await provider.getQuota();

    await dbRun(
      'UPDATE user_storage_providers SET quota_total = ?, quota_used = ?, quota_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [quota.total, quota.used, quota.available, providerId]
    );
  }

  async getAvailableProviders(): Promise<Array<{
    provider: StorageProviderType;
    displayName: string;
    isConfigured: boolean;
    authUrl?: string;
  }>> {
    const providers: Array<{
      provider: StorageProviderType;
      displayName: string;
      isConfigured: boolean;
      authUrl?: string;
    }> = [];

    for (const [key, provider] of this.providers.entries()) {
      const providerType = key as StorageProviderType;
      
      providers.push({
        provider: providerType,
        displayName: this.getProviderDisplayName(providerType),
        isConfigured: this.isProviderConfigured(providerType),
        authUrl: this.isProviderConfigured(providerType) ? provider.getAuthUrl() : undefined,
      });
    }

    return providers;
  }

  async handleProviderCallback(
    provider: StorageProviderType,
    code: string,
    state?: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const storageProvider = await this.getProvider(provider);
    return storageProvider.handleCallback(code, state);
  }

  private getProviderDisplayName(provider: StorageProviderType): string {
    const displayNames: Record<StorageProviderType, string> = {
      local: '本地存储',
      onedrive: 'OneDrive',
      googledrive: 'Google Drive',
      dropbox: 'Dropbox',
      'aws-s3': 'Amazon S3',
      'azure-blob': 'Azure Blob Storage',
    };

    return displayNames[provider] || provider;
  }

  private isProviderConfigured(provider: StorageProviderType): boolean {
    switch (provider) {
      case 'local':
        return true;
      case 'onedrive':
        return !!(process.env.ONEDRIVE_CLIENT_ID && process.env.ONEDRIVE_CLIENT_SECRET);
      case 'googledrive':
        return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      case 'dropbox':
        return !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);
      case 'aws-s3':
        return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
      case 'azure-blob':
        return !!process.env.AZURE_STORAGE_CONNECTION_STRING;
      default:
        return false;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// 单例实例
export const storageManager = new StorageManager();
