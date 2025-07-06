import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthResponse } from '@shared/types';
import { authApi } from '@/services/api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // 初始化时检查本地存储的认证信息
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken) {
          setToken(storedToken);
          // 验证 token 并获取用户信息
          const response = await authApi.getMe();
          if (response.data.success) {
            setUser(response.data.data);
          } else {
            // Token 无效，清除本地存储
            localStorage.removeItem('auth_token');
            setToken(null);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('auth_token');
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await authApi.login({ email, password });
      
      if (response.data.success) {
        const authData: AuthResponse = response.data.data;
        setUser(authData.user);
        setToken(authData.token);
        localStorage.setItem('auth_token', authData.token);
        toast.success('登录成功！');
      } else {
        throw new Error(response.data.error || '登录失败');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '登录失败';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await authApi.register({ username, email, password });
      
      if (response.data.success) {
        const authData: AuthResponse = response.data.data;
        setUser(authData.user);
        setToken(authData.token);
        localStorage.setItem('auth_token', authData.token);
        toast.success('注册成功！');
      } else {
        throw new Error(response.data.error || '注册失败');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || '注册失败';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    toast.success('已退出登录');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
