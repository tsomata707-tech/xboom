
import React from 'react';
import DiamondIcon from './icons/DiamondIcon';
import UserIcon from './icons/UserIcon';
import MailIcon from './icons/MailIcon';
import WalletIcon from './icons/WalletIcon';

interface HeaderProps {
  balance: number;
  onOpenManagementModal: () => void;
  onOpenMailbox: () => void;
  onOpenWallet: () => void;
  unreadCount: number;
  formatNumber: (num: number) => string;
  isAdmin: boolean;
  adminView: boolean;
  onToggleView: () => void;
  userProfile: { photoURL?: string; displayName?: string; playerID?: string } | null;
}

const Header: React.FC<HeaderProps> = React.memo(({ balance, onOpenManagementModal, onOpenMailbox, onOpenWallet, unreadCount, formatNumber, isAdmin, adminView, onToggleView, userProfile }) => {
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
    <header className="w-full p-3 bg-gray-800/90 border border-gray-700 rounded-2xl flex flex-wrap justify-between items-center gap-y-2 shadow-lg sticky top-0 z-50 backdrop-blur-md">
      {/* Logo & User Info */}
      <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider flex items-center gap-1" style={{fontFamily: 'sans-serif'}}>
            <span className="xboom-gold-logo">XBOOM</span> 
            <span className="text-2xl sm:text-3xl eagle-gold-glow">🦅</span>
          </h1>
          
          {userProfile && (
            <div className="hidden sm:flex flex-col text-xs text-gray-400 border-r border-gray-600 pr-3 mr-1">
                <span className="font-bold text-white truncate max-w-[100px]">{userProfile.displayName}</span>
                <span className="font-mono">{userProfile.playerID}</span>
            </div>
          )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
          {isAdmin && (
            <button
                onClick={onToggleView}
                className="flex items-center justify-center h-10 w-10 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-gray-600 transition gold-ring-pulse relative"
                title="تبديل العرض"
            >
                <span className="text-xl" aria-hidden="true">{adminView ? '🎮' : '👑'}</span>
            </button>
          )}

          <div id="onboarding-balance" className="flex items-center space-x-1 rtl:space-x-reverse px-3 py-1 bg-black/30 border border-purple-500/50 rounded-full h-10">
            <DiamondIcon className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-white tracking-tighter">
              {formatNumber(balance)}
            </span>
          </div>

          <button
              onClick={onOpenWallet}
              className="flex items-center justify-center h-10 w-10 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-purple-600 hover:border-purple-400 transition group"
              title="المحفظة"
          >
              <WalletIcon className="w-5 h-5 text-purple-400 group-hover:text-white"/>
          </button>

          <button
              onClick={onOpenMailbox}
              className="relative flex items-center justify-center h-10 w-10 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-gray-600 transition"
              title="صندوق البريد"
          >
              <MailIcon className="w-5 h-5 text-gray-300"/>
              {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-gray-800">
                      {unreadCount}
                  </span>
              )}
          </button>

          <button 
            id="onboarding-management"
            onClick={onOpenManagementModal}
            className="flex items-center justify-center h-10 w-10 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-gray-600 transition hover:shadow-lg hover:shadow-purple-500/30"
          >
            {renderAvatar()}
          </button>
      </div>
    </header>
  );
});

export default Header;
