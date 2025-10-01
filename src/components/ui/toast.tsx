import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast(prev => prev ? { ...prev, visible: false } : null);
    }, 3000);
  }, []);

  const getToastStyles = (type: ToastType) => {
    const baseStyles = 'fixed bottom-4 right-4 px-4 py-2 rounded-md shadow-lg transition-opacity duration-300';
    const typeStyles = {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      info: 'bg-blue-500 text-white',
      warning: 'bg-yellow-500 text-white',
    };
    return `${baseStyles} ${typeStyles[type]}`;
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast?.visible && (
        <div className={getToastStyles(toast.type)}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const toast = (message: string, type: ToastType = 'info') => {
  // This is a fallback that will be used if ToastProvider is not in the tree
  console[type === 'error' ? 'error' : 'log'](`[${type.toUpperCase()}] ${message}`);
  return { id: 'fallback' };
};
