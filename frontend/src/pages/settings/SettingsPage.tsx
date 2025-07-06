import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Settings,
  User,
  Shield,
  CreditCard,
  Cloud,
  Bell,
  Palette,
  HardDrive,
  Plus,
  Check,
  X,
  ExternalLink,
  Trash2,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

import { authApi, storageApi, billingApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();

  // 处理存储提供商回调
  useEffect(() => {
    const provider = searchParams.get('provider');
    const status = searchParams.get('status');
    const message = searchParams.get('message');

    if (provider && status) {
      if (status === 'success') {
        toast.success(`${provider} 连接成功！`);
        queryClient.invalidateQueries('user-storage-providers');
      } else if (status === 'error') {
        toast.error(message || `${provider} 连接失败`);
      }
    }
  }, [searchParams, queryClient]);

  const tabs = [
    { id: 'profile', name: '个人资料', icon: User },
    { id: 'storage', name: '存储设置', icon: HardDrive },
    { id: 'security', name: '安全设置', icon: Shield },
    { id: 'billing', name: '订阅计费', icon: CreditCard },
    { id: 'notifications', name: '通知设置', icon: Bell },
    { id: 'appearance', name: '外观设置', icon: Palette },
  ];

  return (
    <>
      <Helmet>
        <title>设置 - YunP</title>
        <meta name="description" content="管理您的账户设置和偏好" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">设置</h1>
        </div>

        <div className="flex space-x-6">
          {/* 侧边栏 */}
          <div className="w-64 bg-white rounded-lg shadow p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
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
          <div className="flex-1 bg-white rounded-lg shadow">
            {activeTab === 'profile' && <ProfileSettings />}
            {activeTab === 'storage' && <StorageSettings />}
            {activeTab === 'security' && <SecuritySettings />}
            {activeTab === 'billing' && <BillingSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'appearance' && <AppearanceSettings />}
          </div>
        </div>
      </div>
    </>
  );
};

// 个人资料设置
const ProfileSettings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    username: user?.username || '',
    avatar: user?.avatar || '',
  });

  const updateProfileMutation = useMutation(
    (data: typeof formData) => authApi.updateProfile(data),
    {
      onSuccess: (response) => {
        updateUser(response.data.data);
        toast.success('个人资料更新成功！');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '更新失败');
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">个人资料</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-primary-600" />
            )}
          </div>
          <div>
            <Button variant="secondary" size="sm">
              更换头像
            </Button>
            <p className="text-sm text-gray-500 mt-1">
              支持 JPG、PNG 格式，最大 2MB
            </p>
          </div>
        </div>

        <Input
          label="用户名"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          placeholder="请输入用户名"
        />

        <Input
          label="邮箱地址"
          value={user?.email || ''}
          disabled
          helperText="邮箱地址不可修改"
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={updateProfileMutation.isLoading}
          >
            保存更改
          </Button>
        </div>
      </form>
    </div>
  );
};

// 存储设置
const StorageSettings: React.FC = () => {
  const queryClient = useQueryClient();

  // 获取可用的存储提供商
  const { data: availableProviders, isLoading: providersLoading } = useQuery(
    'available-storage-providers',
    () => storageApi.getProviders(),
    {
      select: (response) => response.data.data,
    }
  );

  // 获取用户的存储提供商
  const { data: userProviders, isLoading: userProvidersLoading } = useQuery(
    'user-storage-providers',
    () => storageApi.getUserProviders(),
    {
      select: (response) => response.data.data,
    }
  );

  // 设置默认提供商
  const setDefaultMutation = useMutation(
    (id: string) => storageApi.setDefaultProvider(id),
    {
      onSuccess: () => {
        toast.success('默认存储提供商已更新');
        queryClient.invalidateQueries('user-storage-providers');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '设置失败');
      },
    }
  );

  // 删除提供商
  const removeMutation = useMutation(
    (id: string) => storageApi.removeProvider(id),
    {
      onSuccess: () => {
        toast.success('存储提供商已移除');
        queryClient.invalidateQueries('user-storage-providers');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '移除失败');
      },
    }
  );

  // 同步配额
  const syncMutation = useMutation(
    (id: string) => storageApi.syncProviderQuota(id),
    {
      onSuccess: () => {
        toast.success('配额信息已同步');
        queryClient.invalidateQueries('user-storage-providers');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || '同步失败');
      },
    }
  );

  const handleConnect = async (provider: any) => {
    try {
      const response = await storageApi.getAuthUrl(provider.provider);
      window.location.href = response.data.data.authUrl;
    } catch (error: any) {
      toast.error(error.response?.data?.error || '连接失败');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (providersLoading || userProvidersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">存储设置</h2>

      {/* 已连接的存储提供商 */}
      <div className="mb-8">
        <h3 className="text-md font-medium text-gray-900 mb-4">已连接的存储</h3>
        {userProviders && userProviders.length > 0 ? (
          <div className="space-y-4">
            {userProviders.map((provider) => (
              <div
                key={provider.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Cloud className="w-8 h-8 text-blue-600" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">
                          {provider.displayName}
                        </h4>
                        {provider.isDefault && (
                          <span className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded">
                            默认
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        已使用 {formatBytes(provider.quota.used)} / {formatBytes(provider.quota.total)}
                      </p>
                      <div className="w-48 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min((provider.quota.used / provider.quota.total) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!provider.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(provider.id)}
                        loading={setDefaultMutation.isLoading}
                      >
                        设为默认
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncMutation.mutate(provider.id)}
                      loading={syncMutation.isLoading}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(provider.id)}
                      loading={removeMutation.isLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">暂无已连接的存储提供商</p>
        )}
      </div>

      {/* 可用的存储提供商 */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-4">添加存储提供商</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableProviders?.map((provider) => {
            const isConnected = userProviders?.some(up => up.provider === provider.provider);

            return (
              <div
                key={provider.provider}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Cloud className="w-8 h-8 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {provider.displayName}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {provider.isConfigured ? '可用' : '未配置'}
                      </p>
                    </div>
                  </div>
                  <div>
                    {isConnected ? (
                      <div className="flex items-center text-green-600">
                        <Check className="w-4 h-4 mr-1" />
                        <span className="text-sm">已连接</span>
                      </div>
                    ) : provider.isConfigured ? (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(provider)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        连接
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-400">不可用</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 其他设置组件的占位符
const SecuritySettings: React.FC = () => (
  <div className="p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-6">安全设置</h2>
    <p className="text-gray-500">安全设置功能开发中...</p>
  </div>
);

const BillingSettings: React.FC = () => (
  <div className="p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-6">订阅计费</h2>
    <p className="text-gray-500">订阅计费功能开发中...</p>
  </div>
);

const NotificationSettings: React.FC = () => (
  <div className="p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-6">通知设置</h2>
    <p className="text-gray-500">通知设置功能开发中...</p>
  </div>
);

const AppearanceSettings: React.FC = () => (
  <div className="p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-6">外观设置</h2>
    <p className="text-gray-500">外观设置功能开发中...</p>
  </div>
);

export default SettingsPage;
