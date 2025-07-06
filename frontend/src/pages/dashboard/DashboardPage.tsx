import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from 'react-query';
import { 
  HardDrive, 
  FileText, 
  FolderOpen, 
  Upload,
  Download,
  Share2,
  Clock
} from 'lucide-react';

import { userApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery(
    'user-stats',
    () => userApi.getStats(),
    {
      select: (response) => response.data.data,
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const storagePercentage = stats?.storage.usagePercentage || 0;

  return (
    <>
      <Helmet>
        <title>仪表板 - YunP</title>
        <meta name="description" content="查看您的云盘使用情况和最近活动" />
      </Helmet>

      <div className="space-y-6">
        {/* 欢迎信息 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            欢迎回来，{user?.username}！
          </h1>
          <p className="text-gray-600">
            这是您的云盘仪表板，您可以在这里查看存储使用情况和管理文件。
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总文件数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.files.total || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg">
                <FolderOpen className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">文件夹数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.folders.total || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-lg">
                <HardDrive className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">已用存储</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.storage.usedFormatted || '0 B'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-orange-100 p-3 rounded-lg">
                <Share2 className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">存储使用率</p>
                <p className="text-2xl font-bold text-gray-900">
                  {storagePercentage}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 存储使用情况 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">存储使用情况</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                已使用 {stats?.storage.usedFormatted} / {stats?.storage.limitFormatted}
              </span>
              <span className="font-medium text-gray-900">
                {storagePercentage}%
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-bar-fill"
                style={{ width: `${Math.min(storagePercentage, 100)}%` }}
              />
            </div>
            {storagePercentage > 80 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ 存储空间即将用完，请考虑清理不需要的文件或升级存储计划。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 最近文件 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">最近上传</h2>
            <Button variant="ghost" size="sm">
              查看全部
            </Button>
          </div>
          
          {stats?.recentFiles && stats.recentFiles.length > 0 ? (
            <div className="space-y-3">
              {stats.recentFiles.map((file) => (
                <div key={file.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg">
                  <div className={`file-icon ${
                    file.isImage ? 'image' : 
                    file.isVideo ? 'video' : 
                    file.isAudio ? 'audio' : 'document'
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.original_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {file.formattedSize} • {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Clock className="empty-state-icon" />
              <p className="text-sm text-gray-500">暂无最近上传的文件</p>
            </div>
          )}
        </div>

        {/* 快速操作 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button className="justify-start h-auto p-4">
              <Upload className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">上传文件</div>
                <div className="text-xs opacity-75">添加新文件到云盘</div>
              </div>
            </Button>
            
            <Button variant="secondary" className="justify-start h-auto p-4">
              <FolderOpen className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">创建文件夹</div>
                <div className="text-xs opacity-75">组织您的文件</div>
              </div>
            </Button>
            
            <Button variant="secondary" className="justify-start h-auto p-4">
              <Share2 className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">分享文件</div>
                <div className="text-xs opacity-75">与他人共享文件</div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardPage;
