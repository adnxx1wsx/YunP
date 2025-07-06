import { BlobServiceClient, BlockBlobClient, ContainerClient } from '@azure/storage-blob';
import { StorageProvider, UploadOptions, FileMetadata, ProviderConfig } from './StorageProvider';
import { log } from '../../utils/logger';

export class AzureBlobProvider implements StorageProvider {
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private containerName: string;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER || 'yunp-storage';

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('Azure Storage connection string not configured');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<FileMetadata> {
    try {
      const blobName = `${this.config.userId}/${Date.now()}-${options.fileName}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      // 设置 blob 属性和元数据
      const blobOptions = {
        blobHTTPHeaders: {
          blobContentType: options.mimeType,
        },
        metadata: {
          originalName: options.fileName,
          uploadedBy: this.config.userId,
          uploadedAt: new Date().toISOString(),
        },
      };

      // 对于大文件使用分块上传
      if (buffer.length > 100 * 1024 * 1024) { // 100MB
        await this.uploadLargeFile(blockBlobClient, buffer, blobOptions);
      } else {
        await blockBlobClient.upload(buffer, buffer.length, blobOptions);
      }

      log.storage(`File uploaded to Azure Blob: ${blobName}`, 'azure-blob');

      return {
        id: blobName,
        name: options.fileName,
        path: blobName,
        size: buffer.length,
        mimeType: options.mimeType,
        url: blockBlobClient.url,
        provider: 'azure-blob',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error: any) {
      log.error('Azure Blob upload failed:', error);
      throw new Error(`Azure Blob upload failed: ${error.message}`);
    }
  }

  private async uploadLargeFile(
    blockBlobClient: BlockBlobClient,
    buffer: Buffer,
    options: any
  ): Promise<void> {
    const chunkSize = 4 * 1024 * 1024; // 4MB chunks
    const blockIds: string[] = [];

    try {
      // 分块上传
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const blockId = Buffer.from(`block-${i.toString().padStart(10, '0')}`).toString('base64');
        const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
        
        await blockBlobClient.stageBlock(blockId, chunk, chunk.length);
        blockIds.push(blockId);
      }

      // 提交所有块
      await blockBlobClient.commitBlockList(blockIds, options);
      
      log.storage(`Large file uploaded to Azure Blob: ${blockBlobClient.name}`, 'azure-blob');
    } catch (error: any) {
      log.error('Azure Blob large file upload failed:', error);
      throw new Error(`Azure Blob large file upload failed: ${error.message}`);
    }
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileId);
      const downloadResponse = await blockBlobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('No file data received from Azure Blob');
      }

      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        downloadResponse.readableStreamBody!.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        downloadResponse.readableStreamBody!.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        
        downloadResponse.readableStreamBody!.on('error', reject);
      });
    } catch (error: any) {
      log.error('Azure Blob download failed:', error);
      throw new Error(`Azure Blob download failed: ${error.message}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileId);
      await blockBlobClient.delete();
      log.storage(`File deleted from Azure Blob: ${fileId}`, 'azure-blob');
    } catch (error: any) {
      log.error('Azure Blob delete failed:', error);
      throw new Error(`Azure Blob delete failed: ${error.message}`);
    }
  }

  async getFileInfo(fileId: string): Promise<FileMetadata> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileId);
      const properties = await blockBlobClient.getProperties();

      return {
        id: fileId,
        name: properties.metadata?.originalname || fileId.split('/').pop() || fileId,
        path: fileId,
        size: properties.contentLength || 0,
        mimeType: properties.contentType || 'application/octet-stream',
        url: blockBlobClient.url,
        provider: 'azure-blob',
        createdAt: properties.createdOn || new Date(),
        updatedAt: properties.lastModified || new Date(),
      };
    } catch (error: any) {
      log.error('Azure Blob get file info failed:', error);
      throw new Error(`Azure Blob get file info failed: ${error.message}`);
    }
  }

  async listFiles(prefix?: string): Promise<FileMetadata[]> {
    try {
      const listPrefix = prefix || `${this.config.userId}/`;
      const files: FileMetadata[] = [];

      for await (const blob of this.containerClient.listBlobsFlat({
        prefix: listPrefix,
      })) {
        if (blob.name && blob.properties.contentLength && blob.properties.contentLength > 0) {
          files.push({
            id: blob.name,
            name: blob.name.split('/').pop() || blob.name,
            path: blob.name,
            size: blob.properties.contentLength,
            mimeType: blob.properties.contentType || 'application/octet-stream',
            url: this.containerClient.getBlockBlobClient(blob.name).url,
            provider: 'azure-blob',
            createdOn: blob.properties.createdOn || new Date(),
            updatedAt: blob.properties.lastModified || new Date(),
          });
        }
      }

      return files;
    } catch (error: any) {
      log.error('Azure Blob list files failed:', error);
      throw new Error(`Azure Blob list files failed: ${error.message}`);
    }
  }

  async createFolder(name: string, parentId?: string): Promise<{ id: string; name: string }> {
    try {
      // Azure Blob Storage 使用虚拟文件夹（通过 blob 名称中的斜杠）
      const folderPath = parentId ? `${parentId}${name}/` : `${this.config.userId}/${name}/`;
      const placeholderName = `${folderPath}.placeholder`;
      
      const blockBlobClient = this.containerClient.getBlockBlobClient(placeholderName);
      
      // 创建一个空的占位符文件来表示文件夹
      await blockBlobClient.upload('', 0, {
        metadata: {
          isFolder: 'true',
          folderName: name,
        },
      });

      return {
        id: folderPath,
        name,
      };
    } catch (error: any) {
      log.error('Azure Blob create folder failed:', error);
      throw new Error(`Azure Blob create folder failed: ${error.message}`);
    }
  }

  async getQuota(): Promise<{ used: number; total: number }> {
    try {
      let totalSize = 0;
      
      for await (const blob of this.containerClient.listBlobsFlat({
        prefix: `${this.config.userId}/`,
      })) {
        totalSize += blob.properties.contentLength || 0;
      }

      return {
        used: totalSize,
        total: Number.MAX_SAFE_INTEGER, // Azure Blob Storage 没有硬性限制
      };
    } catch (error: any) {
      log.error('Azure Blob get quota failed:', error);
      throw new Error(`Azure Blob get quota failed: ${error.message}`);
    }
  }

  async getDownloadUrl(fileId: string, expiresIn: number = 3600): Promise<string> {
    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(fileId);
      
      // 生成 SAS URL
      const sasUrl = await blockBlobClient.generateSasUrl({
        permissions: 'r', // 只读权限
        expiresOn: new Date(Date.now() + expiresIn * 1000),
      });

      return sasUrl;
    } catch (error: any) {
      log.error('Azure Blob get download URL failed:', error);
      throw new Error(`Azure Blob get download URL failed: ${error.message}`);
    }
  }

  async getUploadUrl(fileName: string, mimeType: string, expiresIn: number = 3600): Promise<string> {
    try {
      const blobName = `${this.config.userId}/${Date.now()}-${fileName}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      
      // 生成上传 SAS URL
      const sasUrl = await blockBlobClient.generateSasUrl({
        permissions: 'w', // 写权限
        expiresOn: new Date(Date.now() + expiresIn * 1000),
      });

      return sasUrl;
    } catch (error: any) {
      log.error('Azure Blob get upload URL failed:', error);
      throw new Error(`Azure Blob get upload URL failed: ${error.message}`);
    }
  }

  // 检查容器是否存在
  async checkContainerExists(): Promise<boolean> {
    try {
      await this.containerClient.getProperties();
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  // 创建容器
  async createContainer(): Promise<void> {
    try {
      await this.containerClient.create({
        access: 'private',
      });
      log.storage(`Azure Blob container created: ${this.containerName}`, 'azure-blob');
    } catch (error: any) {
      if (error.statusCode === 409) {
        // 容器已存在
        log.info(`Azure Blob container already exists: ${this.containerName}`);
        return;
      }
      log.error('Azure Blob create container failed:', error);
      throw new Error(`Azure Blob create container failed: ${error.message}`);
    }
  }

  // 设置容器 CORS 规则
  async setCorsRules(): Promise<void> {
    try {
      const serviceProperties = await this.blobServiceClient.getProperties();
      
      serviceProperties.cors = [
        {
          allowedOrigins: ['*'],
          allowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
          allowedHeaders: ['*'],
          exposedHeaders: ['*'],
          maxAgeInSeconds: 3600,
        },
      ];

      await this.blobServiceClient.setProperties(serviceProperties);
      log.storage('Azure Blob CORS rules set', 'azure-blob');
    } catch (error: any) {
      log.error('Azure Blob set CORS rules failed:', error);
      throw new Error(`Azure Blob set CORS rules failed: ${error.message}`);
    }
  }
}
