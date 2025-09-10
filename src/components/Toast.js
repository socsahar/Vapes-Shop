'use client';

import { useState, useEffect } from 'react';

// Toast notification component
export function Toast({ message, type = 'info', isVisible, onClose, duration = 4000 }) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getToastStyles = () => {
    const baseStyles = "fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-sm p-4 rounded-lg shadow-lg transition-all duration-300 ease-in-out";
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-gradient-to-r from-green-500 to-green-600 text-white border-l-4 border-green-300`;
      case 'error':
        return `${baseStyles} bg-gradient-to-r from-red-500 to-red-600 text-white border-l-4 border-red-300`;
      case 'warning':
        return `${baseStyles} bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-l-4 border-yellow-300`;
      default:
        return `${baseStyles} bg-gradient-to-r from-blue-500 to-blue-600 text-white border-l-4 border-blue-300`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={getToastStyles()}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{getIcon()}</span>
        <div className="flex-1">
          <p className="text-sm font-medium leading-relaxed" dir="rtl">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors duration-200 ml-2"
          aria-label="Close notification"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Toast context and hook for managing toasts globally
import { createContext, useContext } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const newToast = { id, message, type, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            isVisible={true}
            onClose={() => removeToast(toast.id)}
            duration={0} // Handled by provider
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Simple function to show toast without context (for compatibility)
export function showToast(message, type = 'info') {
  // Create a temporary toast element
  const toastId = 'toast-' + Date.now();
  const toastContainer = document.createElement('div');
  toastContainer.id = toastId;
  toastContainer.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: auto;
  `;
  document.body.appendChild(toastContainer);

  const toast = document.createElement('div');
  toast.className = getToastClassName(type);
  toast.style.cssText = `
    transform: translateY(-100%);
    transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
    opacity: 0;
  `;
  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <span style="font-size: 18px;">${getToastIcon(type)}</span>
      <div style="flex: 1;">
        <p style="font-size: 14px; font-weight: 500; line-height: 1.4; margin: 0;" dir="rtl">${message}</p>
      </div>
      <button onclick="document.getElementById('${toastId}').remove()" style="
        background: none; 
        border: none; 
        color: white; 
        cursor: pointer; 
        padding: 0; 
        margin-left: 8px;
        opacity: 0.8;
        transition: opacity 0.2s;
      " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
        <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 100);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.transform = 'translateY(-100%)';
    toast.style.opacity = '0';
    setTimeout(() => {
      const element = document.getElementById(toastId);
      if (element) element.remove();
    }, 300);
  }, 4000);
}

function getToastClassName(type) {
  const baseStyles = "max-width: 400px; padding: 16px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border-left: 4px solid;";
  
  switch (type) {
    case 'success':
      return baseStyles + " background: linear-gradient(135deg, #10b981, #059669); color: white; border-left-color: #34d399;";
    case 'error':
      return baseStyles + " background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border-left-color: #f87171;";
    case 'warning':
      return baseStyles + " background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border-left-color: #fbbf24;";
    default:
      return baseStyles + " background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border-left-color: #60a5fa;";
  }
}

function getToastIcon(type) {
  switch (type) {
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    default:
      return 'ℹ️';
  }
}