import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import { StorageProvider, StorageFile, StorageFolder, UploadOptions, DownloadOptions, StorageQuota } from './StorageProvider';

export class GoogleDriveProvider extends StorageProvider {
  private oauth2Client: OAuth2Client;
  private drive: any;

  constructor(config: Record<string, any>) {
    super(config);
    this.oauth2Client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );
  }

  async authenticate(accessToken?: string, refreshToken?: string): Promise<void> {
    if (accessToken) {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    } else {
      throw new Error('Google Drive requires access token for authentication');
    }
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.accessToken = credentials.access_token!;
      
      if (credentials.refresh_token) {
        this.refreshToken = credentials.refresh_token;
      }

      return this.accessToken;
    } catch (error) {
      this.handleError(error, 'refreshAccessToken');
    }
  }

  getAuthUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
    });
  }

  async handleCallback(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : undefined,
      };
    } catch (error) {
      this.handleError(error, 'handleCallback');
    }
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<StorageFile> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const fileMetadata: any = {
        name: options.fileName,
      };

      if (options.folderId) {
        fileMetadata.parents = [options.folderId];
      }

      const media = {
        mimeType: options.mimeType,
        body: Readable.from(buffer),
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,size,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink,parents',
      });

      return this.mapGoogleDriveFileToStorageFile(response.data);
    } catch (error) {
      this.handleError(error, 'uploadFile');
    }
  }

  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Buffer> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media',
      }, { responseType: 'stream' });

      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.data.on('end', () => {
          const buffer = Buffer.concat(chunks);
          
          if (options?.range) {
            const { start, end } = options.range;
            resolve(buffer.subarray(start, end + 1));
          } else {
            resolve(buffer);
          }
        });

        response.data.on('error', reject);
      });
    } catch (error) {
      this.handleError(error, 'downloadFile');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      await this.drive.files.delete({ fileId });
    } catch (error) {
      this.handleError(error, 'deleteFile');
    }
  }

  async getFile(fileId: string): Promise<StorageFile> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,size,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink,parents',
      });

      return this.mapGoogleDriveFileToStorageFile(response.data);
    } catch (error) {
      this.handleError(error, 'getFile');
    }
  }

  async listFiles(folderId?: string, limit = 50, offset = 0): Promise<{
    files: StorageFile[];
    folders: StorageFolder[];
    total: number;
  }> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      let query = "trashed=false";
      
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      } else {
        query += " and 'root' in parents";
      }

      const response = await this.drive.files.list({
        q: query,
        pageSize: limit,
        fields: 'files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink,parents)',
        orderBy: 'modifiedTime desc',
      });

      const files: StorageFile[] = [];
      const folders: StorageFolder[] = [];

      for (const file of response.data.files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          folders.push(this.mapGoogleDriveFolderToStorageFolder(file));
        } else {
          files.push(this.mapGoogleDriveFileToStorageFile(file));
        }
      }

      return {
        files,
        folders,
        total: response.data.files.length,
      };
    } catch (error) {
      this.handleError(error, 'listFiles');
    }
  }

  async createFolder(name: string, parentId?: string): Promise<StorageFolder> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const fileMetadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name,createdTime,modifiedTime,parents',
      });

      return this.mapGoogleDriveFolderToStorageFolder(response.data);
    } catch (error) {
      this.handleError(error, 'createFolder');
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      await this.drive.files.delete({ fileId: folderId });
    } catch (error) {
      this.handleError(error, 'deleteFolder');
    }
  }

  async getFolder(folderId: string): Promise<StorageFolder> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: 'id,name,createdTime,modifiedTime,parents',
      });

      return this.mapGoogleDriveFolderToStorageFolder(response.data);
    } catch (error) {
      this.handleError(error, 'getFolder');
    }
  }

  async createShareLink(fileId: string, options?: {
    expiresAt?: Date;
    password?: string;
    allowEdit?: boolean;
  }): Promise<string> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const permission = {
        role: options?.allowEdit ? 'writer' : 'reader',
        type: 'anyone',
      };

      await this.drive.permissions.create({
        fileId,
        resource: permission,
      });

      const file = await this.drive.files.get({
        fileId,
        fields: 'webViewLink',
      });

      return file.data.webViewLink;
    } catch (error) {
      this.handleError(error, 'createShareLink');
    }
  }

  async revokeShareLink(fileId: string, shareId: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      await this.drive.permissions.delete({
        fileId,
        permissionId: shareId,
      });
    } catch (error) {
      this.handleError(error, 'revokeShareLink');
    }
  }

  async searchFiles(query: string, options?: {
    folderId?: string;
    mimeType?: string;
    limit?: number;
  }): Promise<StorageFile[]> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      let searchQuery = `name contains '${query}' and trashed=false`;
      
      if (options?.folderId) {
        searchQuery += ` and '${options.folderId}' in parents`;
      }
      
      if (options?.mimeType) {
        searchQuery += ` and mimeType='${options.mimeType}'`;
      }

      const response = await this.drive.files.list({
        q: searchQuery,
        pageSize: options?.limit || 50,
        fields: 'files(id,name,size,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink,parents)',
      });

      const files: StorageFile[] = [];
      for (const file of response.data.files) {
        if (file.mimeType !== 'application/vnd.google-apps.folder') {
          files.push(this.mapGoogleDriveFileToStorageFile(file));
        }
      }

      return files;
    } catch (error) {
      this.handleError(error, 'searchFiles');
    }
  }

  async getQuota(): Promise<StorageQuota> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota',
      });

      const quota = response.data.storageQuota;
      const total = parseInt(quota.limit);
      const used = parseInt(quota.usage);

      return {
        total,
        used,
        available: total - used,
      };
    } catch (error) {
      this.handleError(error, 'getQuota');
    }
  }

  async getThumbnail(fileId: string, size = 300): Promise<Buffer | null> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const file = await this.drive.files.get({
        fileId,
        fields: 'thumbnailLink',
      });

      if (file.data.thumbnailLink) {
        const thumbnailUrl = file.data.thumbnailLink.replace('=s220', `=s${size}`);
        const response = await fetch(thumbnailUrl, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });

        if (response.ok) {
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
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    try {
      const file = await this.drive.files.get({
        fileId,
        fields: 'webViewLink',
      });

      return file.data.webViewLink || null;
    } catch (error) {
      console.warn('Failed to get preview URL:', error);
      return null;
    }
  }

  async batchDelete(fileIds: string[]): Promise<void> {
    // Google Drive 不支持批量删除，逐个删除
    for (const fileId of fileIds) {
      await this.deleteFile(fileId);
    }
  }

  async batchMove(fileIds: string[], targetFolderId: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    for (const fileId of fileIds) {
      try {
        // 获取当前父文件夹
        const file = await this.drive.files.get({
          fileId,
          fields: 'parents',
        });

        const previousParents = file.data.parents.join(',');

        // 移动文件
        await this.drive.files.update({
          fileId,
          addParents: targetFolderId,
          removeParents: previousParents,
        });
      } catch (error) {
        console.warn(`Failed to move file ${fileId}:`, error);
      }
    }
  }

  async batchCopy(fileIds: string[], targetFolderId: string): Promise<StorageFile[]> {
    if (!this.drive) {
      throw new Error('Google Drive client not initialized');
    }

    const copiedFiles: StorageFile[] = [];

    for (const fileId of fileIds) {
      try {
        const response = await this.drive.files.copy({
          fileId,
          resource: {
            parents: [targetFolderId],
          },
          fields: 'id,name,size,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink,parents',
        });

        copiedFiles.push(this.mapGoogleDriveFileToStorageFile(response.data));
      } catch (error) {
        console.warn(`Failed to copy file ${fileId}:`, error);
      }
    }

    return copiedFiles;
  }

  // 私有辅助方法
  private mapGoogleDriveFileToStorageFile(file: any): StorageFile {
    return {
      id: file.id,
      name: file.name,
      size: parseInt(file.size) || 0,
      mimeType: file.mimeType,
      path: file.webViewLink,
      url: file.webViewLink,
      thumbnailUrl: file.thumbnailLink,
      createdAt: new Date(file.createdTime),
      updatedAt: new Date(file.modifiedTime),
    };
  }

  private mapGoogleDriveFolderToStorageFolder(folder: any): StorageFolder {
    return {
      id: folder.id,
      name: folder.name,
      path: folder.webViewLink || '',
      parentId: folder.parents?.[0],
      createdAt: new Date(folder.createdTime),
      updatedAt: new Date(folder.modifiedTime),
    };
  }
}
