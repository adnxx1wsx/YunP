import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { log } from '../utils/logger';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cache';

// 设置 FFmpeg 路径
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface VideoPreviewOptions {
  duration?: number;
  width?: number;
  height?: number;
  quality?: string;
}

export interface FileMetadata {
  size: number;
  mimeType: string;
  dimensions?: {
    width: number;
    height: number;
  };
  duration?: number;
  bitrate?: number;
  codec?: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
}

export class FileProcessor {
  private thumbnailDir: string;
  private previewDir: string;

  constructor() {
    this.thumbnailDir = process.env.THUMBNAIL_DIR || './uploads/thumbnails';
    this.previewDir = process.env.PREVIEW_DIR || './uploads/previews';
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.thumbnailDir, { recursive: true });
      await fs.mkdir(this.previewDir, { recursive: true });
    } catch (error) {
      log.error('Failed to create directories:', error);
    }
  }

  // 生成图片缩略图
  async generateImageThumbnail(
    inputPath: string,
    outputPath: string,
    options: ThumbnailOptions = {}
  ): Promise<void> {
    const {
      width = 300,
      height = 300,
      quality = 80,
      format = 'jpeg'
    } = options;

    try {
      await sharp(inputPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality })
        .toFile(outputPath);

      log.file(`Generated image thumbnail: ${outputPath}`);
    } catch (error) {
      log.error(`Failed to generate image thumbnail: ${error}`);
      throw error;
    }
  }

  // 生成视频缩略图
  async generateVideoThumbnail(
    inputPath: string,
    outputPath: string,
    options: ThumbnailOptions = {}
  ): Promise<void> {
    const {
      width = 300,
      height = 300
    } = options;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          count: 1,
          folder: path.dirname(outputPath),
          filename: path.basename(outputPath),
          size: `${width}x${height}`
        })
        .on('end', () => {
          log.file(`Generated video thumbnail: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          log.error(`Failed to generate video thumbnail: ${error}`);
          reject(error);
        });
    });
  }

  // 生成视频预览
  async generateVideoPreview(
    inputPath: string,
    outputPath: string,
    options: VideoPreviewOptions = {}
  ): Promise<void> {
    const {
      duration = 10,
      width = 640,
      height = 360,
      quality = 'medium'
    } = options;

    const qualitySettings = {
      low: { videoBitrate: '500k', audioBitrate: '64k' },
      medium: { videoBitrate: '1000k', audioBitrate: '128k' },
      high: { videoBitrate: '2000k', audioBitrate: '192k' }
    };

    const settings = qualitySettings[quality as keyof typeof qualitySettings] || qualitySettings.medium;

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .duration(duration)
        .size(`${width}x${height}`)
        .videoBitrate(settings.videoBitrate)
        .audioBitrate(settings.audioBitrate)
        .format('mp4')
        .output(outputPath)
        .on('end', () => {
          log.file(`Generated video preview: ${outputPath}`);
          resolve();
        })
        .on('error', (error) => {
          log.error(`Failed to generate video preview: ${error}`);
          reject(error);
        })
        .run();
    });
  }

  // 获取文件元数据
  async getFileMetadata(filePath: string, mimeType: string): Promise<FileMetadata> {
    const cacheKey = cache.generateKey(CACHE_KEYS.FILE, 'metadata', filePath);
    
    return cache.remember(cacheKey, async () => {
      const stats = await fs.stat(filePath);
      const metadata: FileMetadata = {
        size: stats.size,
        mimeType
      };

      try {
        if (mimeType.startsWith('image/')) {
          const imageMetadata = await sharp(filePath).metadata();
          metadata.dimensions = {
            width: imageMetadata.width || 0,
            height: imageMetadata.height || 0
          };
        } else if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
          const mediaMetadata = await this.getMediaMetadata(filePath);
          metadata.duration = mediaMetadata.duration;
          metadata.bitrate = mediaMetadata.bitrate;
          metadata.codec = mediaMetadata.codec;
          metadata.hasAudio = mediaMetadata.hasAudio;
          metadata.hasVideo = mediaMetadata.hasVideo;
          
          if (mediaMetadata.dimensions) {
            metadata.dimensions = mediaMetadata.dimensions;
          }
        }
      } catch (error) {
        log.warn(`Failed to get detailed metadata for ${filePath}:`, error);
      }

      return metadata;
    }, CACHE_TTL.LONG);
  }

  // 获取媒体文件元数据
  private async getMediaMetadata(filePath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          codec: videoStream?.codec_name || audioStream?.codec_name,
          hasAudio: !!audioStream,
          hasVideo: !!videoStream,
          dimensions: videoStream ? {
            width: videoStream.width,
            height: videoStream.height
          } : undefined
        });
      });
    });
  }

  // 处理文件（生成缩略图和预览）
  async processFile(
    fileId: string,
    filePath: string,
    mimeType: string
  ): Promise<{
    thumbnailPath?: string;
    previewPath?: string;
    metadata: FileMetadata;
  }> {
    const metadata = await this.getFileMetadata(filePath, mimeType);
    const result: any = { metadata };

    try {
      // 生成缩略图
      if (this.shouldGenerateThumbnail(mimeType)) {
        const thumbnailPath = path.join(this.thumbnailDir, `${fileId}.jpg`);
        
        if (mimeType.startsWith('image/')) {
          await this.generateImageThumbnail(filePath, thumbnailPath);
        } else if (mimeType.startsWith('video/')) {
          await this.generateVideoThumbnail(filePath, thumbnailPath);
        }
        
        result.thumbnailPath = thumbnailPath;
      }

      // 生成视频预览
      if (mimeType.startsWith('video/') && this.shouldGeneratePreview(metadata)) {
        const previewPath = path.join(this.previewDir, `${fileId}.mp4`);
        await this.generateVideoPreview(filePath, previewPath);
        result.previewPath = previewPath;
      }
    } catch (error) {
      log.error(`Failed to process file ${fileId}:`, error);
      // 不抛出错误，允许文件上传继续
    }

    return result;
  }

  // 判断是否应该生成缩略图
  private shouldGenerateThumbnail(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/wmv',
      'video/flv',
      'video/webm'
    ];

    return supportedTypes.includes(mimeType);
  }

  // 判断是否应该生成预览
  private shouldGeneratePreview(metadata: FileMetadata): boolean {
    // 只为较大的视频文件生成预览
    const minSize = 10 * 1024 * 1024; // 10MB
    const maxSize = 500 * 1024 * 1024; // 500MB
    
    return metadata.size >= minSize && metadata.size <= maxSize;
  }

  // 清理临时文件
  async cleanupTempFiles(olderThanHours: number = 24): Promise<void> {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    try {
      const dirs = [this.thumbnailDir, this.previewDir];
      
      for (const dir of dirs) {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            log.debug(`Cleaned up temp file: ${filePath}`);
          }
        }
      }
    } catch (error) {
      log.error('Failed to cleanup temp files:', error);
    }
  }

  // 获取文件类型信息
  getFileTypeInfo(mimeType: string): {
    category: string;
    icon: string;
    color: string;
    previewable: boolean;
  } {
    if (mimeType.startsWith('image/')) {
      return {
        category: 'image',
        icon: 'image',
        color: 'green',
        previewable: true
      };
    }
    
    if (mimeType.startsWith('video/')) {
      return {
        category: 'video',
        icon: 'video',
        color: 'purple',
        previewable: true
      };
    }
    
    if (mimeType.startsWith('audio/')) {
      return {
        category: 'audio',
        icon: 'music',
        color: 'yellow',
        previewable: true
      };
    }
    
    if (mimeType.includes('pdf')) {
      return {
        category: 'document',
        icon: 'file-text',
        color: 'red',
        previewable: true
      };
    }
    
    if (mimeType.includes('text/') || mimeType.includes('json') || mimeType.includes('xml')) {
      return {
        category: 'text',
        icon: 'file-text',
        color: 'blue',
        previewable: true
      };
    }
    
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) {
      return {
        category: 'archive',
        icon: 'archive',
        color: 'orange',
        previewable: false
      };
    }
    
    return {
      category: 'other',
      icon: 'file',
      color: 'gray',
      previewable: false
    };
  }
}

// 创建全局文件处理器实例
export const fileProcessor = new FileProcessor();
