import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageProvider, StorageFile, StorageFolder, UploadOptions, DownloadOptions, StorageQuota } from './StorageProvider';

export class LocalStorageProvider extends StorageProvider {
  private basePath: string;

  constructor(config: Record<string, any>) {
    super(config);
    this.basePath = config.localPath || './uploads';
    this.ensureDirectoryExists(this.basePath);
  }

  async authenticate(): Promise<void> {
    // 本地存储不需要认证
    return Promise.resolve();
  }

  async refreshAccessToken(): Promise<string> {
    throw new Error('Local storage does not require access tokens');
  }

  getAuthUrl(): string {
    throw new Error('Local storage does not require authentication');
  }

  async handleCallback(): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
    throw new Error('Local storage does not require authentication');
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<StorageFile> {
    try {
      const fileId = uuidv4();
      const ext = path.extname(options.fileName);
      const fileName = `${fileId}${ext}`;
      
      let folderPath = this.basePath;
      if (options.folderId) {
        folderPath = path.join(this.basePath, options.folderId);
        await this.ensureDirectoryExists(folderPath);
      }

      const filePath = path.join(folderPath, fileName);
      
      // 检查文件是否已存在
      if (!options.overwrite) {
        try {
          await fs.access(filePath);
          throw new Error('File already exists');
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      await fs.writeFile(filePath, buffer);
      const stats = await fs.stat(filePath);

      return {
        id: fileId,
        name: fileName,
        size: stats.size,
        mimeType: options.mimeType,
        path: filePath,
        url: `/uploads/${options.folderId ? options.folderId + '/' : ''}${fileName}`,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    } catch (error) {
      this.handleError(error, 'uploadFile');
    }
  }

  async downloadFile(fileId: string, options?: DownloadOptions): Promise<Buffer> {
    try {
      const file = await this.getFile(fileId);
      const buffer = await fs.readFile(file.path);

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
    try {
      const file = await this.getFile(fileId);
      await fs.unlink(file.path);
    } catch (error) {
      this.handleError(error, 'deleteFile');
    }
  }

  async getFile(fileId: string): Promise<StorageFile> {
    try {
      // 在实际实现中，这里应该从数据库查询文件信息
      // 这里简化为从文件系统查找
      const files = await this.findFileById(fileId);
      if (!files) {
        throw new Error('File not found');
      }
      return files;
    } catch (error) {
      this.handleError(error, 'getFile');
    }
  }

  async listFiles(folderId?: string, limit = 50, offset = 0): Promise<{
    files: StorageFile[];
    folders: StorageFolder[];
    total: number;
  }> {
    try {
      const folderPath = folderId ? path.join(this.basePath, folderId) : this.basePath;
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      const files: StorageFile[] = [];
      const folders: StorageFolder[] = [];

      for (const entry of entries.slice(offset, offset + limit)) {
        const fullPath = path.join(folderPath, entry.name);
        const stats = await fs.stat(fullPath);

        if (entry.isFile()) {
          files.push({
            id: path.parse(entry.name).name,
            name: entry.name,
            size: stats.size,
            mimeType: this.getMimeTypeFromExtension(entry.name),
            path: fullPath,
            url: `/uploads/${folderId ? folderId + '/' : ''}${entry.name}`,
            createdAt: stats.birthtime,
            updatedAt: stats.mtime,
          });
        } else if (entry.isDirectory()) {
          folders.push({
            id: entry.name,
            name: entry.name,
            path: fullPath,
            parentId: folderId,
            createdAt: stats.birthtime,
            updatedAt: stats.mtime,
          });
        }
      }

      return {
        files,
        folders,
        total: entries.length,
      };
    } catch (error) {
      this.handleError(error, 'listFiles');
    }
  }

  async createFolder(name: string, parentId?: string): Promise<StorageFolder> {
    try {
      const folderId = uuidv4();
      const folderPath = parentId 
        ? path.join(this.basePath, parentId, name)
        : path.join(this.basePath, name);

      await this.ensureDirectoryExists(folderPath);
      const stats = await fs.stat(folderPath);

      return {
        id: folderId,
        name,
        path: folderPath,
        parentId,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    } catch (error) {
      this.handleError(error, 'createFolder');
    }
  }

  async deleteFolder(folderId: string): Promise<void> {
    try {
      const folderPath = path.join(this.basePath, folderId);
      await fs.rmdir(folderPath, { recursive: true });
    } catch (error) {
      this.handleError(error, 'deleteFolder');
    }
  }

  async getFolder(folderId: string): Promise<StorageFolder> {
    try {
      const folderPath = path.join(this.basePath, folderId);
      const stats = await fs.stat(folderPath);

      if (!stats.isDirectory()) {
        throw new Error('Not a directory');
      }

      return {
        id: folderId,
        name: path.basename(folderPath),
        path: folderPath,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      };
    } catch (error) {
      this.handleError(error, 'getFolder');
    }
  }

  async createShareLink(fileId: string): Promise<string> {
    // 本地存储的简单分享实现
    return `${process.env.BASE_URL || 'http://localhost:3001'}/api/files/${fileId}/download`;
  }

  async revokeShareLink(): Promise<void> {
    // 本地存储不支持撤销分享链接
    return Promise.resolve();
  }

  async searchFiles(query: string): Promise<StorageFile[]> {
    try {
      const files: StorageFile[] = [];
      await this.searchInDirectory(this.basePath, query, files);
      return files;
    } catch (error) {
      this.handleError(error, 'searchFiles');
    }
  }

  async getQuota(): Promise<StorageQuota> {
    try {
      const stats = await fs.stat(this.basePath);
      const used = await this.calculateDirectorySize(this.basePath);
      
      // 本地存储使用磁盘空间作为配额
      return {
        total: 1024 * 1024 * 1024 * 100, // 100GB 默认
        used,
        available: 1024 * 1024 * 1024 * 100 - used,
      };
    } catch (error) {
      this.handleError(error, 'getQuota');
    }
  }

  async getThumbnail(): Promise<Buffer | null> {
    // 本地存储暂不支持缩略图生成
    return null;
  }

  async getPreviewUrl(): Promise<string | null> {
    // 本地存储暂不支持预览URL
    return null;
  }

  async batchDelete(fileIds: string[]): Promise<void> {
    for (const fileId of fileIds) {
      await this.deleteFile(fileId);
    }
  }

  async batchMove(fileIds: string[], targetFolderId: string): Promise<void> {
    for (const fileId of fileIds) {
      const file = await this.getFile(fileId);
      const newPath = path.join(this.basePath, targetFolderId, path.basename(file.path));
      await fs.rename(file.path, newPath);
    }
  }

  async batchCopy(fileIds: string[], targetFolderId: string): Promise<StorageFile[]> {
    const copiedFiles: StorageFile[] = [];
    
    for (const fileId of fileIds) {
      const file = await this.getFile(fileId);
      const buffer = await fs.readFile(file.path);
      
      const copiedFile = await this.uploadFile(buffer, {
        fileName: file.name,
        mimeType: file.mimeType,
        size: file.size,
        folderId: targetFolderId,
      });
      
      copiedFiles.push(copiedFile);
    }
    
    return copiedFiles;
  }

  // 私有辅助方法
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async findFileById(fileId: string): Promise<StorageFile | null> {
    // 简化实现：在实际项目中应该从数据库查询
    try {
      const files = await this.listFiles();
      return files.files.find(f => f.id === fileId) || null;
    } catch {
      return null;
    }
  }

  private async searchInDirectory(dirPath: string, query: string, results: StorageFile[]): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isFile() && entry.name.toLowerCase().includes(query.toLowerCase())) {
        const stats = await fs.stat(fullPath);
        results.push({
          id: path.parse(entry.name).name,
          name: entry.name,
          size: stats.size,
          mimeType: this.getMimeTypeFromExtension(entry.name),
          path: fullPath,
          url: `/uploads/${entry.name}`,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        });
      } else if (entry.isDirectory()) {
        await this.searchInDirectory(fullPath, query, results);
      }
    }
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = await fs.stat(fullPath);
      
      if (entry.isFile()) {
        totalSize += stats.size;
      } else if (entry.isDirectory()) {
        totalSize += await this.calculateDirectorySize(fullPath);
      }
    }
    
    return totalSize;
  }
}
