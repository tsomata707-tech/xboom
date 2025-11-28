
import React, { useState, useCallback, useRef, useEffect } from 'react';
import DiamondIcon from './icons/DiamondIcon';
import type { TransactionRequest, SystemNotification, ProfitLogEntry } from '../types';
import { useToast } from '../AuthGate';
import { collection, query, where, getDocs, limit, setDoc, doc, Timestamp, runTransaction, getDoc, serverTimestamp } from 'firebase/firestore';
import UploadIcon from './icons/UploadIcon';
import { convertTimestamps } from './utils/convertTimestamps';

interface ActivePlayer {
    id: string; 
    email: string;
    lastActive?: number; 
}

interface SearchedPlayer {
    id: string; 
    email: string;
    displayName: string;
    playerID: string;
    balance?: number;
    isBanned?: boolean;
    photoURL?: string;
    lastActive?: number;
}

interface Announcement {
    text: string;
    timestamp: number;
}

interface ImageBanner {
    imageUrl: string;
    isActive: boolean;
}

interface AdminActionResult {
  success: boolean;
  message?: string;
}

interface AdminPanelProps {
  onRecharge: (playerId: string, amount: number) => Promise<AdminActionResult>;
  onDeduct: (playerId: string, amount: number) => Promise<AdminActionResult>;
  formatNumber: (num: number) => string;
  treasuryBalance: number | null;
  requests: TransactionRequest[];
  onProcessRequest: (request: TransactionRequest, action: 'approve' | 'reject') => void;
  processingRequestId: string | null;
  activePlayers: ActivePlayer[];
  systemNotifications: SystemNotification[];
  sendNotification: (userId: string, title: string, body: string, type: string) => Promise<void>;
  onTreasuryUpdate: (amount: number, type: 'deposit' | 'withdraw') => Promise<AdminActionResult>;
  isMaintenanceMode: boolean;
  announcement: Announcement | null;
  imageBanner: ImageBanner | null;
  profitLog: ProfitLogEntry[];
  onMarkNotificationAsRead: (id: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onPublishAnnouncement: (text: string) => Promise<boolean>;
  onStopAnnouncement: () => Promise<boolean>;
  onUpdateImageBanner: (imageUrl: string) => Promise<boolean>;
  onToggleImageBanner: (isActive: boolean) => Promise<boolean>;
  onDeleteImageBanner: () => Promise<boolean>;
  onToggleMaintenance: (isActive: boolean) => Promise<boolean>;
  onAnnounceWin: (nickname: string, amount: number, gameName: string) => void;
  totalUsers: number;
  onBanUser: (userId: string, isBanned: boolean) => Promise<boolean>;
}

const Accordion: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: number; onOpen?: () => void; }> = ({ title, children, defaultOpen = false, badge, onOpen }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const handleToggle = () => {
        const willBeOpen = !isOpen;
        setIsOpen(willBeOpen);
        if (willBeOpen && onOpen) {
            onOpen();
        }
    };

    return (
        <div className="bg-gray-900/50 rounded-2xl border border-gray-700 overflow-hidden mb-4">
            <button
                onClick={handleToggle}
                className="w-full flex justify-between items-center p-4 text-left bg-gray-800 hover:bg-gray-750 transition"
            >
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-cyan-400">{title}</h3>
                    {badge !== undefined && badge > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">{badge}</span>}
                </div>
                <svg
                    className={`w-6 h-6 text-cyan-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 border-t border-gray-700">
                    {children}
                </div>
            </div>
        </div>
    )
}

function debounce(func: (...args: any[]) => void, delay: number) {
  let timeout: number;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, delay);
  };
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
    onRecharge,
    onDeduct,
    formatNumber, 
    treasuryBalance, 
    requests, 
    onProcessRequest,
    processingRequestId,
    activePlayers,
    systemNotifications,
    sendNotification,
    onTreasuryUpdate,
    isMaintenanceMode,
    announcement,
    imageBanner,
    profitLog,
    onMarkNotificationAsRead,
    onMarkAllNotificationsRead,
    onPublishAnnouncement,
    onStopAnnouncement,
    onUpdateImageBanner,
    onToggleImageBanner,
    onDeleteImageBanner,
    onToggleMaintenance,
    onAnnounceWin,
    totalUsers,
    onBanUser,
}) => {
  // Recharge Section State
  const [rechargeSearchTerm, setRechargeSearchTerm] = useState('');
  const [rechargeTargetUser, setRechargeTargetUser] = useState<SearchedPlayer | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<number>(0);
  const [isProcessingRecharge, setIsProcessingRecharge] = useState(false);
  const [isSearchingRecharge, setIsSearchingRecharge] = useState(false);

  // General Search/User Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchedPlayer | null>(null);
  const [isProcessingUser, setIsProcessingUser] = useState(false);
  
  // Treasury Management
  const [treasuryAmount, setTreasuryAmount] = useState<number>(0); // Default 0
  const [isProcessingTreasury, setIsProcessingTreasury] = useState(false);
  
  // Announcement State
  const [announcementText, setAnnouncementText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Maintenance State
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  
  // Fake Win State
  const [winnerNickname, setWinnerNickname] = useState('');
  const [winAmount, setWinAmount] = useState(10000);
  const [winGameName, setWinGameName] = useState('ماكينة الحظ');
  const [isAnnouncingWin, setIsAnnouncingWin] = useState(false);
  
  // Banner State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const safeProfitLog = profitLog.map(log => convertTimestamps(log));
  const safeRequests = requests.map(req => convertTimestamps(req));

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    try {
        return new Date(timestamp).toLocaleString('ar-EG');
    } catch (e) {
        return 'Invalid Date';
    }
  };

  // -- Recharge Section Search --
  const handleRechargeSearch = async (term: string) => {
      if (term.trim().length < 1) { setRechargeTargetUser(null); return; }
      setIsSearchingRecharge(true);
      try {
          const usersRef = collection(db, "users");
          // Exact match for ID
          const q = query(usersRef, where("playerID", "==", term));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              setRechargeTargetUser({ id: doc.id, ...convertTimestamps(doc.data()) } as SearchedPlayer);
          } else {
              setRechargeTargetUser(null);
          }
      } catch (error) { console.error(error); setRechargeTargetUser(null); }
      setIsSearchingRecharge(false);
  };
  const debouncedRechargeSearch = useCallback(debounce(handleRechargeSearch, 500), []);

  // -- General User Management Search --
  const handleSearch = async (term: string) => {
      if (term.trim().length < 1) { setSearchResults([]); return; }
      setIsSearching(true);
      try {
          const usersRef = collection(db, "users");
          // Search by Player ID or Name
          const idQuery = query(usersRef, where("playerID", "==", term));
          const nameQuery = query(usersRef, where("displayName", ">=", term), where("displayName", "<=", term + '\uf8ff'), limit(5));
          
          const [idSnapshot, nameSnapshot] = await Promise.all([getDocs(idQuery), getDocs(nameQuery)]);
          const usersMap = new Map<string, SearchedPlayer>();
          
          const processSnapshot = (snapshot: any) => {
              snapshot.forEach((doc: any) => {
                  const data = convertTimestamps(doc.data());
                  usersMap.set(doc.id, { id: doc.id, ...data });
              });
          };
          processSnapshot(idSnapshot); 
          processSnapshot(nameSnapshot);
          
          setSearchResults(Array.from(usersMap.values()));
      } catch (error) { console.error(error); }
      setIsSearching(false);
  };
  const debouncedSearch = useCallback(debounce(handleSearch, 500), []);
  
  const handleTreasuryAction = async (type: 'deposit' | 'withdraw') => {
      const amount = Number(treasuryAmount);
      if (isNaN(amount) || amount <= 0) {
          addToast('الرجاء إدخال مبلغ صحيح للخزينة', 'error');
          return;
      }
      if (type === 'withdraw' && treasuryBalance !== null && amount > treasuryBalance) {
          addToast('رصيد الخزينة لا يكفي للسحب', 'error');
          return;
      }
      
      setIsProcessingTreasury(true);
      try {
          const result = await onTreasuryUpdate(amount, type);
          if (result.success) {
              addToast(result.message || 'تم تحديث الخزينة بنجاح', 'success');
              setTreasuryAmount(0);
          } else {
              addToast(result.message || 'فشلت العملية', 'error');
          }
      } catch (e) {
          addToast('حدث خطأ أثناء تحديث الخزينة', 'error');
      }
      setIsProcessingTreasury(false);
  };

  // User Management Handlers
  const handleBanToggle = async () => {
      if (!selectedUser) return;
      setIsProcessingUser(true);
      const newStatus = !selectedUser.isBanned;
      const success = await onBanUser(selectedUser.id, newStatus);
      if (success) {
          setSelectedUser(prev => prev ? ({ ...prev, isBanned: newStatus }) : null);
          addToast(newStatus ? 'تم حظر الحساب نهائياً' : 'تم رفع الحظر', 'success');
      }
      setIsProcessingUser(false);
  };

  // --- Recharge/Deduct Logic ---
  const handleRechargeAction = async (action: 'deposit' | 'withdraw') => {
      if (!rechargeTargetUser || rechargeAmount <= 0) {
          addToast('أدخل مبلغ صحيح', 'error');
          return;
      }
      setIsProcessingRecharge(true);
      
      let result: AdminActionResult;
      if (action === 'deposit') {
          result = await onRecharge(rechargeTargetUser.playerID, rechargeAmount);
      } else {
          result = await onDeduct(rechargeTargetUser.playerID, rechargeAmount);
      }

      if (result.success) {
          // Update local preview immediately
          setRechargeTargetUser(prev => prev ? ({
              ...prev,
              balance: (prev.balance || 0) + (action === 'deposit' ? rechargeAmount : -rechargeAmount)
          }) : null);
          addToast(result.message || 'تمت العملية بنجاح', 'success');
          setRechargeAmount(0);
      } else {
          addToast(result.message || 'فشلت العملية', 'error');
      }
      setIsProcessingRecharge(false);
  };

  // --- New Handlers ---
  const onPublishClick = async () => {
      if (!announcementText.trim()) return;
      setIsPublishing(true);
      const success = await onPublishAnnouncement(announcementText);
      setIsPublishing(false);
      if (success) {
          addToast('تم نشر الإعلان', 'success');
          setAnnouncementText('');
      }
  };

  const onStopAnnouncementClick = async () => {
      const success = await onStopAnnouncement();
      if (success) addToast('تم إيقاف الإعلان', 'info');
  };

  const onMaintenanceClick = async () => {
      setIsTogglingMaintenance(true);
      const success = await onToggleMaintenance(!isMaintenanceMode);
      setIsTogglingMaintenance(false);
      if (success) addToast(isMaintenanceMode ? 'تم تعطيل الصيانة' : 'تم تفعيل وضع الصيانة', 'success');
  };

  const handleFakeWin = async () => {
      if (!winnerNickname || winAmount <= 0) return;
      setIsAnnouncingWin(true);
      await onAnnounceWin(winnerNickname, winAmount, winGameName);
      setIsAnnouncingWin(false);
      addToast('تم إرسال إشعار الفوز الوهمي', 'success');
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
          const url = await uploadImage(file);
          if (url) {
              await onUpdateImageBanner(url);
              addToast('تم تحديث البانر', 'success');
          } else {
              addToast('فشل رفع الصورة', 'error');
          }
      } catch (error) {
          console.error(error);
          addToast('خطأ في الرفع', 'error');
      }
      setIsUploading(false);
  };

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-2xl shadow-cyan-900/20 max-w-7xl mx-auto">
        
        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-900 to-gray-900 p-4 rounded-xl border border-purple-500/30 shadow-lg">
                <h3 className="text-gray-400 text-sm font-bold mb-1">الخزينة العامة</h3>
                <div className="flex items-center gap-2">
                    <DiamondIcon className="w-6 h-6 text-cyan-400" />
                    <span className="text-2xl font-black text-white tracking-wider">{treasuryBalance !== null ? formatNumber(treasuryBalance) : '...'}</span>
                </div>
            </div>
            <div className="bg-gradient-to-br from-blue-900 to-gray-900 p-4 rounded-xl border border-blue-500/30 shadow-lg">
                <h3 className="text-gray-400 text-sm font-bold mb-1">متصل الآن 🟢</h3>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <span className="text-2xl font-black text-white">{activePlayers.length}</span>
                </div>
            </div>
            <div className="bg-gradient-to-br from-blue-800 to-gray-900 p-4 rounded-xl border border-blue-500/30 shadow-lg">
                <h3 className="text-gray-400 text-sm font-bold mb-1">إجمالي المستخدمين</h3>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">👥</span>
                    <span className="text-2xl font-black text-white">{totalUsers}</span>
                </div>
            </div>
            <div className="bg-gradient-to-br from-green-900 to-gray-900 p-4 rounded-xl border border-green-500/30 shadow-lg">
                <h3 className="text-gray-400 text-sm font-bold mb-1">أرباح اليوم</h3>
                <div className="flex items-center gap-2">
                    <span className="text-2xl">📈</span>
                    <span className="text-2xl font-black text-green-400">
                        {formatNumber(safeProfitLog.reduce((sum, log) => sum + log.amount, 0))}
                    </span>
                </div>
            </div>
        </div>

        <div className="w-full flex justify-between items-center mb-6 pb-4 border-b-2 border-cyan-500/20 flex-wrap gap-2">
            <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold text-cyan-400">لوحة التحكم</h2>
            </div>
        </div>
        
        <div className="space-y-4">
          
          {/* 1. قسم الحسابات (خزينة + شحن لاعبين) */}
          <Accordion title="الحسابات والمالية (الخزينة والشحن)" defaultOpen={true}>
              <div className="space-y-6">
                  {/* أ. إدارة الخزينة العامة */}
                  <div className="bg-gray-800/80 p-4 rounded-xl border border-yellow-600/50">
                      <h4 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                          <span>🏛️</span> إدارة الخزينة العامة
                      </h4>
                      <div className="flex flex-col md:flex-row gap-4 items-end">
                          <div className="flex-grow w-full">
                              <label className="text-sm text-gray-300 block mb-2 font-bold">إضافة/سحب أموال للنظام (تأثير مباشر على الخزينة)</label>
                              <div className="relative">
                                  <input 
                                      type="number" 
                                      value={treasuryAmount > 0 ? treasuryAmount : ''} 
                                      onChange={(e) => setTreasuryAmount(Number(e.target.value))} 
                                      placeholder="أدخل المبلغ..."
                                      className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg p-3 text-white font-bold text-lg focus:border-yellow-500 outline-none pr-12"
                                  />
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">💎</div>
                              </div>
                          </div>
                          <div className="flex gap-3 w-full md:w-auto">
                              <button 
                                  onClick={() => handleTreasuryAction('deposit')} 
                                  disabled={isProcessingTreasury || treasuryAmount <= 0}
                                  className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 px-6 rounded-lg font-bold shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2 min-w-[140px]"
                              >
                                  <span>📥</span> إيداع
                              </button>
                              <button 
                                  onClick={() => handleTreasuryAction('withdraw')} 
                                  disabled={isProcessingTreasury || treasuryAmount <= 0}
                                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 px-6 rounded-lg font-bold shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2 min-w-[140px]"
                              >
                                  <span>📤</span> سحب
                              </button>
                          </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">* الإيداع هنا يضيف ماسات للخزينة من "الهواء". السحب يحذف ماسات من الخزينة.</p>
                  </div>

                  {/* ب. شحن/خصم اللاعبين */}
                  <div className="bg-gray-800/80 p-4 rounded-xl border border-cyan-600/50">
                      <h4 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
                          <span>👤</span> شحن/خصم رصيد اللاعبين (مرتبط بالخزينة)
                      </h4>
                      
                      <div className="relative mb-4">
                          <label className="text-sm text-gray-400 block mb-2">ابحث عن لاعب (ID)</label>
                          <input 
                            type="text" 
                            placeholder="ادخل ID اللاعب..." 
                            onChange={(e) => debouncedRechargeSearch(e.target.value)} 
                            className="w-full bg-gray-900 p-3 rounded-lg border border-gray-600 focus:border-cyan-500 outline-none text-lg text-center font-mono tracking-widest" 
                          />
                          {isSearchingRecharge && <span className="absolute left-3 top-10 text-cyan-400 animate-pulse">جاري البحث...</span>}
                      </div>

                      {rechargeTargetUser ? (
                          <div className="animate-fade-in p-4 bg-gray-900 rounded-lg border-2 border-cyan-500/30">
                              <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
                                  <div className="flex items-center gap-3">
                                      {rechargeTargetUser.photoURL && <img src={rechargeTargetUser.photoURL} className="w-10 h-10 rounded-full bg-gray-700" />}
                                      <div>
                                          <p className="text-lg font-bold text-white">{rechargeTargetUser.displayName}</p>
                                          <p className="text-sm text-cyan-400 font-mono">{rechargeTargetUser.playerID}</p>
                                      </div>
                                  </div>
                                  <div className="text-center">
                                      <p className="text-xs text-gray-400">الرصيد الحالي</p>
                                      <p className="text-2xl font-black text-green-400">{formatNumber(rechargeTargetUser.balance || 0)} 💎</p>
                                  </div>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-4 items-end">
                                  <div className="w-full">
                                      <label className="text-sm text-gray-400 block mb-1">المبلغ</label>
                                      <input 
                                        type="number" 
                                        value={rechargeAmount > 0 ? rechargeAmount : ''}
                                        onChange={e => setRechargeAmount(Math.max(0, Number(e.target.value)))}
                                        className="w-full bg-black/50 border border-gray-600 rounded-lg p-3 text-center text-xl font-bold text-white focus:border-yellow-500 outline-none"
                                        placeholder="0"
                                      />
                                  </div>
                                  <div className="flex gap-2 w-full sm:w-auto">
                                      <button 
                                        onClick={() => handleRechargeAction('deposit')}
                                        disabled={isProcessingRecharge || rechargeAmount <= 0}
                                        className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition disabled:opacity-50 min-w-[120px]"
                                      >
                                          {isProcessingRecharge ? '...' : '➕ شحن'}
                                      </button>
                                      <button 
                                        onClick={() => handleRechargeAction('withdraw')}
                                        disabled={isProcessingRecharge || rechargeAmount <= 0}
                                        className="flex-1 sm:flex-none bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition disabled:opacity-50 min-w-[120px]"
                                      >
                                          {isProcessingRecharge ? '...' : '➖ خصم'}
                                      </button>
                                  </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-3 text-center bg-black/20 p-2 rounded">
                                  ℹ️ تنبيه: عملية الشحن تزيد رصيد اللاعب وتزيد رصيد الخزينة. عملية الخصم تنقص رصيد اللاعب وتنقص رصيد الخزينة.
                              </p>
                          </div>
                      ) : (
                          rechargeSearchTerm && !isSearchingRecharge && <p className="text-center text-red-400 mt-2">لم يتم العثور على لاعب بهذا الـ ID.</p>
                      )}
                  </div>
              </div>
          </Accordion>

          {/* 2. قسم إدارة اللاعبين (حظر/بحث) */}
          <Accordion title="إدارة اللاعبين (حظر وتعديل)">
              <div className="flex flex-col gap-4 bg-gray-800 p-4 rounded-xl">
                  <div className="relative">
                      <input 
                        type="text" 
                        placeholder="بحث عن لاعب (ID أو الاسم)..." 
                        onChange={(e) => { setSearchTerm(e.target.value); debouncedSearch(e.target.value); }} 
                        className="w-full bg-gray-900 p-3 rounded-xl border border-gray-600 focus:border-purple-500 outline-none" 
                      />
                  </div>
                  
                  {isSearching && <p className="text-center text-cyan-400">جاري البحث...</p>}

                  {searchResults.length > 0 && (
                      <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
                          {searchResults.map(p => (
                              <div key={p.id} className="p-4 border-b border-gray-700 last:border-0 hover:bg-gray-800 flex justify-between items-center transition">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                                          {p.photoURL?.startsWith('http') ? <img src={p.photoURL} className="w-full h-full rounded-full object-cover"/> : '👤'}
                                      </div>
                                      <div>
                                          <p className="font-bold text-white flex items-center gap-2">
                                              {p.displayName}
                                              {p.isBanned && <span className="bg-red-600 text-white text-[10px] px-2 rounded">محظور</span>}
                                          </p>
                                          <p className="text-sm text-cyan-400 font-mono">{p.playerID}</p>
                                          <p className="text-xs text-gray-500">{p.email}</p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => setSelectedUser(p)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition text-sm"
                                  >
                                      إدارة
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* نافذة إدارة اللاعب المنبثقة */}
                  {selectedUser && (
                      <div className="bg-black/40 border-2 border-purple-500 rounded-xl p-6 mt-4 animate-fade-in relative">
                          <button onClick={() => setSelectedUser(null)} className="absolute top-4 left-4 text-gray-400 hover:text-white text-xl">&times;</button>
                          
                          <div className="flex items-center gap-4 mb-6">
                              <div className="w-16 h-16 bg-gray-700 rounded-full overflow-hidden border-2 border-purple-400 flex items-center justify-center text-2xl">
                                  {selectedUser.photoURL?.startsWith('http') ? <img src={selectedUser.photoURL} className="w-full h-full object-cover"/> : '👤'}
                              </div>
                              <div>
                                  <h3 className="text-2xl font-bold text-white">{selectedUser.displayName}</h3>
                                  <p className="text-cyan-400 font-mono tracking-wider">{selectedUser.playerID}</p>
                                  <p className="text-green-400 font-bold text-sm mt-1">الرصيد: {formatNumber(selectedUser.balance || 0)}</p>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                              <button 
                                onClick={handleBanToggle} 
                                disabled={isProcessingUser}
                                className={`w-full py-3 rounded-lg font-bold text-white transition flex items-center justify-center gap-2 ${selectedUser.isBanned ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                              >
                                  {selectedUser.isBanned ? '✅ رفع الحظر وتمكين الدخول' : '⛔ حظر الحساب ومنع الدخول'}
                              </button>
                              <p className="text-xs text-gray-400 text-center mt-1">
                                  عند الحظر، لن يتمكن اللاعب من تسجيل الدخول وسيظهر له إشعار بمراجعة الإدارة.
                              </p>
                          </div>
                      </div>
                  )}
              </div>
          </Accordion>

          {/* 3. الطلبات المعلقة */}
          <Accordion title="الطلبات المعلقة" badge={safeRequests.length} defaultOpen={safeRequests.length > 0}>
              <div className="grid grid-cols-1 gap-3">
                  {safeRequests.map(req => (
                      <div key={req.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md hover:border-cyan-500 transition-colors">
                          <div className="text-center sm:text-right">
                              <p className="font-bold text-lg text-white mb-1">{req.userEmail}</p>
                              <p className="text-sm text-gray-400 font-mono">{req.id}</p>
                              <p className={`font-bold mt-1 ${req.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                                  {req.type === 'deposit' ? '📥 إيداع' : '📤 سحب'} {formatNumber(req.amount)} 💎
                              </p>
                          </div>
                          <div className="flex gap-3 w-full sm:w-auto">
                              <button onClick={() => onProcessRequest(req, 'approve')} disabled={processingRequestId === req.id} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg disabled:opacity-50">موافقة</button>
                              <button onClick={() => onProcessRequest(req, 'reject')} disabled={processingRequestId === req.id} className="flex-1 sm:flex-none bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg disabled:opacity-50">رفض</button>
                          </div>
                      </div>
                  ))}
                  {safeRequests.length === 0 && <p className="text-center text-gray-500 py-4">لا توجد طلبات معلقة.</p>}
              </div>
          </Accordion>

          {/* 4. الإعلانات والنظام */}
          <Accordion title="الإعلانات والنظام">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Text Announcement */}
                  <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                      <h4 className="text-lg font-bold text-yellow-400 mb-3">الشريط الإخباري</h4>
                      <textarea 
                          value={announcementText}
                          onChange={e => setAnnouncementText(e.target.value)}
                          placeholder="اكتب نص الإعلان المتحرك هنا..."
                          className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white mb-3 focus:border-yellow-500 outline-none h-24"
                      />
                      <div className="flex gap-2">
                          <button onClick={onPublishClick} disabled={isPublishing || !announcementText} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg font-bold disabled:opacity-50">
                              {isPublishing ? 'جاري النشر...' : 'نشر الإعلان'}
                          </button>
                          <button onClick={onStopAnnouncementClick} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-bold">
                              إيقاف
                          </button>
                      </div>
                      {announcement?.text && (
                          <p className="mt-2 text-xs text-gray-400">الحالي: {announcement.text}</p>
                      )}
                  </div>

                  {/* Image Banner */}
                  <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                      <h4 className="text-lg font-bold text-blue-400 mb-3">البانر الإعلاني (صورة)</h4>
                      <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={handleBannerUpload}
                          accept="image/*"
                          className="hidden" 
                      />
                      <div className="flex flex-col gap-3">
                          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                              <UploadIcon className="w-5 h-5"/>
                              {isUploading ? 'جاري الرفع...' : 'رفع صورة جديدة'}
                          </button>
                          
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => onToggleImageBanner(!imageBanner?.isActive)} 
                                  className={`flex-1 py-2 rounded-lg font-bold text-white ${imageBanner?.isActive ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'}`}
                              >
                                  {imageBanner?.isActive ? 'إخفاء البانر' : 'إظهار البانر'}
                              </button>
                              <button onClick={onDeleteImageBanner} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold">
                                  حذف
                              </button>
                          </div>
                          
                          {imageBanner?.imageUrl && (
                              <div className="mt-2 relative h-24 bg-black rounded-lg overflow-hidden border border-gray-600">
                                  <img src={imageBanner.imageUrl} alt="banner preview" className="w-full h-full object-cover opacity-70" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${imageBanner.isActive ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                                          {imageBanner.isActive ? 'نشط' : 'غير نشط'}
                                      </span>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Fake Win */}
                  <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                      <h4 className="text-lg font-bold text-purple-400 mb-3">إشعار فوز وهمي 🏆</h4>
                      <div className="space-y-2 mb-3">
                          <input type="text" value={winnerNickname} onChange={e => setWinnerNickname(e.target.value)} placeholder="اسم اللاعب (مثال: الملك)" className="w-full bg-gray-900 p-2 rounded border border-gray-600" />
                          <input type="number" value={winAmount} onChange={e => setWinAmount(Number(e.target.value))} placeholder="المبلغ" className="w-full bg-gray-900 p-2 rounded border border-gray-600" />
                          <input type="text" value={winGameName} onChange={e => setWinGameName(e.target.value)} placeholder="اسم اللعبة" className="w-full bg-gray-900 p-2 rounded border border-gray-600" />
                      </div>
                      <button onClick={handleFakeWin} disabled={isAnnouncingWin} className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold disabled:opacity-50">
                          إذاعة الفوز
                      </button>
                  </div>

                  {/* Maintenance Mode */}
                  <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex flex-col justify-between">
                      <div>
                          <h4 className="text-lg font-bold text-red-400 mb-2">وضع الصيانة 🛠️</h4>
                          <p className="text-sm text-gray-400 mb-4">عند تفعيل هذا الوضع، لن يتمكن المستخدمون العاديون من الدخول للتطبيق.</p>
                      </div>
                      <button 
                          onClick={onMaintenanceClick} 
                          disabled={isTogglingMaintenance}
                          className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${isMaintenanceMode ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-green-600 hover:bg-green-500'}`}
                      >
                          {isTogglingMaintenance ? 'جاري التغيير...' : (isMaintenanceMode ? '⚠️ إيقاف وضع الصيانة' : 'تفعيل وضع الصيانة')}
                      </button>
                  </div>

              </div>
          </Accordion>

          {/* 5. Profit Log */}
          <Accordion title="سجل الأرباح (اليوم)" badge={safeProfitLog.length}>
               <div className="max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  <table className="w-full text-sm text-right text-gray-300">
                      <thead className="text-xs text-cyan-300 uppercase bg-gray-900 sticky top-0">
                          <tr><th className="py-3 px-2">الوقت</th><th className="py-3 px-2">المصدر</th><th className="py-3 px-2">الربح</th></tr>
                      </thead>
                      <tbody>
                          {safeProfitLog.map(log => (
                              <tr key={log.id} className="border-b border-gray-700 bg-gray-800/50 hover:bg-gray-800">
                                  <td className="px-4 py-3">{formatTimestamp(log.timestamp).split(',')[1]}</td>
                                  <td className="px-4 py-3">{log.userEmail}</td>
                                  <td className="px-4 py-3 text-green-400 font-bold">{formatNumber(log.amount)}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Accordion>
        </div>
    </div>
  );
};

export default AdminPanel;
