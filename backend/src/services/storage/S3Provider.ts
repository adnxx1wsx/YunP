import AWS from 'aws-sdk';
import { StorageProvider, UploadOptions, FileMetadata, ProviderConfig } from './StorageProvider';
import { log } from '../../utils/logger';

export class S3Provider implements StorageProvider {
  private s3: AWS.S3;
  private bucket: string;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.bucket = process.env.AWS_S3_BUCKET || 'yunp-storage';

    // 配置 AWS SDK
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    });

    this.s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
    });
  }

  async uploadFile(buffer: Buffer, options: UploadOptions): Promise<FileMetadata> {
    try {
      const key = `${this.config.userId}/${Date.now()}-${options.fileName}`;
      
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: options.mimeType,
        ContentLength: buffer.length,
        Metadata: {
          originalName: options.fileName,
          uploadedBy: this.config.userId,
          uploadedAt: new Date().toISOString(),
        },
      };

      // 对于大文件使用分块上传
      if (buffer.length > 100 * 1024 * 1024) { // 100MB
        return await this.uploadLargeFile(buffer, key, options);
      }

      const result = await this.s3.upload(uploadParams).promise();

      log.storage(`File uploaded to S3: ${key}`, 's3');

      return {
        id: key,
        name: options.fileName,
        path: key,
        size: buffer.length,
        mimeType: options.mimeType,
        url: result.Location,
        provider: 's3',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error: any) {
      log.error('S3 upload failed:', error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  private async uploadLargeFile(buffer: Buffer, key: string, options: UploadOptions): Promise<FileMetadata> {
    try {
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      const chunks = Math.ceil(buffer.length / chunkSize);

      // 创建分块上传
      const createParams: AWS.S3.CreateMultipartUploadRequest = {
        Bucket: this.bucket,
        Key: key,
        ContentType: options.mimeType,
        Metadata: {
          originalName: options.fileName,
          uploadedBy: this.config.userId,
          uploadedAt: new Date().toISOString(),
        },
      };

      const createResult = await this.s3.createMultipartUpload(createParams).promise();
      const uploadId = createResult.UploadId!;

      // 上传各个分块
      const uploadPromises: Promise<AWS.S3.CompletedPart>[] = [];
      
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, buffer.length);
        const chunk = buffer.slice(start, end);

        const uploadPartParams: AWS.S3.UploadPartRequest = {
          Bucket: this.bucket,
          Key: key,
          PartNumber: i + 1,
          UploadId: uploadId,
          Body: chunk,
        };

        uploadPromises.push(
          this.s3.uploadPart(uploadPartParams).promise().then(result => ({
            ETag: result.ETag!,
            PartNumber: i + 1,
          }))
        );
      }

      const parts = await Promise.all(uploadPromises);

      // 完成分块上传
      const completeParams: AWS.S3.CompleteMultipartUploadRequest = {
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts,
        },
      };

      const result = await this.s3.completeMultipartUpload(completeParams).promise();

      log.storage(`Large file uploaded to S3: ${key}`, 's3');

      return {
        id: key,
        name: options.fileName,
        path: key,
        size: buffer.length,
        mimeType: options.mimeType,
        url: result.Location!,
        provider: 's3',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error: any) {
      log.error('S3 large file upload failed:', error);
      throw new Error(`S3 large file upload failed: ${error.message}`);
    }
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const params: AWS.S3.GetObjectRequest = {
        Bucket: this.bucket,
        Key: fileId,
      };

      const result = await this.s3.getObject(params).promise();
      
      if (!result.Body) {
        throw new Error('No file data received from S3');
      }

      return result.Body as Buffer;
    } catch (error: any) {
      log.error('S3 download failed:', error);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: this.bucket,
        Key: fileId,
      };

      await this.s3.deleteObject(params).promise();
      log.storage(`File deleted from S3: ${fileId}`, 's3');
    } catch (error: any) {
      log.error('S3 delete failed:', error);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  async getFileInfo(fileId: string): Promise<FileMetadata> {
    try {
      const params: AWS.S3.HeadObjectRequest = {
        Bucket: this.bucket,
        Key: fileId,
      };

      const result = await this.s3.headObject(params).promise();

      return {
        id: fileId,
        name: result.Metadata?.originalname || fileId.split('/').pop() || fileId,
        path: fileId,
        size: result.ContentLength || 0,
        mimeType: result.ContentType || 'application/octet-stream',
        url: await this.getDownloadUrl(fileId),
        provider: 's3',
        createdAt: result.LastModified || new Date(),
        updatedAt: result.LastModified || new Date(),
      };
    } catch (error: any) {
      log.error('S3 get file info failed:', error);
      throw new Error(`S3 get file info failed: ${error.message}`);
    }
  }

  async listFiles(prefix?: string): Promise<FileMetadata[]> {
    try {
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.bucket,
        Prefix: prefix || `${this.config.userId}/`,
        MaxKeys: 1000,
      };

      const result = await this.s3.listObjectsV2(params).promise();
      const files: FileMetadata[] = [];

      if (result.Contents) {
        for (const object of result.Contents) {
          if (object.Key && object.Size && object.Size > 0) {
            files.push({
              id: object.Key,
              name: object.Key.split('/').pop() || object.Key,
              path: object.Key,
              size: object.Size,
              mimeType: 'application/octet-stream', // S3 不返回 MIME 类型
              url: await this.getDownloadUrl(object.Key),
              provider: 's3',
              createdAt: object.LastModified || new Date(),
              updatedAt: object.LastModified || new Date(),
            });
          }
        }
      }

      return files;
    } catch (error: any) {
      log.error('S3 list files failed:', error);
      throw new Error(`S3 list files failed: ${error.message}`);
    }
  }

  async createFolder(name: string, parentId?: string): Promise<{ id: string; name: string }> {
    try {
      const folderKey = parentId ? `${parentId}${name}/` : `${this.config.userId}/${name}/`;
      
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: folderKey,
        Body: '',
        ContentType: 'application/x-directory',
      };

      await this.s3.putObject(params).promise();

      return {
        id: folderKey,
        name,
      };
    } catch (error: any) {
      log.error('S3 create folder failed:', error);
      throw new Error(`S3 create folder failed: ${error.message}`);
    }
  }

  async getQuota(): Promise<{ used: number; total: number }> {
    try {
      // S3 没有配额限制，返回使用量和一个很大的总量
      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.bucket,
        Prefix: `${this.config.userId}/`,
      };

      let totalSize = 0;
      let continuationToken: string | undefined;

      do {
        if (continuationToken) {
          params.ContinuationToken = continuationToken;
        }

        const result = await this.s3.listObjectsV2(params).promise();
        
        if (result.Contents) {
          totalSize += result.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
        }

        continuationToken = result.NextContinuationToken;
      } while (continuationToken);

      return {
        used: totalSize,
        total: Number.MAX_SAFE_INTEGER, // S3 没有硬性限制
      };
    } catch (error: any) {
      log.error('S3 get quota failed:', error);
      throw new Error(`S3 get quota failed: ${error.message}`);
    }
  }

  async getDownloadUrl(fileId: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params: AWS.S3.GetObjectRequest = {
        Bucket: this.bucket,
        Key: fileId,
      };

      return this.s3.getSignedUrl('getObject', {
        ...params,
        Expires: expiresIn,
      });
    } catch (error: any) {
      log.error('S3 get download URL failed:', error);
      throw new Error(`S3 get download URL failed: ${error.message}`);
    }
  }

  async getUploadUrl(fileName: string, mimeType: string, expiresIn: number = 3600): Promise<string> {
    try {
      const key = `${this.config.userId}/${Date.now()}-${fileName}`;
      
      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      };

      return this.s3.getSignedUrl('putObject', {
        ...params,
        Expires: expiresIn,
      });
    } catch (error: any) {
      log.error('S3 get upload URL failed:', error);
      throw new Error(`S3 get upload URL failed: ${error.message}`);
    }
  }

  // 检查存储桶是否存在
  async checkBucketExists(): Promise<boolean> {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  // 创建存储桶
  async createBucket(): Promise<void> {
    try {
      const params: AWS.S3.CreateBucketRequest = {
        Bucket: this.bucket,
        ACL: 'private',
      };

      // 如果不是 us-east-1 区域，需要指定位置约束
      const region = process.env.AWS_REGION || 'us-east-1';
      if (region !== 'us-east-1') {
        params.CreateBucketConfiguration = {
          LocationConstraint: region as AWS.S3.BucketLocationConstraint,
        };
      }

      await this.s3.createBucket(params).promise();
      log.storage(`S3 bucket created: ${this.bucket}`, 's3');
    } catch (error: any) {
      log.error('S3 create bucket failed:', error);
      throw new Error(`S3 create bucket failed: ${error.message}`);
    }
  }
}
