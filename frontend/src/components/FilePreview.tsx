import React, { useState } from 'react';
import { X, Download, Share2, Eye, EyeOff, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { FileItem } from '@shared/types';
import Button from './ui/Button';
import Modal from './ui/Modal';

interface FilePreviewProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  isOpen,
  onClose,
  onDownload,
  onShare
}) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showControls, setShowControls] = useState(true);

  if (!file) return null;

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isPDF = file.mimeType === 'application/pdf';
  const isText = file.mimeType.startsWith('text/') || 
                 file.mimeType === 'application/json' ||
                 file.mimeType === 'application/xml';

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreview = () => {
    const fileUrl = `/api/files/${file.id}/download`;

    if (isImage) {
      return (
        <div className="relative flex items-center justify-center h-full">
          <img
            src={fileUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`
            }}
            onLoad={() => setZoom(100)}
          />
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="flex items-center justify-center h-full">
          <video
            src={fileUrl}
            controls
            className="max-w-full max-h-full"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            您的浏览器不支持视频播放
          </video>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <audio src={fileUrl} controls className="w-full max-w-md">
            您的浏览器不支持音频播放
          </audio>
        </div>
      );
    }

    if (isPDF) {
      return (
        <div className="w-full h-full">
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full border-0"
            title={file.name}
          />
        </div>
      );
    }

    if (isText) {
      return (
        <div className="w-full h-full p-4 overflow-auto">
          <iframe
            src={fileUrl}
            className="w-full h-full border border-gray-200 rounded"
            title={file.name}
          />
        </div>
      );
    }

    // 不支持预览的文件类型
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <svg className="w-24 h-24 mb-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
        <p className="text-lg font-medium mb-2">无法预览此文件</p>
        <p className="text-sm">文件类型: {file.mimeType}</p>
        <Button
          onClick={() => onDownload?.(file)}
          className="mt-4"
          variant="primary"
        >
          <Download className="w-4 h-4 mr-2" />
          下载文件
        </Button>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-90"
            onClick={onClose}
          />

          {/* 预览内容 */}
          <div className="relative w-full h-full flex flex-col">
            {/* 顶部工具栏 */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-4 text-white">
                      <h3 className="text-lg font-medium truncate max-w-md">
                        {file.name}
                      </h3>
                      <span className="text-sm text-gray-300">
                        {formatFileSize(file.size)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* 图片控制按钮 */}
                      {isImage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleZoomOut}
                            disabled={zoom <= 25}
                            className="text-white hover:bg-white hover:bg-opacity-20"
                          >
                            <ZoomOut className="w-4 h-4" />
                          </Button>
                          <span className="text-white text-sm min-w-[3rem] text-center">
                            {zoom}%
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleZoomIn}
                            disabled={zoom >= 300}
                            className="text-white hover:bg-white hover:bg-opacity-20"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRotate}
                            className="text-white hover:bg-white hover:bg-opacity-20"
                          >
                            <RotateCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="text-white hover:bg-white hover:bg-opacity-20"
                          >
                            重置
                          </Button>
                        </>
                      )}

                      {/* 操作按钮 */}
                      {onDownload && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownload(file)}
                          className="text-white hover:bg-white hover:bg-opacity-20"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}

                      {onShare && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onShare(file)}
                          className="text-white hover:bg-white hover:bg-opacity-20"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowControls(!showControls)}
                        className="text-white hover:bg-white hover:bg-opacity-20"
                      >
                        {showControls ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-white hover:bg-white hover:bg-opacity-20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 预览区域 */}
            <div 
              className="flex-1 relative"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowControls(!showControls);
                }
              }}
            >
              {renderPreview()}
            </div>

            {/* 底部信息栏 */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 backdrop-blur-sm text-white p-4"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span>类型: {file.mimeType}</span>
                      <span>上传时间: {new Date(file.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-gray-300">
                      按 ESC 键或点击背景关闭预览
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FilePreview;
