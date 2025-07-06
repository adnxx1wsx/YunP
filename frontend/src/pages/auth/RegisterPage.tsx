import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Helmet } from 'react-helmet-async';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser } = useAuth();
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data.username, data.email, data.password);
    } catch (error) {
      // 错误已在 AuthContext 中处理
    }
  };

  return (
    <>
      <Helmet>
        <title>注册 - YunP</title>
        <meta name="description" content="创建您的 YunP 云盘账户" />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            创建新账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            已有账户？{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              立即登录
            </Link>
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Input
              label="用户名"
              type="text"
              autoComplete="username"
              placeholder="请输入用户名"
              error={errors.username?.message}
              {...register('username', {
                required: '请输入用户名',
                minLength: {
                  value: 3,
                  message: '用户名至少需要3个字符',
                },
                maxLength: {
                  value: 30,
                  message: '用户名不能超过30个字符',
                },
                pattern: {
                  value: /^[a-zA-Z0-9]+$/,
                  message: '用户名只能包含字母和数字',
                },
              })}
            />
          </div>

          <div>
            <Input
              label="邮箱地址"
              type="email"
              autoComplete="email"
              placeholder="请输入您的邮箱地址"
              error={errors.email?.message}
              {...register('email', {
                required: '请输入邮箱地址',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: '请输入有效的邮箱地址',
                },
              })}
            />
          </div>

          <div>
            <div className="relative">
              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="请输入密码"
                error={errors.password?.message}
                {...register('password', {
                  required: '请输入密码',
                  minLength: {
                    value: 6,
                    message: '密码至少需要6个字符',
                  },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: '密码必须包含至少一个小写字母、一个大写字母和一个数字',
                  },
                })}
              />
              <button
                type="button"
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <div className="relative">
              <Input
                label="确认密码"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="请再次输入密码"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  required: '请确认密码',
                  validate: (value) =>
                    value === password || '两次输入的密码不一致',
                })}
              />
              <button
                type="button"
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="agree-terms"
              name="agree-terms"
              type="checkbox"
              required
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="agree-terms" className="ml-2 block text-sm text-gray-900">
              我同意{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                服务条款
              </a>{' '}
              和{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500">
                隐私政策
              </a>
            </label>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? '注册中...' : '创建账户'}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            注册即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </>
  );
};

export default RegisterPage;
