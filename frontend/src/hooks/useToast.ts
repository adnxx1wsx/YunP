import { useState, useCallback } from 'react';
import { ToastType } from '@/components/ui/Toast';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastOptions {
  message?: string;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, options?: ToastOptions) => {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    const toast: Toast = {
      id,
      type,
      title,
      message: options?.message,
      duration: options?.duration ?? 5000
    };

    setToasts(prev => [...prev, toast]);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((title: string, options?: ToastOptions) => {
    return addToast('success', title, options);
  }, [addToast]);

  const error = useCallback((title: string, options?: ToastOptions) => {
    return addToast('error', title, options);
  }, [addToast]);

  const warning = useCallback((title: string, options?: ToastOptions) => {
    return addToast('warning', title, options);
  }, [addToast]);

  const info = useCallback((title: string, options?: ToastOptions) => {
    return addToast('info', title, options);
  }, [addToast]);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    clear
  };
};
