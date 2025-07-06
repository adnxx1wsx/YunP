import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// 页面组件
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import FilesPage from '@/pages/files/FilesPage';
import TrashPage from '@/pages/trash/TrashPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import SharedFilePage from '@/pages/shared/SharedFilePage';
import AdminPage from '@/pages/admin/AdminPage';

// 布局组件
import AuthLayout from '@/components/layout/AuthLayout';
import MainLayout from '@/components/layout/MainLayout';

// 路由保护组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 公开路由组件（已登录用户重定向到仪表板）
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>YunP - 云盘存储系统</title>
        <meta name="description" content="现代化的云盘存储系统，支持文件上传、下载、管理和分享功能" />
      </Helmet>

      <Routes>
        {/* 公开路由 */}
        <Route path="/login" element={
          <PublicRoute>
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          </PublicRoute>
        } />
        
        <Route path="/register" element={
          <PublicRoute>
            <AuthLayout>
              <RegisterPage />
            </AuthLayout>
          </PublicRoute>
        } />

        {/* 分享文件页面（不需要认证） */}
        <Route path="/shared/:fileId" element={<SharedFilePage />} />

        {/* 受保护的路由 */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/files" element={
          <ProtectedRoute>
            <MainLayout>
              <FilesPage />
            </MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/files/:folderId" element={
          <ProtectedRoute>
            <MainLayout>
              <FilesPage />
            </MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/trash" element={
          <ProtectedRoute>
            <MainLayout>
              <TrashPage />
            </MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
            <MainLayout>
              <SettingsPage />
            </MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        } />

        {/* 默认重定向 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 404 页面 */}
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
              <p className="text-gray-600 mb-8">页面未找到</p>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                返回首页
              </a>
            </div>
          </div>
        } />
      </Routes>
    </>
  );
};

export default App;
