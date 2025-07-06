import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from 'react-query';
import {
  Users,
  Files,
  HardDrive,
  Activity,
  Settings,
  BarChart3,
  Shield,
  Database,
  Server,
  AlertTriangle
} from 'lucide-react';

import { adminApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ProgressBar from '@/components/ui/ProgressBar';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // 检查管理员权限
  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">访问被拒绝</h1>
          <p className="text-gray-600">您没有访问管理员面板的权限</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: '概览', icon: BarChart3 },
    { id: 'users', name: '用户管理', icon: Users },
    { id: 'files', name: '文件管理', icon: Files },
    { id: 'system', name: '系统监控', icon: Server },
    { id: 'settings', name: '系统设置', icon: Settings },
  ];

  return (
    <>
      <Helmet>
        <title>管理员面板 - YunP</title>
        <meta name="description" content="系统管理和监控面板" />
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* 侧边栏 */}
          <div className="w-64 bg-white shadow-sm border-r border-gray-200">
            <div className="p-6">
              <h1 className="text-xl font-bold text-gray-900">管理员面板</h1>
            </div>
            <nav className="mt-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 主内容区 */}
          <div className="flex-1 p-8">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'files' && <FilesTab />}
            {activeTab === 'system' && <SystemTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </div>
    </>
  );
};

// 概览标签页
const OverviewTab: React.FC = () => {
  const { data: stats, isLoading } = useQuery('admin-stats', adminApi.getStats);

  if (isLoading) {
    return <LoadingSpinner size="lg" text="加载统计数据..." />;
  }

  const statCards = [
    {
      title: '总用户数',
      value: stats?.data.users.total || 0,
      change: `+${stats?.data.users.new || 0} 本周新增`,
      icon: Users,
      color: 'blue'
    },
    {
      title: '总文件数',
      value: stats?.data.files.total || 0,
      change: `+${stats?.data.files.uploadedToday || 0} 今日上传`,
      icon: Files,
      color: 'green'
    },
    {
      title: '存储使用率',
      value: `${stats?.data.storage.utilization || 0}%`,
      change: `${formatBytes(stats?.data.storage.used || 0)} / ${formatBytes(stats?.data.storage.limit || 0)}`,
      icon: HardDrive,
      color: 'purple'
    },
    {
      title: '活跃订阅',
      value: stats?.data.subscriptions.active || 0,
      change: `${stats?.data.subscriptions.canceled || 0} 已取消`,
      icon: Activity,
      color: 'orange'
    }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">系统概览</h2>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg bg-${card.color}-100`}>
                  <Icon className={`w-6 h-6 text-${card.color}-600`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-sm text-gray-500">{card.change}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 系统状态 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统状态</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">内存使用</span>
              <span className="text-sm text-gray-500">
                {stats?.data.system.memory.heapUsed}MB / {stats?.data.system.memory.heapTotal}MB
              </span>
            </div>
            <ProgressBar
              value={stats?.data.system.memory.heapUsed || 0}
              max={stats?.data.system.memory.heapTotal || 100}
              color="primary"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">运行时间:</span>
              <span className="ml-2 font-medium">{formatUptime(stats?.data.system.uptime || 0)}</span>
            </div>
            <div>
              <span className="text-gray-600">Node.js 版本:</span>
              <span className="ml-2 font-medium">{stats?.data.system.nodeVersion}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 用户管理标签页
const UsersTab: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { data: users, isLoading } = useQuery(
    ['admin-users', page, search],
    () => adminApi.getUsers({ page, search, limit: 20 })
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="搜索用户..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" text="加载用户数据..." />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  存储使用
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  注册时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.data.users.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatBytes(user.storage_used)} / {formatBytes(user.storage_limit)}
                    </div>
                    <ProgressBar
                      value={user.storage_used}
                      max={user.storage_limit}
                      size="sm"
                      color={user.storage_used / user.storage_limit > 0.8 ? 'warning' : 'primary'}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.email_verified 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.email_verified ? '已验证' : '未验证'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 mr-4">
                      查看
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      禁用
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// 其他标签页的占位符组件
const FilesTab: React.FC = () => (
  <div className="text-center py-12">
    <Files className="w-16 h-16 text-gray-300 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">文件管理</h3>
    <p className="text-gray-500">文件管理功能开发中...</p>
  </div>
);

const SystemTab: React.FC = () => (
  <div className="text-center py-12">
    <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">系统监控</h3>
    <p className="text-gray-500">系统监控功能开发中...</p>
  </div>
);

const SettingsTab: React.FC = () => (
  <div className="text-center py-12">
    <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">系统设置</h3>
    <p className="text-gray-500">系统设置功能开发中...</p>
  </div>
);

// 工具函数
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
};

export default AdminPage;
