import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  User,
  Lock,
  Bell,
  Cloud,
  CreditCard,
  Shield,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  AlertTriangle,
  Info,
  Settings,
  Smartphone,
  Mail,
  Globe,
  Palette,
  Moon,
  Sun
} from 'lucide-react';
import { motion } from 'framer-motion';

import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ProgressBar from '@/components/ui/ProgressBar';

const EnhancedSettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);

  // 表单状态
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    avatar: user?.avatar || ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    shareNotifications: true,
    storageAlerts: true
  });

  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'private',
    allowFileSharing: true,
    allowPublicShares: true,
    dataCollection: false
  });

  const [themeSettings, setThemeSettings] = useState({
    theme: 'light',
    language: 'zh-CN',
    timezone: 'Asia/Shanghai'
  });

  // 获取用户设置
  const { data: userSettings, isLoading } = useQuery(
    'user-settings',
    () => api.get('/users/settings').then(res => res.data.data),
    {
      onSuccess: (data) => {
        setNotificationSettings(data.notifications || notificationSettings);
        setPrivacySettings(data.privacy || privacySettings);
        setThemeSettings(data.theme || themeSettings);
      }
    }
  );

  // 获取存储提供商
  const { data: storageProviders } = useQuery(
    'storage-providers',
    () => api.get('/storage/providers').then(res => res.data.data)
  );

  // 获取订阅信息
  const { data: subscription } = useQuery(
    'subscription',
    () => api.get('/billing/subscription').then(res => res.data.data)
  );

  // 获取安全日志
  const { data: securityLogs } = useQuery(
    'security-logs',
    () => api.get('/users/security-logs?limit=10').then(res => res.data.data)
  );

  // 更新个人资料
  const updateProfileMutation = useMutation(
    (data: any) => api.put('/users/profile', data),
    {
      onSuccess: () => {
        success('个人资料更新成功');
        updateUser(profileForm);
      },
      onError: () => {
        error('个人资料更新失败');
      }
    }
  );

  // 更改密码
  const changePasswordMutation = useMutation(
    (data: any) => api.put('/users/password', data),
    {
      onSuccess: () => {
        success('密码更改成功');
        setShowPasswordModal(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      },
      onError: () => {
        error('密码更改失败');
      }
    }
  );

  // 更新设置
  const updateSettingsMutation = useMutation(
    (data: any) => api.put('/users/settings', data),
    {
      onSuccess: () => {
        success('设置更新成功');
        queryClient.invalidateQueries('user-settings');
      },
      onError: () => {
        error('设置更新失败');
      }
    }
  );

  // 删除账户
  const deleteAccountMutation = useMutation(
    () => api.delete('/users/account'),
    {
      onSuccess: () => {
        success('账户删除成功');
        // 重定向到登录页面
        window.location.href = '/login';
      },
      onError: () => {
        error('账户删除失败');
      }
    }
  );

  const handleProfileUpdate = () => {
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordChange = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      error('新密码和确认密码不匹配');
      return;
    }
    changePasswordMutation.mutate(passwordForm);
  };

  const handleSettingsUpdate = (category: string, settings: any) => {
    updateSettingsMutation.mutate({ [category]: settings });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const tabs = [
    { id: 'profile', name: '个人资料', icon: User },
    { id: 'security', name: '安全设置', icon: Shield },
    { id: 'notifications', name: '通知设置', icon: Bell },
    { id: 'privacy', name: '隐私设置', icon: Lock },
    { id: 'storage', name: '存储管理', icon: Cloud },
    { id: 'billing', name: '订阅管理', icon: CreditCard },
    { id: 'appearance', name: '外观设置', icon: Palette },
    { id: 'advanced', name: '高级设置', icon: Settings }
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" text="加载设置..." />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>设置 - YunP</title>
        <meta name="description" content="管理您的账户设置和偏好" />
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">设置</h1>
            <p className="mt-2 text-gray-600">管理您的账户设置和偏好</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* 侧边栏导航 */}
            <div className="lg:w-64">
              <nav className="bg-white rounded-lg shadow p-4">
                <ul className="space-y-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <li key={tab.id}>
                        <button
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            activeTab === tab.id
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="w-5 h-5 mr-3" />
                          {tab.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            {/* 主内容区域 */}
            <div className="flex-1">
              <div className="bg-white rounded-lg shadow">
                {/* 个人资料 */}
                {activeTab === 'profile' && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">个人资料</h2>
                    
                    <div className="space-y-6">
                      <div className="flex items-center space-x-6">
                        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                          {user?.avatar ? (
                            <img
                              src={user.avatar}
                              alt="头像"
                              className="w-20 h-20 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <Button variant="outline" size="sm">
                            更换头像
                          </Button>
                          <p className="text-sm text-gray-500 mt-1">
                            支持 JPG、PNG 格式，最大 2MB
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            用户名
                          </label>
                          <Input
                            value={profileForm.username}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                            placeholder="请输入用户名"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            邮箱地址
                          </label>
                          <Input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="请输入邮箱地址"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="primary"
                          onClick={handleProfileUpdate}
                          disabled={updateProfileMutation.isLoading}
                        >
                          保存更改
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 安全设置 */}
                {activeTab === 'security' && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">安全设置</h2>
                    
                    <div className="space-y-6">
                      {/* 密码设置 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">密码</h3>
                            <p className="text-sm text-gray-500">定期更改密码以保护账户安全</p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setShowPasswordModal(true)}
                          >
                            更改密码
                          </Button>
                        </div>
                      </div>

                      {/* 两步验证 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">两步验证</h3>
                            <p className="text-sm text-gray-500">为您的账户添加额外的安全保护</p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setShowTwoFactorModal(true)}
                          >
                            {user?.twoFactorEnabled ? '管理' : '启用'}
                          </Button>
                        </div>
                      </div>

                      {/* 登录历史 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">最近登录记录</h3>
                        <div className="space-y-3">
                          {securityLogs?.map((log: any, index: number) => (
                            <div key={index} className="flex items-center justify-between py-2">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{log.action}</p>
                                <p className="text-sm text-gray-500">
                                  {log.ipAddress} • {formatDate(log.createdAt)}
                                </p>
                              </div>
                              <div className="text-sm text-gray-500">
                                {log.userAgent}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 危险区域 */}
                      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <h3 className="text-lg font-medium text-red-900 mb-2">危险区域</h3>
                        <p className="text-sm text-red-700 mb-4">
                          删除账户将永久删除您的所有数据，此操作不可恢复。
                        </p>
                        <Button
                          variant="danger"
                          onClick={() => setShowDeleteModal(true)}
                        >
                          删除账户
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 通知设置 */}
                {activeTab === 'notifications' && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">通知设置</h2>
                    
                    <div className="space-y-6">
                      {Object.entries(notificationSettings).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">
                              {key === 'emailNotifications' && '邮件通知'}
                              {key === 'pushNotifications' && '推送通知'}
                              {key === 'shareNotifications' && '分享通知'}
                              {key === 'storageAlerts' && '存储警告'}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {key === 'emailNotifications' && '接收重要更新的邮件通知'}
                              {key === 'pushNotifications' && '接收浏览器推送通知'}
                              {key === 'shareNotifications' && '文件被分享时接收通知'}
                              {key === 'storageAlerts' && '存储空间不足时接收警告'}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => {
                                const newSettings = { ...notificationSettings, [key]: e.target.checked };
                                setNotificationSettings(newSettings);
                                handleSettingsUpdate('notifications', newSettings);
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 存储管理 */}
                {activeTab === 'storage' && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">存储管理</h2>
                    
                    <div className="space-y-6">
                      {/* 存储使用情况 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">存储使用情况</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">已使用</span>
                            <span className="text-sm font-medium">
                              {user?.storageUsed ? `${(user.storageUsed / 1024 / 1024 / 1024).toFixed(2)} GB` : '0 GB'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">总容量</span>
                            <span className="text-sm font-medium">
                              {user?.storageLimit ? `${(user.storageLimit / 1024 / 1024 / 1024).toFixed(2)} GB` : '0 GB'}
                            </span>
                          </div>
                          <ProgressBar
                            value={user?.storageUsed || 0}
                            max={user?.storageLimit || 1}
                            color="primary"
                          />
                        </div>
                      </div>

                      {/* 云存储提供商 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">云存储提供商</h3>
                        <div className="space-y-3">
                          {storageProviders?.map((provider: any) => (
                            <div key={provider.name} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                  <Cloud className="w-4 h-4 text-gray-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                                  <p className="text-sm text-gray-500">
                                    {provider.connected ? '已连接' : '未连接'}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant={provider.connected ? 'outline' : 'primary'}
                                size="sm"
                              >
                                {provider.connected ? '断开连接' : '连接'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 订阅管理 */}
                {activeTab === 'billing' && (
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">订阅管理</h2>
                    
                    <div className="space-y-6">
                      {/* 当前套餐 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">当前套餐</h3>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-gray-900">
                              {subscription?.planName || '免费版'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {subscription?.status === 'active' ? '活跃' : '未激活'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900">
                              {subscription?.amount ? `¥${subscription.amount}/月` : '免费'}
                            </p>
                            {subscription?.nextBillingDate && (
                              <p className="text-sm text-gray-500">
                                下次扣费: {new Date(subscription.nextBillingDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-4">
                          <Button variant="primary">
                            {subscription?.planName ? '更改套餐' : '升级套餐'}
                          </Button>
                        </div>
                      </div>

                      {/* 账单历史 */}
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">账单历史</h3>
                        <div className="text-center py-8">
                          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">暂无账单记录</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 更改密码模态框 */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="更改密码"
      >
        <div className="space-y-4">
          <Input
            type="password"
            label="当前密码"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
            placeholder="请输入当前密码"
          />
          <Input
            type="password"
            label="新密码"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
            placeholder="请输入新密码"
          />
          <Input
            type="password"
            label="确认新密码"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="请再次输入新密码"
          />
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowPasswordModal(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handlePasswordChange}
              disabled={changePasswordMutation.isLoading}
            >
              更改密码
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除账户确认模态框 */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="删除账户"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">确定要删除账户吗？</h3>
              <p className="text-sm text-gray-500">此操作将永久删除您的所有数据，无法恢复。</p>
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
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteAccountMutation.isLoading}
            >
              确认删除
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default EnhancedSettingsPage;
