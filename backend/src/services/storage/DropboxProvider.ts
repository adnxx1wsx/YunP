import { Dropbox } from 'dropbox';
import { StorageProvider, UploadOptions, FileMetadata, ProviderConfig } from './StorageProvider';
import { log } from '../../utils/logger';

export class DropboxProvider implements StorageProvider {
  private client: Dropbox;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Dropbox({
      accessToken: config.accessToken,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
    });
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<FileMetadata> {
    try {
      const path = `/${options.fileName}`;
      
      // 对于大文件使用分块上传
      if (buffer.length > 150 * 1024 * 1024) { // 150MB
        return await this.uploadLargeFile(buffer, path, options);
      }

      const response = await this.client.filesUpload({
        path,
        contents: buffer,
        mode: 'add',
        autorename: true,
      });

      log.storage(`File uploaded to Dropbox: ${response.result.name}`, 'dropbox');

      return {
        id: response.result.id,
        name: response.result.name,
        path: response.result.path_display || path,
        size: response.result.size || buffer.length,
        mimeType: options.mimeType,
        url: await this.getDownloadUrl(response.result.id),
        provider: 'dropbox',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error: any) {
      log.error('Dropbox upload failed:', error);
      throw new Error(`Dropbox upload failed: ${error.message}`);
    }
  }

  private async uploadLargeFile(buffer: Buffer, path: string, options: UploadOptions): Promise<FileMetadata> {
    const chunkSize = 8 * 1024 * 1024; // 8MB chunks
    let offset = 0;
    let sessionId: string | undefined;

    try {
      // 开始上传会话
      const startResponse = await this.client.filesUploadSessionStart({
        contents: buffer.slice(0, Math.min(chunkSize, buffer.length)),
        close: false,
      });

      sessionId = startResponse.result.session_id;
      offset = Math.min(chunkSize, buffer.length);

      // 上传剩余的块
      while (offset < buffer.length) {
        const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.length));
        const isLastChunk = offset + chunk.length >= buffer.length;

        if (isLastChunk) {
          // 完成上传
          const finishResponse = await this.client.filesUploadSessionFinish({
            cursor: {
              session_id: sessionId,
              offset,
            },
            commit: {
              path,
              mode: 'add',
              autorename: true,
            },
            contents: chunk,
          });

          log.storage(`Large file uploaded to Dropbox: ${finishResponse.result.name}`, 'dropbox');

          return {
            id: finishResponse.result.id,
            name: finishResponse.result.name,
            path: finishResponse.result.path_display || path,
            size: finishResponse.result.size || buffer.length,
            mimeType: options.mimeType,
            url: await this.getDownloadUrl(finishResponse.result.id),
            provider: 'dropbox',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        } else {
          // 追加块
          await this.client.filesUploadSessionAppendV2({
            cursor: {
              session_id: sessionId,
              offset,
            },
            contents: chunk,
            close: false,
          });
        }

        offset += chunk.length;
      }

      throw new Error('Upload session completed unexpectedly');
    } catch (error: any) {
      log.error('Dropbox large file upload failed:', error);
      throw new Error(`Dropbox large file upload failed: ${error.message}`);
    }
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.client.filesDownload({ path: fileId });
      
      if (response.result && 'fileBinary' in response.result) {
        return Buffer.from(response.result.fileBinary as any);
      }
      
      throw new Error('No file data received from Dropbox');
    } catch (error: any) {
      log.error('Dropbox download failed:', error);
      throw new Error(`Dropbox download failed: ${error.message}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.client.filesDeleteV2({ path: fileId });
      log.storage(`File deleted from Dropbox: ${fileId}`, 'dropbox');
    } catch (error: any) {
      log.error('Dropbox delete failed:', error);
      throw new Error(`Dropbox delete failed: ${error.message}`);
    }
  }

  async getFileInfo(fileId: string): Promise<FileMetadata> {
    try {
      const response = await this.client.filesGetMetadata({ path: fileId });
      const metadata = response.result;

      if (metadata['.tag'] !== 'file') {
        throw new Error('Path does not point to a file');
      }

      const fileMetadata = metadata as any;

      return {
        id: fileMetadata.id,
        name: fileMetadata.name,
        path: fileMetadata.path_display,
        size: fileMetadata.size,
        mimeType: this.getMimeTypeFromExtension(fileMetadata.name),
        url: await this.getDownloadUrl(fileMetadata.id),
        provider: 'dropbox',
        createdAt: new Date(fileMetadata.client_modified),
        updatedAt: new Date(fileMetadata.server_modified),
      };
    } catch (error: any) {
      log.error('Dropbox get file info failed:', error);
      throw new Error(`Dropbox get file info failed: ${error.message}`);
    }
  }

  async listFiles(folderId?: string): Promise<FileMetadata[]> {
    try {
      const path = folderId || '';
      const response = await this.client.filesListFolder({ path });
      
      const files: FileMetadata[] = [];
      
      for (const entry of response.result.entries) {
        if (entry['.tag'] === 'file') {
          const fileEntry = entry as any;
          files.push({
            id: fileEntry.id,
            name: fileEntry.name,
            path: fileEntry.path_display,
            size: fileEntry.size,
            mimeType: this.getMimeTypeFromExtension(fileEntry.name),
            url: await this.getDownloadUrl(fileEntry.id),
            provider: 'dropbox',
            createdAt: new Date(fileEntry.client_modified),
            updatedAt: new Date(fileEntry.server_modified),
          });
        }
      }

      return files;
    } catch (error: any) {
      log.error('Dropbox list files failed:', error);
      throw new Error(`Dropbox list files failed: ${error.message}`);
    }
  }

  async createFolder(name: string, parentId?: string): Promise<{ id: string; name: string }> {
    try {
      const path = parentId ? `${parentId}/${name}` : `/${name}`;
      const response = await this.client.filesCreateFolderV2({ path });
      
      return {
        id: response.result.metadata.id,
        name: response.result.metadata.name,
      };
    } catch (error: any) {
      log.error('Dropbox create folder failed:', error);
      throw new Error(`Dropbox create folder failed: ${error.message}`);
    }
  }

  async getQuota(): Promise<{ used: number; total: number }> {
    try {
      const response = await this.client.usersGetSpaceUsage();
      const usage = response.result;
      
      return {
        used: usage.used,
        total: usage.allocation['.tag'] === 'individual' 
          ? (usage.allocation as any).allocated 
          : 0,
      };
    } catch (error: any) {
      log.error('Dropbox get quota failed:', error);
      throw new Error(`Dropbox get quota failed: ${error.message}`);
    }
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    try {
      const response = await this.client.filesGetTemporaryLink({ path: fileId });
      return response.result.link;
    } catch (error: any) {
      log.error('Dropbox get download URL failed:', error);
      throw new Error(`Dropbox get download URL failed: ${error.message}`);
    }
  }

  async getUploadUrl(): Promise<string> {
    // Dropbox 不支持预签名上传 URL，直接返回 API 端点
    return 'https://content.dropboxapi.com/2/files/upload';
  }

  private getMimeTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
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

  // 静态方法：获取授权 URL
  static getAuthUrl(redirectUri: string): string {
    const clientId = process.env.DROPBOX_APP_KEY;
    if (!clientId) {
      throw new Error('Dropbox App Key not configured');
    }

    const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('token_access_type', 'offline');

    return authUrl.toString();
  }

  // 静态方法：交换授权码获取访问令牌
  static async exchangeCodeForToken(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const clientId = process.env.DROPBOX_APP_KEY;
    const clientSecret = process.env.DROPBOX_APP_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Dropbox credentials not configured');
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error: any) {
      log.error('Dropbox token exchange failed:', error);
      throw new Error(`Dropbox token exchange failed: ${error.message}`);
    }
  }

  // 静态方法：刷新访问令牌
  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const clientId = process.env.DROPBOX_APP_KEY;
    const clientSecret = process.env.DROPBOX_APP_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Dropbox credentials not configured');
    }

    try {
      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      };
    } catch (error: any) {
      log.error('Dropbox token refresh failed:', error);
      throw new Error(`Dropbox token refresh failed: ${error.message}`);
    }
  }
}
