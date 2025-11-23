import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true); // Trigger animation on mount
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // Allow time for fade-out animation
  }

  const baseClasses = 'w-full p-4 rounded-lg shadow-lg flex items-center space-x-3 rtl:space-x-reverse transition-all duration-300 ease-in-out transform';
  const typeClasses = {
    success: 'bg-green-500/80 backdrop-blur-sm border border-green-400 text-white',
    error: 'bg-red-500/80 backdrop-blur-sm border border-red-400 text-white',
    info: 'bg-cyan-500/80 backdrop-blur-sm border border-cyan-400 text-white',
  };
  const visibilityClasses = visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full rtl:-translate-x-full';

  const icons = {
      success: '✓',
      error: '!',
      info: 'i'
  }

  return (
    <div className={`${baseClasses} ${typeClasses[type]} ${visibilityClasses}`}>
      <div className="font-bold text-2xl flex items-center justify-center bg-black/20 w-8 h-8 rounded-full">{icons[type]}</div>
      <p className="flex-1 font-semibold">{message}</p>
      <button onClick={handleClose} className="text-2xl font-light opacity-70 hover:opacity-100 transition-opacity">&times;</button>
    </div>
  );
};

export default Toast;