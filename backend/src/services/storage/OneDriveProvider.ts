import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import fetch from 'isomorphic-fetch';
import { StorageProvider, StorageFile, StorageFolder, UploadOptions, DownloadOptions, StorageQuota } from './StorageProvider';

class OneDriveAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }

  updateAccessToken(token: string): void {
    this.accessToken = token;
  }
}

export class OneDriveProvider extends StorageProvider {
  private client: Client | null = null;
  private authProvider: OneDriveAuthProvider | null = null;

  constructor(config: Record<string, any>) {
    super(config);
  }

  async authenticate(accessToken?: string, refreshToken?: string): Promise<void> {
    if (accessToken) {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.authProvider = new OneDriveAuthProvider(accessToken);
      this.client = Client.initWithMiddleware({ authProvider: this.authProvider });
    } else {
      throw new Error('OneDrive requires access token for authentication');
    }
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/Files.ReadWrite.All offline_access',
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error_description || 'Failed to refresh token');
      }

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || this.refreshToken;
      
      if (this.authProvider) {
        this.authProvider.updateAccessToken(this.accessToken);
      }

      return this.accessToken;
    } catch (error) {
      this.handleError(error, 'refreshAccessToken');
    }
  }

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: 'https://graph.microsoft.com/Files.ReadWrite.All offline_access',
      response_mode: 'query',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error_description || 'Failed to exchange code for token');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      this.handleError(error, 'handleCallback');
    }
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<StorageFile> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const uploadPath = options.folderId 
        ? `/me/drive/items/${options.folderId}:/${options.fileName}:/content`
        : `/me/drive/root:/${options.fileName}:/content`;

      const uploadedFile = await this.client
        .api(uploadPath)
        .put(buffer);

      return this.mapOneDriveItemToStorageFile(uploadedFile);
    } catch (error) {
      this.handleError(error, 'uploadFile');
    }
  }

  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Buffer> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const downloadUrl = await this.client
        .api(`/me/drive/items/${fileId}`)
        .select('@microsoft.graph.downloadUrl')
        .get();

      const response = await fetch(downloadUrl['@microsoft.graph.downloadUrl']);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (options?.range) {
        const { start, end } = options.range;
        return buffer.subarray(start, end + 1);
      }

      return buffer;
    } catch (error) {
      this.handleError(error, 'downloadFile');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      await this.client.api(`/me/drive/items/${fileId}`).delete();
    } catch (error) {
      this.handleError(error, 'deleteFile');
    }
  }

  async getFile(fileId: string): Promise<StorageFile> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const file = await this.client.api(`/me/drive/items/${fileId}`).get();
      return this.mapOneDriveItemToStorageFile(file);
    } catch (error) {
      this.handleError(error, 'getFile');
    }
  }

  async listFiles(folderId?: string, limit = 50, offset = 0): Promise<{
    files: StorageFile[];
    folders: StorageFolder[];
    total: number;
  }> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const endpoint = folderId 
        ? `/me/drive/items/${folderId}/children`
        : '/me/drive/root/children';

      const response = await this.client
        .api(endpoint)
        .top(limit)
        .skip(offset)
        .get();

      const files: StorageFile[] = [];
      const folders: StorageFolder[] = [];

      for (const item of response.value) {
        if (item.file) {
          files.push(this.mapOneDriveItemToStorageFile(item));
        } else if (item.folder) {
          folders.push(this.mapOneDriveItemToStorageFolder(item));
        }
      }

      return {
        files,
        folders,
        total: response.value.length,
      };
    } catch (error) {
      this.handleError(error, 'listFiles');
    }
  }

  async createFolder(name: string, parentId?: string): Promise<StorageFolder> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const endpoint = parentId 
        ? `/me/drive/items/${parentId}/children`
        : '/me/drive/root/children';

      const folder = await this.client
        .api(endpoint)
        .post({
          name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        });

      return this.mapOneDriveItemToStorageFolder(folder);
    } catch (error) {
      this.handleError(error, 'createFolder');
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      await this.client.api(`/me/drive/items/${folderId}`).delete();
    } catch (error) {
      this.handleError(error, 'deleteFolder');
    }
  }

  async getFolder(folderId: string): Promise<StorageFolder> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const folder = await this.client.api(`/me/drive/items/${folderId}`).get();
      return this.mapOneDriveItemToStorageFolder(folder);
    } catch (error) {
      this.handleError(error, 'getFolder');
    }
  }

  async createShareLink(fileId: string, options?: {
    expiresAt?: Date;
    password?: string;
    allowEdit?: boolean;
  }): Promise<string> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const shareRequest: any = {
        type: options?.allowEdit ? 'edit' : 'view',
        scope: 'anonymous'
      };

      if (options?.expiresAt) {
        shareRequest.expirationDateTime = options.expiresAt.toISOString();
      }

      if (options?.password) {
        shareRequest.password = options.password;
      }

      const permission = await this.client
        .api(`/me/drive/items/${fileId}/createLink`)
        .post(shareRequest);

      return permission.link.webUrl;
    } catch (error) {
      this.handleError(error, 'createShareLink');
    }
  }

  async revokeShareLink(fileId: string, shareId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      await this.client.api(`/me/drive/items/${fileId}/permissions/${shareId}`).delete();
    } catch (error) {
      this.handleError(error, 'revokeShareLink');
    }
  }

  async searchFiles(query: string, options?: {
    folderId?: string;
    mimeType?: string;
    limit?: number;
  }): Promise<StorageFile[]> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const searchQuery = encodeURIComponent(query);
      const response = await this.client
        .api(`/me/drive/root/search(q='${searchQuery}')`)
        .top(options?.limit || 50)
        .get();

      const files: StorageFile[] = [];
      for (const item of response.value) {
        if (item.file) {
          files.push(this.mapOneDriveItemToStorageFile(item));
        }
      }

      return files;
    } catch (error) {
      this.handleError(error, 'searchFiles');
    }
  }

  async getQuota(): Promise<StorageQuota> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const drive = await this.client.api('/me/drive').get();
      const quota = drive.quota;

      return {
        total: quota.total,
        used: quota.used,
        available: quota.remaining,
      };
    } catch (error) {
      this.handleError(error, 'getQuota');
    }
  }

  async getThumbnail(fileId: string, size = 300): Promise<Buffer | null> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const thumbnails = await this.client
        .api(`/me/drive/items/${fileId}/thumbnails`)
        .get();

      if (thumbnails.value && thumbnails.value.length > 0) {
        const thumbnail = thumbnails.value[0];
        const thumbnailUrl = size <= 150 ? thumbnail.small?.url : 
                           size <= 300 ? thumbnail.medium?.url : 
                           thumbnail.large?.url;

        if (thumbnailUrl) {
          const response = await fetch(thumbnailUrl);
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to get thumbnail:', error);
      return null;
    }
  }

  async getPreviewUrl(fileId: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    try {
      const preview = await this.client
        .api(`/me/drive/items/${fileId}/preview`)
        .post({});

      return preview.getUrl || null;
    } catch (error) {
      console.warn('Failed to get preview URL:', error);
      return null;
    }
  }

  async batchDelete(fileIds: string[]): Promise<void> {
    // OneDrive 不支持批量删除，逐个删除
    for (const fileId of fileIds) {
      await this.deleteFile(fileId);
    }
  }

  async batchMove(fileIds: string[], targetFolderId: string): Promise<void> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    for (const fileId of fileIds) {
      try {
        await this.client
          .api(`/me/drive/items/${fileId}`)
          .patch({
            parentReference: {
              id: targetFolderId
            }
          });
      } catch (error) {
        console.warn(`Failed to move file ${fileId}:`, error);
      }
    }
  }

  async batchCopy(fileIds: string[], targetFolderId: string): Promise<StorageFile[]> {
    if (!this.client) {
      throw new Error('OneDrive client not initialized');
    }

    const copiedFiles: StorageFile[] = [];

    for (const fileId of fileIds) {
      try {
        const copiedFile = await this.client
          .api(`/me/drive/items/${fileId}/copy`)
          .post({
            parentReference: {
              id: targetFolderId
            }
          });

        copiedFiles.push(this.mapOneDriveItemToStorageFile(copiedFile));
      } catch (error) {
        console.warn(`Failed to copy file ${fileId}:`, error);
      }
    }

    return copiedFiles;
  }

  // 私有辅助方法
  private mapOneDriveItemToStorageFile(item: any): StorageFile {
    return {
      id: item.id,
      name: item.name,
      size: item.size,
      mimeType: item.file?.mimeType || 'application/octet-stream',
      path: item.webUrl,
      url: item.webUrl,
      thumbnailUrl: item.thumbnails?.[0]?.medium?.url,
      createdAt: new Date(item.createdDateTime),
      updatedAt: new Date(item.lastModifiedDateTime),
    };
  }

  private mapOneDriveItemToStorageFolder(item: any): StorageFolder {
    return {
      id: item.id,
      name: item.name,
      path: item.webUrl,
      parentId: item.parentReference?.id,
      createdAt: new Date(item.createdDateTime),
      updatedAt: new Date(item.lastModifiedDateTime),
    };
  }
}
