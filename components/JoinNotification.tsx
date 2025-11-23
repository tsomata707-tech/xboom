import React, { useEffect, useState } from 'react';

interface JoinNotificationProps {
  nickname: string;
  avatar: string;
}

const JoinNotification: React.FC<JoinNotificationProps> = ({ nickname, avatar }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true); // Trigger animation on mount
    const timer = setTimeout(() => {
      setVisible(false);
    }, 3500); // The notification will be visible for 3.5s
    return () => clearTimeout(timer);
  }, []);

  const baseClasses = 'w-full p-3 rounded-lg shadow-lg flex items-center space-x-3 rtl:space-x-reverse transition-all duration-500 ease-out-quint transform';
  const typeClasses = 'bg-gray-800/80 backdrop-blur-sm border border-purple-500/50 text-white';
  const visibilityClasses = visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full rtl:translate-x-full';

  return (
    <div className={`${baseClasses} ${typeClasses} ${visibilityClasses}`}>
      <div className="text-2xl flex items-center justify-center bg-black/20 w-10 h-10 rounded-full">{avatar}</div>
      <p className="flex-1 font-semibold">
        <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">{nickname}</span>
        {' '}
        <span className="text-gray-300">انضم للعبة!</span>
      </p>
    </div>
  );
};

export default JoinNotification;
