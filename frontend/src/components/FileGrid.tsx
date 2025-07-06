import React, { useState } from 'react';
import {
  File,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  Folder,
  Star,
  Download,
  Share2,
  MoreHorizontal
} from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { FileItem, Folder as FolderType } from '@shared/types';
import FileActions from './FileActions';
import FilePreview from './FilePreview';

interface FileGridProps {
  files: FileItem[];
  folders: FolderType[];
  loading?: boolean;
  selectedItems?: string[];
  onItemSelect?: (id: string, selected: boolean) => void;
  onItemDoubleClick?: (item: FileItem | FolderType) => void;
  onFilePreview?: (file: FileItem) => void;
  onFileDownload?: (file: FileItem) => void;
  onFileShare?: (file: FileItem) => void;
  onFileRename?: (file: FileItem, newName: string) => void;
  onFileMove?: (file: FileItem, targetFolderId: string) => void;
  onFileCopy?: (file: FileItem, targetFolderId: string) => void;
  onFileDelete?: (file: FileItem) => void;
  onFileFavorite?: (file: FileItem, isFavorite: boolean) => void;
  onFolderOpen?: (folder: FolderType) => void;
  className?: string;
}

const FileGrid: React.FC<FileGridProps> = ({
  files,
  folders,
  loading = false,
  selectedItems = [],
  onItemSelect,
  onItemDoubleClick,
  onFilePreview,
  onFileDownload,
  onFileShare,
  onFileRename,
  onFileMove,
  onFileCopy,
  onFileDelete,
  onFileFavorite,
  onFolderOpen,
  className
}) => {
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return Archive;
    return File;
  };

  const getFileIconColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'text-green-500';
    if (mimeType.startsWith('video/')) return 'text-purple-500';
    if (mimeType.startsWith('audio/')) return 'text-yellow-500';
    if (mimeType.includes('pdf')) return 'text-red-500';
    if (mimeType.includes('document')) return 'text-blue-500';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-orange-500';
    return 'text-gray-500';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleItemClick = (item: FileItem | FolderType, event: React.MouseEvent) => {
    if (event.detail === 2) {
      // 双击
      onItemDoubleClick?.(item);
      if ('mimeType' in item) {
        // 是文件，打开预览
        setPreviewFile(item);
      } else {
        // 是文件夹，打开文件夹
        onFolderOpen?.(item);
      }
    } else {
      // 单击选择
      onItemSelect?.(item.id, !selectedItems.includes(item.id));
    }
  };

  const allItems = [
    ...folders.map(folder => ({ ...folder, type: 'folder' as const })),
    ...files.map(file => ({ ...file, type: 'file' as const }))
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-32 mb-2"></div>
            <div className="bg-gray-200 rounded h-4 mb-1"></div>
            <div className="bg-gray-200 rounded h-3 w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Folder className="w-16 h-16 mb-4" />
        <p className="text-lg font-medium">此文件夹为空</p>
        <p className="text-sm">拖拽文件到此处或点击上传按钮添加文件</p>
      </div>
    );
  }

  return (
    <>
      <div className={clsx(
        'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4',
        className
      )}>
        {allItems.map((item) => {
          const isSelected = selectedItems.includes(item.id);
          const isFile = item.type === 'file';
          const FileIcon = isFile ? getFileIcon((item as FileItem).mimeType) : Folder;
          const iconColor = isFile ? getFileIconColor((item as FileItem).mimeType) : 'text-blue-500';

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                'relative group bg-white rounded-lg border-2 transition-all duration-200 cursor-pointer',
                isSelected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              )}
              onClick={(e) => handleItemClick(item, e)}
            >
              {/* 选择指示器 */}
              {isSelected && (
                <div className="absolute top-2 left-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center z-10">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* 收藏指示器 */}
              {isFile && (item as FileItem).isFavorite && (
                <div className="absolute top-2 right-2 z-10">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                </div>
              )}

              {/* 操作按钮 */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {isFile ? (
                  <FileActions
                    file={item as FileItem}
                    onPreview={onFilePreview}
                    onDownload={onFileDownload}
                    onShare={onFileShare}
                    onRename={onFileRename}
                    onMove={onFileMove}
                    onCopy={onFileCopy}
                    onDelete={onFileDelete}
                    onFavorite={onFileFavorite}
                    variant="dropdown"
                  />
                ) : (
                  <button className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-50">
                    <MoreHorizontal className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>

              {/* 文件/文件夹内容 */}
              <div className="p-4">
                {/* 图标区域 */}
                <div className="flex items-center justify-center h-16 mb-3">
                  {isFile && (item as FileItem).thumbnailUrl ? (
                    <img
                      src={(item as FileItem).thumbnailUrl}
                      alt={item.name}
                      className="max-w-full max-h-full object-cover rounded"
                    />
                  ) : (
                    <FileIcon className={clsx('w-12 h-12', iconColor)} />
                  )}
                </div>

                {/* 文件信息 */}
                <div className="text-center">
                  <h3 className="text-sm font-medium text-gray-900 truncate mb-1" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isFile ? formatFileSize((item as FileItem).size) : '文件夹'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* 快速操作按钮（悬停显示） */}
              {isFile && (
                <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(item as FileItem);
                      }}
                      className="p-1 bg-white rounded shadow-sm hover:bg-gray-50"
                      title="预览"
                    >
                      <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileDownload?.(item as FileItem);
                      }}
                      className="p-1 bg-white rounded shadow-sm hover:bg-gray-50"
                      title="下载"
                    >
                      <Download className="w-3 h-3 text-gray-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileShare?.(item as FileItem);
                      }}
                      className="p-1 bg-white rounded shadow-sm hover:bg-gray-50"
                      title="分享"
                    >
                      <Share2 className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 文件预览 */}
      <FilePreview
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={onFileDownload}
        onShare={onFileShare}
      />
    </>
  );
};

export default FileGrid;
