import React, { useState, useEffect } from 'react';
import WalletIcon from './icons/WalletIcon';
import CopyIcon from './icons/CopyIcon';
import CheckIcon from './icons/CheckIcon';
import UserIcon from './icons/UserIcon';

interface ManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenWallet: () => void;
    onOpenAgentsModal: () => void;
    onOpenAvatarModal: () => void;
    onLogout: () => void;
    isAdmin: boolean;
    userProfile: {
        displayName: string;
        email?: string;
        playerID?: string;
        photoURL?: string;
        lastNameChange?: number;
    } | null;
    onDisplayNameChange: (newName: string) => Promise<boolean>;
}

const ManagementModal: React.FC<ManagementModalProps> = ({ 
    isOpen, onClose, onOpenWallet, onOpenAgentsModal, onOpenAvatarModal, onLogout, isAdmin, userProfile, onDisplayNameChange
}) => {
    
    const [copied, setCopied] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editableName, setEditableName] = useState(userProfile?.displayName || '');
    const [isSavingName, setIsSavingName] = useState(false);
    const [isCooldownActive, setIsCooldownActive] = useState(false);
    const [daysRemaining, setDaysRemaining] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setEditableName(userProfile?.displayName || '');
            setIsEditingName(false);

            // Calculate cooldown status
            if (userProfile?.lastNameChange) {
                const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000;
                const cooldownEndsAt = userProfile.lastNameChange + thirtyDaysInMillis;
                const now = Date.now();
                if (now < cooldownEndsAt) {
                    setIsCooldownActive(true);
                    setDaysRemaining(Math.ceil((cooldownEndsAt - now) / (1000 * 60 * 60 * 24)));
                } else {
                    setIsCooldownActive(false);
                }
            } else {
                setIsCooldownActive(false); // No record of last change, so they can change it.
            }
        }
    }, [isOpen, userProfile]);

    if (!isOpen) return null;
    
    const whatsappMessage = encodeURIComponent(`مرحباً، أحتاج إلى مساعدة بخصوص حسابي: ${userProfile?.email}`);
    
    const handleCopy = () => {
        if (!userProfile?.playerID) return;
        navigator.clipboard.writeText(userProfile.playerID).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleNameSave = async () => {
        if (editableName.trim() === userProfile?.displayName) {
            setIsEditingName(false);
            return;
        };
        setIsSavingName(true);
        const success = await onDisplayNameChange(editableName);
        setIsSavingName(false);
        if (success) {
            setIsEditingName(false);
        }
    };
    
    const handleCancelEdit = () => {
        setEditableName(userProfile?.displayName || '');
        setIsEditingName(false);
    };

    const renderAvatar = () => {
        if (userProfile?.photoURL && userProfile.photoURL.startsWith('http')) {
            return <img src={userProfile.photoURL} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />;
        }
        if (userProfile?.photoURL) { // Emoji
            return <span className="text-6xl flex items-center justify-center w-20 h-20 bg-gray-700 rounded-full">{userProfile.photoURL}</span>;
        }
        return (
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center">
                <UserIcon className="w-10 h-10 text-gray-400" />
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-sm shadow-2xl shadow-purple-900/40 p-6 relative game-container-animation" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
                
                <div className="flex flex-col items-center mb-6">
                    {renderAvatar()}
                    
                    {isEditingName ? (
                         <div className="flex items-stretch gap-2 mt-3 w-full max-w-xs">
                            <input
                                type="text"
                                value={editableName}
                                onChange={(e) => setEditableName(e.target.value)}
                                className="flex-grow bg-gray-900 border-2 border-gray-600 rounded-lg py-1 px-2 text-xl font-bold text-white text-center focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                aria-label="Edit nickname"
                                maxLength={20}
                            />
                            <button onClick={handleNameSave} disabled={isSavingName || editableName.trim() === ''} className="px-3 bg-cyan-600 rounded-lg hover:bg-cyan-500 transition disabled:opacity-50">
                                {isSavingName ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "حفظ"}
                            </button>
                             <button onClick={handleCancelEdit} disabled={isSavingName} className="px-3 bg-gray-600 rounded-lg hover:bg-gray-500 transition disabled:opacity-50">
                                &#x2715;
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mt-3">
                            <h2 className="text-2xl nickname-gold">{userProfile?.displayName}</h2>
                            <button 
                                onClick={() => setIsEditingName(true)} 
                                disabled={isCooldownActive}
                                className="p-1 text-gray-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isCooldownActive ? `يمكنك التغيير بعد ${daysRemaining} يوم` : 'تعديل اللقب'}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    )}

                    {isCooldownActive && !isEditingName && (
                        <p className="text-xs text-center text-yellow-400 bg-yellow-900/50 px-2 py-1 rounded-md mt-2">
                            يمكنك تغيير لقبك مرة أخرى بعد {daysRemaining} يومًا.
                        </p>
                    )}

                    <p className="text-sm text-gray-400">{userProfile?.email}</p>
                    
                    {userProfile?.playerID && (
                        <div className="mt-4 bg-gray-900/50 rounded-lg p-2 w-full max-w-xs">
                            <p className="text-gray-400 text-xs text-center">ID اللاعب الخاص بك</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-lg font-bold text-cyan-400 tracking-widest">{userProfile.playerID}</span>
                                <button onClick={handleCopy} title="نسخ الـ ID" className="p-1 bg-gray-700 rounded-md hover:bg-gray-600">
                                    {copied ? <CheckIcon className="h-4 w-4 text-green-400"/> : <CopyIcon className="h-4 w-4 text-gray-300"/>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                     <button onClick={onOpenAvatarModal} className="w-full flex items-center gap-4 px-4 py-3 text-lg text-gray-200 bg-gray-900/50 rounded-lg hover:bg-gray-700 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span>تغيير الصورة الرمزية</span>
                    </button>
                    <button onClick={onOpenWallet} className="w-full flex items-center gap-4 px-4 py-3 text-lg text-gray-200 bg-gray-900/50 rounded-lg hover:bg-gray-700 transition">
                        <WalletIcon className="w-6 h-6 text-purple-400"/>
                        <span>المحفظة</span>
                    </button>
                    <button onClick={onOpenAgentsModal} className="w-full flex items-center gap-4 px-4 py-3 text-lg text-gray-200 bg-gray-900/50 rounded-lg hover:bg-gray-700 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                        <span>وكلاء الشحن</span>
                    </button>
                    <a href={`https://wa.me/201055455403?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-4 px-4 py-3 text-lg text-gray-200 bg-gray-900/50 rounded-lg hover:bg-gray-700 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>خدمة العملاء</span>
                    </a>
                    <div className="border-t border-gray-700 my-2 !mt-4"></div>
                     <button onClick={() => { onLogout(); onClose(); }} className="w-full flex items-center gap-4 px-4 py-3 text-lg text-red-400 bg-gray-900/50 rounded-lg hover:bg-red-900/30 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span>تسجيل الخروج</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManagementModal;