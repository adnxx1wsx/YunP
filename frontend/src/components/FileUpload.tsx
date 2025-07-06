import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, Image, Video, Music, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import Button from './ui/Button';
import ProgressBar from './ui/ProgressBar';
import { useToast } from '@/hooks/useToast';

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  preview?: string;
}

interface FileUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  accept,
  maxSize = 100 * 1024 * 1024, // 100MB
  maxFiles = 10,
  multiple = true,
  disabled = false,
  className
}) => {
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { error: showError } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // 处理被拒绝的文件
    rejectedFiles.forEach(({ file, errors }) => {
      errors.forEach((error: any) => {
        if (error.code === 'file-too-large') {
          showError(`文件 "${file.name}" 太大`, {
            message: `最大允许 ${Math.round(maxSize / 1024 / 1024)}MB`
          });
        } else if (error.code === 'file-invalid-type') {
          showError(`文件 "${file.name}" 类型不支持`);
        } else if (error.code === 'too-many-files') {
          showError('文件数量超出限制', {
            message: `最多允许 ${maxFiles} 个文件`
          });
        }
      });
    });

    if (acceptedFiles.length === 0) return;

    // 创建上传项目
    const newItems: FileUploadItem[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(2),
      file,
      progress: 0,
      status: 'pending',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setUploadItems(prev => [...prev, ...newItems]);

    // 开始上传
    setIsUploading(true);
    try {
      await onUpload(acceptedFiles);
      
      // 更新状态为完成
      setUploadItems(prev => 
        prev.map(item => 
          newItems.find(newItem => newItem.id === item.id)
            ? { ...item, status: 'completed' as const, progress: 100 }
            : item
        )
      );
    } catch (error: any) {
      // 更新状态为错误
      setUploadItems(prev => 
        prev.map(item => 
          newItems.find(newItem => newItem.id === item.id)
            ? { ...item, status: 'error' as const, error: error.message }
            : item
        )
      );
      showError('上传失败', { message: error.message });
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, maxSize, maxFiles, showError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles: multiple ? maxFiles : 1,
    multiple,
    disabled: disabled || isUploading,
    noClick: uploadItems.length > 0
  });

  const removeItem = (id: string) => {
    setUploadItems(prev => {
      const item = prev.find(item => item.id === id);
      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const clearCompleted = () => {
    setUploadItems(prev => {
      const completed = prev.filter(item => item.status === 'completed');
      completed.forEach(item => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
      return prev.filter(item => item.status !== 'completed');
    });
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.startsWith('video/')) return Video;
    if (file.type.startsWith('audio/')) return Music;
    if (file.type.includes('pdf') || file.type.includes('document')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={clsx('w-full', className)}>
      {/* 拖拽区域 */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed',
          uploadItems.length > 0 && 'border-gray-200 bg-gray-50'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <Upload className={clsx(
            'w-12 h-12',
            isDragActive ? 'text-primary-500' : 'text-gray-400'
          )} />
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? '释放文件以上传' : '拖拽文件到此处'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              或者 <span className="text-primary-600 font-medium">点击选择文件</span>
            </p>
          </div>
          
          <div className="text-xs text-gray-400 space-y-1">
            <p>最大文件大小: {Math.round(maxSize / 1024 / 1024)}MB</p>
            {multiple && <p>最多 {maxFiles} 个文件</p>}
          </div>
        </div>
      </div>

      {/* 上传列表 */}
      <AnimatePresence>
        {uploadItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">
                上传文件 ({uploadItems.length})
              </h4>
              {uploadItems.some(item => item.status === 'completed') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCompleted}
                >
                  清除已完成
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadItems.map((item) => {
                const FileIcon = getFileIcon(item.file);
                
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg"
                  >
                    {/* 文件图标/预览 */}
                    <div className="flex-shrink-0">
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt={item.file.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                          <FileIcon className="w-5 h-5 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(item.file.size)}
                      </p>
                      
                      {/* 进度条 */}
                      {item.status === 'uploading' && (
                        <ProgressBar
                          value={item.progress}
                          size="sm"
                          className="mt-1"
                        />
                      )}
                      
                      {/* 错误信息 */}
                      {item.status === 'error' && item.error && (
                        <p className="text-xs text-red-600 mt-1">
                          {item.error}
                        </p>
                      )}
                    </div>

                    {/* 状态指示器 */}
                    <div className="flex-shrink-0">
                      {item.status === 'completed' && (
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      
                      {item.status === 'error' && (
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <X className="w-4 h-4 text-red-600" />
                        </div>
                      )}
                      
                      {(item.status === 'pending' || item.status === 'uploading') && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-6 h-6 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;
