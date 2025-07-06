import React, { useState } from 'react';
import {
  Download,
  Share2,
  Copy,
  Move,
  Trash2,
  Edit3,
  Eye,
  MoreHorizontal,
  Star,
  StarOff,
  Tag,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { FileItem, Folder } from '@shared/types';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { useToast } from '@/hooks/useToast';

interface FileActionsProps {
  file: FileItem;
  onPreview?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
  onRename?: (file: FileItem, newName: string) => void;
  onMove?: (file: FileItem, targetFolderId: string) => void;
  onCopy?: (file: FileItem, targetFolderId: string) => void;
  onDelete?: (file: FileItem) => void;
  onFavorite?: (file: FileItem, isFavorite: boolean) => void;
  onTag?: (file: FileItem, tags: string[]) => void;
  className?: string;
  variant?: 'dropdown' | 'toolbar';
}

const FileActions: React.FC<FileActionsProps> = ({
  file,
  onPreview,
  onDownload,
  onShare,
  onRename,
  onMove,
  onCopy,
  onDelete,
  onFavorite,
  onTag,
  className,
  variant = 'dropdown'
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const { success, error } = useToast();

  const actions = [
    {
      key: 'preview',
      label: '预览',
      icon: Eye,
      onClick: () => onPreview?.(file),
      show: !!onPreview && isPreviewable(file.mimeType)
    },
    {
      key: 'download',
      label: '下载',
      icon: Download,
      onClick: () => onDownload?.(file),
      show: !!onDownload
    },
    {
      key: 'share',
      label: '分享',
      icon: Share2,
      onClick: () => onShare?.(file),
      show: !!onShare
    },
    {
      key: 'favorite',
      label: file.isFavorite ? '取消收藏' : '收藏',
      icon: file.isFavorite ? StarOff : Star,
      onClick: () => onFavorite?.(file, !file.isFavorite),
      show: !!onFavorite
    },
    {
      key: 'rename',
      label: '重命名',
      icon: Edit3,
      onClick: () => setShowRenameModal(true),
      show: !!onRename
    },
    {
      key: 'copy',
      label: '复制',
      icon: Copy,
      onClick: () => setShowMoveModal(true),
      show: !!onCopy
    },
    {
      key: 'move',
      label: '移动',
      icon: Move,
      onClick: () => setShowMoveModal(true),
      show: !!onMove
    },
    {
      key: 'tag',
      label: '标签',
      icon: Tag,
      onClick: () => {}, // TODO: 实现标签功能
      show: !!onTag
    },
    {
      key: 'delete',
      label: '删除',
      icon: Trash2,
      onClick: () => setShowDeleteModal(true),
      show: !!onDelete,
      danger: true
    }
  ].filter(action => action.show);

  const handleRename = () => {
    if (newName.trim() && newName !== file.name) {
      onRename?.(file, newName.trim());
      success('文件重命名成功');
    }
    setShowRenameModal(false);
  };

  const handleDelete = () => {
    onDelete?.(file);
    setShowDeleteModal(false);
    success('文件已删除');
  };

  if (variant === 'toolbar') {
    return (
      <div className={clsx('flex items-center space-x-1', className)}>
        {actions.slice(0, 4).map(action => {
          const Icon = action.icon;
          return (
            <Button
              key={action.key}
              variant="ghost"
              size="sm"
              onClick={action.onClick}
              className={clsx(
                'p-2',
                action.danger && 'text-red-600 hover:text-red-700 hover:bg-red-50'
              )}
              title={action.label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
        {actions.length > 4 && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-2"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10"
                >
                  <div className="py-1">
                    {actions.slice(4).map(action => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.key}
                          onClick={() => {
                            action.onClick();
                            setShowDropdown(false);
                          }}
                          className={clsx(
                            'flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100',
                            action.danger ? 'text-red-600' : 'text-gray-700'
                          )}
                        >
                          <Icon className="w-4 h-4 mr-3" />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={clsx('relative', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDropdown(!showDropdown)}
          className="p-2"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10"
            >
              <div className="py-1">
                {actions.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      onClick={() => {
                        action.onClick();
                        setShowDropdown(false);
                      }}
                      className={clsx(
                        'flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-100',
                        action.danger ? 'text-red-600' : 'text-gray-700'
                      )}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 重命名模态框 */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="重命名文件"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              文件名
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="请输入新的文件名"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename();
                }
              }}
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowRenameModal(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleRename}
              disabled={!newName.trim() || newName === file.name}
            >
              确定
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除文件"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                确定要删除这个文件吗？
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                文件 "{file.name}" 将被移动到回收站，您可以稍后恢复它。
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
            >
              取消
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
            >
              删除
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

// 判断文件是否可预览
const isPreviewable = (mimeType: string): boolean => {
  const previewableTypes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'text/',
    'application/json',
    'application/xml'
  ];
  
  return previewableTypes.some(type => mimeType.startsWith(type));
};

export default FileActions;
