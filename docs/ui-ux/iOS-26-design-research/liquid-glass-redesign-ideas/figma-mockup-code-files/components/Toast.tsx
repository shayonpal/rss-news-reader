import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ 
  message, 
  type = 'success', 
  isVisible, 
  onClose, 
  duration = 3000 
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onClose, 300); // Match exit animation duration
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'error':
        return <X className="w-5 h-5 text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-500/30 dark:border-green-400/30';
      case 'error':
        return 'border-red-500/30 dark:border-red-400/30';
      default:
        return 'border-blue-500/30 dark:border-blue-400/30';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[60] pointer-events-none">
      <div
        className={`
          backdrop-blur-3xl bg-white/90 dark:bg-slate-800/90 rounded-2xl 
          border ${getBorderColor()} 
          shadow-2xl shadow-black/10 dark:shadow-black/30
          px-4 py-3 max-w-sm mx-auto
          transform transition-all duration-300 ease-out
          ${isVisible && !isExiting 
            ? 'translate-y-0 opacity-100 scale-100' 
            : 'translate-y-[-100%] opacity-0 scale-95'
          }
        `}
      >
        {/* Glass background layers */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-white/10 dark:from-slate-700/20 dark:via-transparent dark:to-slate-800/10" />
        
        <div className="relative flex items-center gap-3">
          {getIcon()}
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

// Toast manager context and hook
interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => prev ? { ...prev, isVisible: false } : null);
    setTimeout(() => setToast(null), 300);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}