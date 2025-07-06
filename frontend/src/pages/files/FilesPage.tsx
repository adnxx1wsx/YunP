import React, { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useDropzone } from 'react-dropzone';
import {
  FolderOpen,
  Upload,
  Download,
  Share2,
  Trash2,
  MoreVertical,
  Grid,
  List,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  File,
  Image,
  Video,
  Music,
  FileText,
  Archive
} from 'lucide-react';
import toast from 'react-hot-toast';

import { fileApi, folderApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface FileItem {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  isImage: boolean;
  isVideo: boolean;
  isAudio: boolean;
  formattedSize: string;
  createdAt: string;
  updatedAt: string;
}

interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const FilesPage: React.FC = () => {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // 获取文件列表
  const { data: filesData, isLoading: filesLoading } = useQuery(
    ['files', folderId, searchQuery],
    () => fileApi.getFiles({
      folderId,
      search: searchQuery || undefined,
      limit: 50,
    }),
    {
      select: (response) => response.data.data,
    }
  );

  // 获取文件夹列表
  const { data: foldersData, isLoading: foldersLoading } = useQuery(
    ['folders', folderId],
    () => folderApi.getFolders({
      parentId: folderId,
      limit: 50,
    }),
    {
      select: (response) => response.data.data,
    }
  );

  // 获取面包屑导航
  const { data: breadcrumbData } = useQuery(
    ['breadcrumb', folderId],
    () => folderId ? folderApi.getBreadcrumb(folderId) : Promise.resolve({ data: { data: [] } }),
    {
      enabled: !!folderId,
      select: (response) => response.data.data,
    }
  );

  // 文件上传
  const uploadMutation = useMutation(
    (file: File) => fileApi.uploadFile(file, folderId),
    {
      onSuccess: () => {
        toast.success('文件上传成功！');
        queryClient.invalidateQueries(['files', folderId]);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '文件上传失败');
      },
    }
  );

  // 创建文件夹
  const createFolderMutation = useMutation(
    (name: string) => folderApi.createFolder({ name, parentId: folderId }),
    {
      onSuccess: () => {
        toast.success('文件夹创建成功！');
        setShowCreateFolder(false);
        setNewFolderName('');
        queryClient.invalidateQueries(['folders', folderId]);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '文件夹创建失败');
      },
    }
  );

  // 删除文件
  const deleteFileMutation = useMutation(
    (fileId: string) => fileApi.deleteFile(fileId),
    {
      onSuccess: () => {
        toast.success('文件已移至回收站');
        queryClient.invalidateQueries(['files', folderId]);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '删除失败');
      },
    }
  );

  // 删除文件夹
  const deleteFolderMutation = useMutation(
    (folderId: string) => folderApi.deleteFolder(folderId),
    {
      onSuccess: () => {
        toast.success('文件夹已移至回收站');
        queryClient.invalidateQueries(['folders', folderId]);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '删除失败');
      },
    }
  );

  // 文件拖拽上传
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const handleItemSelect = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleDownload = (fileId: string) => {
    const downloadUrl = fileApi.downloadFile(fileId);
    window.open(downloadUrl, '_blank');
  };

  const getFileIcon = (file: FileItem) => {
    if (file.isImage) return <Image className="w-8 h-8 text-green-600" />;
    if (file.isVideo) return <Video className="w-8 h-8 text-purple-600" />;
    if (file.isAudio) return <Music className="w-8 h-8 text-yellow-600" />;
    if (file.mimeType.includes('pdf') || file.mimeType.includes('document')) {
      return <FileText className="w-8 h-8 text-blue-600" />;
    }
    if (file.mimeType.includes('zip') || file.mimeType.includes('rar')) {
      return <Archive className="w-8 h-8 text-orange-600" />;
    }
    return <File className="w-8 h-8 text-gray-600" />;
  };

  const isLoading = filesLoading || foldersLoading;

  return (
    <>
      <Helmet>
        <title>文件管理 - YunP</title>
        <meta name="description" content="管理您的云盘文件和文件夹" />
      </Helmet>

      <div className="space-y-6" {...getRootProps()}>
        <input {...getInputProps()} />

        {/* 头部工具栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {folderId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/files')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            )}
            <h1 className="text-2xl font-bold text-gray-900">文件管理</h1>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索文件..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateFolder(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              新建文件夹
            </Button>

            <Button size="sm">
              <Upload className="w-4 h-4 mr-2" />
              上传文件
            </Button>
          </div>
        </div>

        {/* 面包屑导航 */}
        {breadcrumbData && breadcrumbData.length > 0 && (
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <button
              onClick={() => navigate('/files')}
              className="hover:text-primary-600"
            >
              根目录
            </button>
            {breadcrumbData.map((item, index) => (
              <React.Fragment key={item.id}>
                <span>/</span>
                <button
                  onClick={() => navigate(`/files/${item.id}`)}
                  className="hover:text-primary-600"
                >
                  {item.name}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* 拖拽上传提示 */}
        {isDragActive && (
          <div className="fixed inset-0 bg-primary-500 bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 shadow-xl">
              <Upload className="w-16 h-16 text-primary-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">释放以上传文件</p>
            </div>
          </div>
        )}

        {/* 创建文件夹模态框 */}
        {showCreateFolder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium text-gray-900 mb-4">创建新文件夹</h3>
              <Input
                placeholder="文件夹名称"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreateFolder(false);
                    setNewFolderName('');
                  }}
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreateFolder}
                  loading={createFolderMutation.isLoading}
                  disabled={!newFolderName.trim()}
                >
                  创建
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 文件列表 */}
        <div className="bg-white rounded-lg shadow">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="p-6">
              {(!foldersData?.folders?.length && !filesData?.files?.length) ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchQuery ? '未找到匹配的文件' : '此文件夹为空'}
                  </h3>
                  <p className="text-gray-500">
                    {searchQuery ? '尝试使用不同的搜索词' : '拖拽文件到此处或点击上传按钮添加文件'}
                  </p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? 'file-grid' : 'space-y-2'}>
                  {/* 文件夹 */}
                  {foldersData?.folders?.map((folder: FolderItem) => (
                    <div
                      key={folder.id}
                      className={`file-card cursor-pointer ${selectedItems.has(folder.id) ? 'selected' : ''}`}
                      onClick={() => navigate(`/files/${folder.id}`)}
                    >
                      <div className="file-icon">
                        <FolderOpen className="w-8 h-8 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {folder.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          文件夹 • {new Date(folder.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFolderMutation.mutate(folder.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* 文件 */}
                  {filesData?.files?.map((file: FileItem) => (
                    <div
                      key={file.id}
                      className={`file-card ${selectedItems.has(file.id) ? 'selected' : ''}`}
                      onClick={() => handleItemSelect(file.id)}
                    >
                      <div className="file-icon">
                        {getFileIcon(file)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.originalName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {file.formattedSize} • {new Date(file.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file.id);
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: 实现分享功能
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFileMutation.mutate(file.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FilesPage;
