
import React from 'react';
import DiamondIcon from './icons/DiamondIcon';
import UserIcon from './icons/UserIcon';
import MailIcon from './icons/MailIcon';

interface HeaderProps {
  balance: number;
  onOpenManagementModal: () => void;
  onOpenMailbox: () => void;
  unreadCount: number;
  formatNumber: (num: number) => string;
  isAdmin: boolean;
  adminView: boolean;
  onToggleView: () => void;
  userProfile: { photoURL?: string } | null;
}

// Using React.memo to prevent re-rendering when parent App component updates 
// but props relevant to Header haven't changed (e.g. during high-frequency game updates)
const Header: React.FC<HeaderProps> = React.memo(({ balance, onOpenManagementModal, onOpenMailbox, unreadCount, formatNumber, isAdmin, adminView, onToggleView, userProfile }) => {
  const renderAvatar = () => {
    const photoURL = userProfile?.photoURL;
    if (photoURL && photoURL.startsWith('http')) {
        return <img src={photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />;
    }
    if (photoURL) { // Emoji
        return <span className="text-3xl flex items-center justify-center w-10 h-10">{photoURL}</span>;
    }
    return <UserIcon className="w-6 h-6 text-gray-300" />;
  };
  
  return (
    <header className="w-full p-4 bg-gray-800/90 border border-gray-700 rounded-2xl flex justify-between items-center w-full flex-wrap gap-y-2 shadow-lg">
      {/* تم تحديث الشعار هنا */}
      <h1 className="text-3xl sm:text-4xl font-black tracking-wider flex items-center gap-2" style={{fontFamily: 'sans-serif'}}>
        <span className="xboom-gold-logo">XBOOM</span> 
        <span className="text-3xl sm:text-4xl eagle-gold-glow">🦅</span>
      </h1>
      
      <div className="flex items-center gap-2 sm:gap-4">
          {isAdmin && (
            <button
                onClick={onToggleView}
                className="flex items-center justify-center h-11 w-11 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-gray-600 transition"
                title="تبديل العرض"
            >
                <span className="text-2xl transform transition-transform hover:scale-110" aria-hidden="true">{adminView ? '🎮' : '👑'}</span>
            </button>
          )}
          <div id="onboarding-balance" className="flex items-center space-x-2 rtl:space-x-reverse px-4 py-1 bg-purple-600/20 border border-purple-500 rounded-full">
            <DiamondIcon className="w-6 h-6 text-cyan-400" />
            <span className="text-xl font-bold text-white tracking-tighter">
              {formatNumber(balance)}
            </span>
          </div>
          <button
              onClick={onOpenMailbox}
              className="relative flex items-center justify-center h-12 w-12 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-gray-600 transition"
              title="صندوق البريد"
          >
              <MailIcon className="w-6 h-6 text-gray-300"/>
              {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-gray-800">
                      {unreadCount}
                  </span>
              )}
          </button>
          <button 
            id="onboarding-management"
            onClick={onOpenManagementModal}
            className="flex items-center justify-center h-12 w-12 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-gray-600 transition hover:shadow-lg hover:shadow-purple-500/30"
          >
            {renderAvatar()}
          </button>
      </div>
    </header>
  );
});

export default Header;
