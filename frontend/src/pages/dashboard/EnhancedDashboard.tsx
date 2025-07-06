import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import {
  Files,
  Folder,
  Upload,
  Download,
  Share2,
  Star,
  Clock,
  TrendingUp,
  Users,
  HardDrive,
  Activity,
  BarChart3,
  PieChart,
  Calendar,
  Search,
  Filter,
  Plus,
  Eye,
  Heart,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';

import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const EnhancedDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // 获取仪表板数据
  const { data: dashboardData, isLoading } = useQuery(
    ['dashboard', timeRange],
    () => api.get(`/users/dashboard?range=${timeRange}`).then(res => res.data.data),
    { refetchInterval: 30000 } // 30秒刷新一次
  );

  // 获取最近文件
  const { data: recentFiles } = useQuery(
    'recent-files',
    () => api.get('/files/recent?limit=10').then(res => res.data.data)
  );

  // 获取收藏文件
  const { data: favoriteFiles } = useQuery(
    'favorite-files',
    () => api.get('/files/favorites?limit=6').then(res => res.data.data)
  );

  // 获取分享统计
  const { data: shareStats } = useQuery(
    'share-stats',
    () => api.get('/shares/stats').then(res => res.data.data)
  );

  // 获取活动日志
  const { data: activities } = useQuery(
    'user-activities',
    () => api.get('/users/activities?limit=8').then(res => res.data.data)
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '今天';
    if (diffDays === 2) return '昨天';
    if (diffDays <= 7) return `${diffDays}天前`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" text="加载仪表板..." />
      </div>
    );
  }

  const stats = dashboardData?.stats || {};
  const storageUsage = (stats.storageUsed / stats.storageLimit) * 100;

  return (
    <>
      <Helmet>
        <title>仪表板 - YunP</title>
        <meta name="description" content="查看您的文件统计和活动" />
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面头部 */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  欢迎回来，{user?.username}！
                </h1>
                <p className="mt-2 text-gray-600">
                  这是您的文件管理概览
                </p>
              </div>
              
              <div className="mt-4 sm:mt-0 flex items-center space-x-3">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="7d">最近7天</option>
                  <option value="30d">最近30天</option>
                  <option value="90d">最近90天</option>
                </select>
                
                <Button
                  variant="primary"
                  onClick={() => navigate('/files')}
                  className="flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  上传文件
                </Button>
              </div>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg shadow p-6"
            >
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Files className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总文件数</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalFiles || 0}</p>
                  <p className="text-sm text-green-600">+{stats.newFiles || 0} 本周新增</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg shadow p-6"
            >
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <HardDrive className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">存储使用</p>
                  <p className="text-2xl font-bold text-gray-900">{formatBytes(stats.storageUsed || 0)}</p>
                  <div className="mt-2">
                    <ProgressBar
                      value={stats.storageUsed || 0}
                      max={stats.storageLimit || 1}
                      color={storageUsage > 80 ? 'warning' : 'primary'}
                      size="sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {storageUsage.toFixed(1)}% 已使用
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg shadow p-6"
            >
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Share2 className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">分享链接</p>
                  <p className="text-2xl font-bold text-gray-900">{shareStats?.totalShares || 0}</p>
                  <p className="text-sm text-blue-600">{shareStats?.activeShares || 0} 个活跃</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg shadow p-6"
            >
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">下载次数</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalDownloads || 0}</p>
                  <p className="text-sm text-orange-600">+{stats.recentDownloads || 0} 本周</p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左侧列 */}
            <div className="lg:col-span-2 space-y-8">
              {/* 最近文件 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-lg shadow"
              >
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">最近文件</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/files')}
                    >
                      查看全部
                    </Button>
                  </div>
                </div>
                <div className="p-6">
                  {recentFiles?.length > 0 ? (
                    <div className="space-y-4">
                      {recentFiles.map((file: any) => (
                        <div key={file.id} className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              {file.mimeType.startsWith('image/') ? (
                                <img
                                  src={file.thumbnailUrl || '/placeholder-image.png'}
                                  alt={file.name}
                                  className="w-8 h-8 rounded object-cover"
                                />
                              ) : (
                                <Files className="w-5 h-5 text-gray-600" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatBytes(file.size)} • {formatDate(file.updatedAt)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => navigate(`/files?preview=${file.id}`)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => window.open(`/api/files/${file.id}/download`)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Files className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">还没有文件</p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/files')}
                        className="mt-4"
                      >
                        上传第一个文件
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* 文件类型分布 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-lg shadow"
              >
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">文件类型分布</h3>
                </div>
                <div className="p-6">
                  {stats.fileTypes?.length > 0 ? (
                    <div className="space-y-4">
                      {stats.fileTypes.map((type: any) => (
                        <div key={type.type} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full bg-${type.color}-500`}></div>
                            <span className="text-sm font-medium text-gray-900">{type.type}</span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500">{type.count} 个文件</span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatBytes(type.size)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">暂无数据</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* 右侧列 */}
            <div className="space-y-8">
              {/* 收藏文件 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white rounded-lg shadow"
              >
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">收藏文件</h3>
                    <Star className="w-5 h-5 text-yellow-500" />
                  </div>
                </div>
                <div className="p-6">
                  {favoriteFiles?.length > 0 ? (
                    <div className="space-y-3">
                      {favoriteFiles.map((file: any) => (
                        <div key={file.id} className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <Files className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatBytes(file.size)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Heart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">还没有收藏文件</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* 最近活动 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white rounded-lg shadow"
              >
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">最近活动</h3>
                </div>
                <div className="p-6">
                  {activities?.length > 0 ? (
                    <div className="space-y-4">
                      {activities.map((activity: any, index: number) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <Activity className="w-4 h-4 text-primary-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500">{formatDate(activity.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Zap className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">暂无活动记录</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* 快速操作 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-white rounded-lg shadow"
              >
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">快速操作</h3>
                </div>
                <div className="p-6 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/files')}
                  >
                    <Upload className="w-4 h-4 mr-3" />
                    上传文件
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/files')}
                  >
                    <Folder className="w-4 h-4 mr-3" />
                    新建文件夹
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/shares')}
                  >
                    <Share2 className="w-4 h-4 mr-3" />
                    管理分享
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/trash')}
                  >
                    <Trash2 className="w-4 h-4 mr-3" />
                    回收站
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EnhancedDashboard;
