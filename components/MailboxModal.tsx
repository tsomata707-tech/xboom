
import React from 'react';
import type { MailboxMessage } from '../types';
import MailIcon from './icons/MailIcon';

interface MailboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: MailboxMessage[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

const MailboxModal: React.FC<MailboxModalProps> = ({ isOpen, onClose, messages, onMarkAsRead, onMarkAllAsRead }) => {
    if (!isOpen) return null;

    const formatTimestamp = (timestamp: number) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString('ar-EG', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getIconForType = (type: string) => {
        if (type.includes('deposit') || type.includes('recharge')) return '💰';
        if (type.includes('withdraw')) return '💸';
        if (type.includes('win')) return '🎉';
        return 'ℹ️';
    };

    const unreadCount = messages.filter(m => !m.isRead).length;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-purple-900/40 p-6 relative game-container-animation flex flex-col" style={{height: 'min(80vh, 600px)'}} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-white transition text-2xl leading-none z-10">&times;</button>
                <div className="flex flex-col items-center justify-center mb-4">
                    <div className="flex items-center gap-3">
                        <MailIcon className="w-8 h-8 text-purple-400" />
                        <h2 className="text-3xl font-bold text-purple-400">صندوق البريد</h2>
                    </div>
                    {unreadCount > 0 && (
                         <button 
                            onClick={onMarkAllAsRead}
                            className="text-xs text-cyan-400 hover:text-cyan-300 underline mt-2"
                         >
                             تحديد الكل كمقروء
                         </button>
                    )}
                </div>
                
                <div className="flex-grow overflow-y-auto -mx-2 px-2">
                    {messages.length > 0 ? (
                        <div className="space-y-3">
                            {messages.map(msg => (
                                <div 
                                    key={msg.id} 
                                    onClick={() => !msg.isRead && onMarkAsRead(msg.id)}
                                    className={`p-4 rounded-lg border-l-4 transition-all duration-200 ${msg.isRead ? 'bg-gray-900/50 border-gray-700' : 'bg-cyan-900/30 border-cyan-500 cursor-pointer hover:bg-cyan-900/50 shadow-md'}`}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{getIconForType(msg.type)}</span>
                                                <h3 className={`text-lg ${msg.isRead ? 'font-bold text-gray-300' : 'font-black text-white'}`}>
                                                    {msg.title}
                                                    {!msg.isRead && <span className="mr-2 inline-block w-2 h-2 bg-cyan-500 rounded-full"></span>}
                                                </h3>
                                            </div>
                                            <p className={`${msg.isRead ? 'text-gray-400' : 'text-gray-200 font-medium'} mt-1`}>{msg.body}</p>
                                            {!msg.isRead && <p className="text-xs text-cyan-400 mt-2">اضغط للتحديد كمقروء</p>}
                                        </div>
                                        <p className="text-xs text-gray-500 flex-shrink-0 mt-1">{formatTimestamp(msg.timestamp)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <MailIcon className="w-16 h-16 mb-4 opacity-30"/>
                            <p className="text-lg">صندوق بريدك فارغ.</p>
                            <p className="text-sm">ستظهر الإشعارات المهمة هنا.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MailboxModal;
