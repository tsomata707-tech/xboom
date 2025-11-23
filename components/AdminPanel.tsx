
import React, { useState, useCallback, useRef, useEffect } from 'react';
import DiamondIcon from './icons/DiamondIcon';
import type { TransactionRequest, SystemNotification, ProfitLogEntry } from '../types';
import { useToast } from '../AuthGate';
import { db, storage, uploadImage } from '../firebase';
import { collection, query, where, getDocs, limit, setDoc, doc, Timestamp, runTransaction, getDoc, serverTimestamp } from 'firebase/firestore';
import UploadIcon from './icons/UploadIcon';

interface ActivePlayer {
    id: string; // UID
    email: string;
}

interface SearchedPlayer {
    id: string; // UID
    email: string;
    displayName: string;
    playerID: string;
}

interface Announcement {
    text: string;
    timestamp: number;
}

interface ImageBanner {
    imageUrl: string;
    isActive: boolean;
}

interface AdminPanelProps {
  onRecharge: (playerId: string, amount: number) => Promise<boolean>;
  formatNumber: (num: number) => string;
  treasuryBalance: number | null;
  requests: TransactionRequest[];
  onProcessRequest: (request: TransactionRequest, action: 'approve' | 'reject') => void;
  processingRequestId: string | null;
  activePlayers: ActivePlayer[];
  systemNotifications: SystemNotification[];
  sendNotification: (userId: string, title: string, body: string, type: string) => Promise<void>;
  onTreasuryTopUp: (amount: number) => Promise<boolean>;
  isMaintenanceMode: boolean;
  announcement: Announcement | null;
  imageBanner: ImageBanner | null;
  profitLog: ProfitLogEntry[];
  onMarkNotificationAsRead: (id: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
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
        <div className="bg-gray-900/50 rounded-2xl border border-gray-700 overflow-hidden">
            <button
                onClick={handleToggle}
                className="w-full flex justify-between items-center p-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-cyan-400">{title}</h3>
                    {badge !== undefined && badge > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{badge}</span>}
                </div>
                <svg
                    className={`w-6 h-6 text-cyan-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-6 pt-2">
                    {children}
                </div>
            </div>
        </div>
    )
}

// دالة مساعدة لعمل "debounce" - تأخير تنفيذ دالة البحث أثناء الكتابة
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
    formatNumber, 
    treasuryBalance, 
    requests, 
    onProcessRequest,
    processingRequestId,
    activePlayers,
    systemNotifications,
    sendNotification,
    onTreasuryTopUp,
    isMaintenanceMode,
    announcement,
    imageBanner,
    profitLog,
    onMarkNotificationAsRead,
    onMarkAllNotificationsRead,
}) => {
  // حالة لإدارة مدخلات الشحن المباشر
  const [playerId, setPlayerId] = useState('');
  const [amount, setAmount] = useState<number>(1000);
  const [isRecharging, setIsRecharging] = useState(false);
  
  // حالة لإدارة البحث عن اللاعبين
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchedPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // حالة لإدارة الخزنة
  const [treasuryTopUpAmount, setTreasuryTopUpAmount] = useState<number>(10000);
  const [isToppingUp, setIsToppingUp] = useState(false);
  
  // حالة لإدارة الإعلانات النصية والصيانة
  const [announcementText, setAnnouncementText] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
  const [isStoppingAnnouncement, setIsStoppingAnnouncement] = useState(false);

  // حالة لإدارة إعلانات الفوز الوهمية
  const [winnerNickname, setWinnerNickname] = useState('');
  const [winAmount, setWinAmount] = useState(10000);
  const [winGameName, setWinGameName] = useState('ماكينة الحظ');
  const [isAnnouncingWin, setIsAnnouncingWin] = useState(false);
  
  // حالة لإدارة البنر الصوري
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // رابط مؤقت لمعاينة الصورة
  const [isUploading, setIsUploading] = useState(false);
  const [isTogglingBanner, setIsTogglingBanner] = useState(false);
  const [isDeletingBanner, setIsDeletingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // حالة لإدارة "قراءة" سجل الأرباح
  const [viewedProfitLogIds, setViewedProfitLogIds] = useState(new Set<string>());
  
  const { addToast } = useToast();

  const gameDisplayNames: Record<string, string> = {
    xboom: 'Xboom',
    chickenRoad: 'طريق الدجاج',
    coinFlip: 'ملك وكتابة',
    greedyGame: 'سوق الخضار',
    dragonKing: 'تنين وملك',
    crashGame: 'لعبة الصاروخ',
    stockMarketGame: 'بورصة اكس بوم',
    highLow: 'أعلى أم أدنى',
    slotMachine: 'ماكينة الحظ',
    guessColor: 'خمن اللون',
    diceRoll: 'رمي النرد',
    rockPaperScissors: 'حجر ورقة مقص',
    cardDraw: 'سحب البطاقة',
    findTheBox: 'اكتشف الصندوق',
    numberGuess: 'خمن الرقم',
    plinko: 'لعبة بلينكو',
    luckyWheel: 'عجلة الحظ',
  };
  
  // حساب الأرباح الجديدة التي لم يتم عرضها بعد
  const newProfitLogs = profitLog.filter(log => !viewedProfitLogIds.has(log.id));

  const getFirebaseErrorMessage = (error: any, defaultMessage: string): string => {
    if (error?.code === 'permission-denied') {
        return `${defaultMessage}: أذونات غير كافية. تأكد من أنك مسؤول وأن قواعد الأمان صحيحة.`;
    }
    return error.message || defaultMessage;
  };
  
  useEffect(() => {
    // تنظيف رابط المعاينة المؤقت عند تفكيك المكون لمنع تسرب الذاكرة
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // دالة البحث عن اللاعبين
  const handleSearch = async (term: string) => {
      if (term.trim().length < 1) {
          setSearchResults([]);
          return;
      }
      setIsSearching(true);
      try {
          const usersRef = collection(db, "users");
          
          // استعلام للبحث عن طريق playerID
          const idQuery = query(usersRef, 
              where("playerID", ">=", term), 
              where("playerID", "<=", term + '\uf8ff'), 
              limit(5)
          );
          
          // استعلام للبحث عن طريق displayName (اللقب)
          const nameQuery = query(usersRef, 
              where("displayName", ">=", term), 
              where("displayName", "<=", term + '\uf8ff'), 
              limit(5)
          );

          // تنفيذ الاستعلامين معاً لتحسين الأداء
          const [idSnapshot, nameSnapshot] = await Promise.all([
              getDocs(idQuery),
              getDocs(nameQuery)
          ]);

          // استخدام Map لمنع تكرار النتائج إذا تطابق البحث في كلا الحقلين
          const usersMap = new Map<string, SearchedPlayer>();

          const processSnapshot = (snapshot: typeof idSnapshot) => {
              snapshot.forEach((doc) => {
                  if (!usersMap.has(doc.id)) {
                      const data = doc.data();
                      if (data.playerID) {
                          usersMap.set(doc.id, { id: doc.id, email: data.email, displayName: data.displayName, playerID: data.playerID });
                      }
                  }
              });
          };
          
          processSnapshot(idSnapshot);
          processSnapshot(nameSnapshot);
          
          setSearchResults(Array.from(usersMap.values()));

      } catch (error) {
          console.error("Error searching players:", error);
          addToast("فشل البحث عن اللاعبين.", "error");
      }
      setIsSearching(false);
  };

  // إنشاء نسخة "debounced" من دالة البحث لتشغيلها بعد توقف المستخدم عن الكتابة
  const debouncedSearch = useCallback(debounce(handleSearch, 500), []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const term = e.target.value;
      setSearchTerm(term);
      debouncedSearch(term);
  };
  
  // دالة لاختيار لاعب من نتائج البحث
  const selectPlayer = (player: SearchedPlayer) => {
    setPlayerId(player.playerID);
    setSearchTerm(''); // إفراغ حقل البحث
    setSearchResults([]); // إخفاء قائمة النتائج
  };

  // معالج النقر على زر "شحن الآن"
  const handleRechargeClick = async () => {
    if (amount <= 0 || !playerId) {
      addToast('الرجاء إدخال ID لاعب ومبلغ صالح.', 'error');
      return;
    }
    setIsRecharging(true);
    const success = await onRecharge(playerId, amount);
    setIsRecharging(false);
    if (success) {
      addToast(`تم شحن ${amount.toLocaleString()} 💎 للاعب صاحب ID ${playerId} بنجاح!`, 'success');
      setPlayerId('');
      setAmount(1000);
    } 
  };
  
  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('ar-EG');
  };

  const handleTreasuryTopUpClick = async () => {
      setIsToppingUp(true);
      const success = await onTreasuryTopUp(treasuryTopUpAmount);
      setIsToppingUp(false);
      if (success) {
          setTreasuryTopUpAmount(10000);
      }
  };

  // دالة لنشر إعلان نصي متحرك في التطبيق
  const handlePublishAnnouncement = async () => {
      if (!announcementText.trim()) {
          addToast('لا يمكن نشر إعلان فارغ.', 'error');
          return;
      }
      setIsPublishing(true);
      try {
          const announcementRef = doc(db, 'public', 'announcement');
          await setDoc(announcementRef, {
              text: announcementText.trim(),
              timestamp: serverTimestamp()
          });
          addToast('تم نشر الإعلان بنجاح!', 'success');
          setAnnouncementText('');
      } catch (error: any) {
          console.error("Error publishing announcement:", error);
          addToast(getFirebaseErrorMessage(error, 'فشل نشر الإعلان.'), 'error');
      } finally {
          setIsPublishing(false);
      }
  };
  
  // دالة لإيقاف (مسح) الإعلان النصي الحالي
  const handleStopAnnouncement = async () => {
      setIsStoppingAnnouncement(true);
      try {
          const announcementRef = doc(db, 'public', 'announcement');
          // يتم الإيقاف عن طريق تعيين النص إلى سلسلة فارغة
          await setDoc(announcementRef, { text: "" });
          addToast('تم إيقاف الإعلان بنجاح!', 'success');
      } catch (error: any) {
          console.error("Error stopping announcement:", error);
          addToast(getFirebaseErrorMessage(error, 'فشل إيقاف الإعلان.'), 'error');
      } finally {
          setIsStoppingAnnouncement(false);
      }
  };
  
  // دالة لتفعيل أو إلغاء وضع الصيانة
  const handleSetMaintenanceMode = async (activate: boolean) => {
      setIsTogglingMaintenance(true);
      try {
          const maintenanceRef = doc(db, 'public', 'maintenance');
          await setDoc(maintenanceRef, { isActive: activate });
          addToast(`تم ${activate ? 'تفعيل' : 'إلغاء'} وضع الصيانة بنجاح.`, 'success');
      } catch (error: any) {
          console.error("Error setting maintenance mode:", error);
          addToast(getFirebaseErrorMessage(error, 'فشل تحديث وضع الصيانة.'), 'error');
      } finally {
          setIsTogglingMaintenance(false);
      }
  };
  
  // --- دوال إدارة البنر الصوري ---

  // معالج اختيار ملف الصورة من جهاز المستخدم
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { // 2MB
        addToast("حجم الملف كبير جدًا. الحد الأقصى 2 ميجابايت.", 'error');
        return;
    }
    
    setSelectedFile(file);
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl); // تنظيف الرابط القديم
    }
    // إنشاء رابط محلي مؤقت لعرض الصورة قبل رفعها
    setPreviewUrl(URL.createObjectURL(file));
  };
  
  // دالة لإلغاء عملية الرفع ومسح الصورة المختارة
  const handleCancelUpload = () => {
      setSelectedFile(null);
      setPreviewUrl(null);
      if(fileInputRef.current) fileInputRef.current.value = ""; // إعادة تعيين حقل الإدخال
  };
  
  // دالة تأكيد ورفع البنر
  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
        // 1. رفع الصورة إلى خدمة Cloudinary (وليس Firebase Storage)
        const downloadURL = await uploadImage(selectedFile);

        if (downloadURL) {
            // 2. إذا نجح الرفع، يتم حفظ رابط الصورة في Firestore
            const bannerRef = doc(db, 'public', 'imageBanner');
            await setDoc(bannerRef, { imageUrl: downloadURL, isActive: true }, { merge: true });

            addToast("تم رفع البنر وتفعيله بنجاح.", 'success');
            handleCancelUpload(); // إعادة تعيين الحالة بعد النجاح
        } else {
            throw new Error('فشل رفع الصورة إلى الخدمة.');
        }
    } catch (error: any) {
        console.error("Banner upload failed:", error);
        addToast(getFirebaseErrorMessage(error, "فشل رفع البنر."), 'error');
    } finally {
        setIsUploading(false);
    }
};

  // دالة لتفعيل أو إيقاف عرض البنر
  const handleToggleBanner = async () => {
    setIsTogglingBanner(true);
    try {
        const bannerRef = doc(db, 'public', 'imageBanner');
        const newStatus = !imageBanner?.isActive;
        await setDoc(bannerRef, { isActive: newStatus }, { merge: true });
        addToast(`تم ${newStatus ? 'تفعيل' : 'إيقاف'} البنر بنجاح.`, 'success');
    } catch (error: any) {
        addToast(getFirebaseErrorMessage(error, "فشل تحديث حالة البنر."), 'error');
    } finally {
        setIsTogglingBanner(false);
    }
  };
  
  // [تصحيح] دالة لحذف البنر
  const handleDeleteBanner = async () => {
    if (!window.confirm("هل أنت متأكد من أنك تريد حذف البنر نهائيًا؟ هذا الإجراء لا يمكن التراجع عنه.")) return;

    setIsDeletingBanner(true);
    try {
        const bannerRef = doc(db, 'public', 'imageBanner');
        // يتم حذف البنر عن طريق مسح الرابط وتعطيل حالته في قاعدة البيانات.
        // ملاحظة: هذا لا يحذف الصورة فعلياً من خدمة التخزين (Cloudinary)،
        // ولكنه يمنع ظهورها في التطبيق وهو السلوك المطلوب.
        await setDoc(bannerRef, { imageUrl: '', isActive: false });

        addToast("تم حذف البنر بنجاح.", 'success');
    } catch (error: any) {
        addToast(getFirebaseErrorMessage(error, "فشل حذف البنر."), 'error');
    } finally {
        setIsDeletingBanner(false);
    }
  };
  
    // دالة لإرسال إعلان فوز وهمي (للاختبار أو العروض)
    const handleAnnounceWin = async () => {
        if (!winnerNickname.trim() || !winGameName.trim() || winAmount <= 0) {
            addToast("الرجاء ملء جميع حقول إعلان الفوز.", "error");
            return;
        }
        setIsAnnouncingWin(true);
        try {
            const winnerRef = doc(db, 'public', 'lastWinner');
            await setDoc(winnerRef, { 
                nickname: winnerNickname.trim(), 
                amount: winAmount, 
                gameName: winGameName.trim(), 
                timestamp: serverTimestamp() 
            });
            addToast('تم إرسال إعلان الفوز بنجاح!', 'success');
        } catch (error: any) {
            console.error("Error announcing win:", error);
            addToast(getFirebaseErrorMessage(error, 'فشل إرسال الإعلان.'), 'error');
        } finally {
            setIsAnnouncingWin(false);
        }
    };
    
    // دالة لتحديد سجلات الأرباح على أنها "مقروءة"
    const handleViewProfitLog = () => {
        setViewedProfitLogIds(prevSet => {
            const newSet = new Set(prevSet);
            newProfitLogs.forEach(log => newSet.add(log.id));
            return newSet;
        });
    };

  return (
    <>
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-2xl shadow-cyan-900/20 game-container-animation">
        <div className="w-full flex justify-between items-center mb-6 pb-4 border-b-2 border-cyan-500/20 flex-wrap gap-2">
            <h2 className="text-3xl font-bold text-cyan-400">لوحة التحكم</h2>
            <div className="flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 bg-purple-600/20 border border-purple-500 rounded-full">
              <span className="text-gray-400">الخزنة:</span>
              <DiamondIcon className="w-5 h-5 text-cyan-400" />
              <span className="text-xl font-bold text-white tracking-tighter">
                {treasuryBalance !== null ? formatNumber(treasuryBalance) : '...'}
              </span>
            </div>
        </div>
        
        <div className="space-y-6">
          <Accordion title="الطلبات المعلقة" badge={requests.length}>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {requests.length > 0 ? requests.map(req => (
                      <div key={req.id} className="bg-gray-800 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
                          <div>
                              <p><strong>اللاعب:</strong> <span className="text-yellow-300">{req.userEmail}</span></p>
                              <p><strong>النوع:</strong> <span className={`font-bold ${req.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>{req.type === 'deposit' ? 'إيداع' : 'سحب'}</span></p>
                              <p><strong>المبلغ:</strong> {formatNumber(req.amount)} 💎</p>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => onProcessRequest(req, 'approve')} disabled={processingRequestId === req.id} className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded transition disabled:opacity-50">موافقة</button>
                              <button onClick={() => onProcessRequest(req, 'reject')} disabled={processingRequestId === req.id} className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded transition disabled:opacity-50">رفض</button>
                          </div>
                      </div>
                  )) : <p className="text-center text-gray-500 py-4">لا توجد طلبات معلقة.</p>}
              </div>
          </Accordion>

          <Accordion title="شحن مباشر">
              <div className="flex flex-col items-center gap-4 relative">
                  <div>
                      <label htmlFor="player-search" className="block text-lg font-medium text-gray-300 mb-2 text-center">البحث عن لاعب</label>
                      <input type="search" id="player-search" value={searchTerm} onChange={handleSearchChange} placeholder="ابحث بالـ ID أو اللقب..." className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-3 px-4 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                      {isSearching && <p className="text-cyan-400">جاري البحث...</p>}
                      {searchResults.length > 0 && (
                          <div className="absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg mt-1 max-h-48 overflow-y-auto">
                              {searchResults.map(p => (
                                  <div key={p.id} onClick={() => selectPlayer(p)} className="p-3 hover:bg-gray-700 cursor-pointer text-center">
                                      <p className="font-bold">{p.displayName}</p>
                                      <p className="text-sm text-gray-400">ID: {p.playerID}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <div>
                      <label htmlFor="player-id" className="block text-lg font-medium text-gray-300 mb-2 text-center">ID اللاعب</label>
                      <input type="text" id="player-id" value={playerId} onChange={(e) => setPlayerId(e.target.value.replace(/\D/g, ''))} placeholder="12345678" className="w-full bg-transparent py-3 px-4 text-center text-xl font-bold focus:outline-none bg-gray-900 border-2 border-gray-600 rounded-lg"/>
                  </div>
                  <div>
                      <label htmlFor="recharge-amount" className="block text-lg font-medium text-gray-300 mb-2 text-center">مبلغ الشحن</label>
                      <div className="relative"><input type="number" id="recharge-amount" value={amount} onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)} min={100} step={100} className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-3 pr-12 text-center text-xl font-bold focus:ring-cyan-500 focus:border-cyan-500 transition"/>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><DiamondIcon className="w-6 h-6 text-cyan-400" /></div>
                      </div>
                  </div>
                  <button onClick={handleRechargeClick} disabled={isRecharging} className="w-full py-3 mt-4 text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-wait">{isRecharging ? 'جاري الشحن...' : 'شحن الآن'}</button>
              </div>
          </Accordion>
          
          <Accordion title="ربح التطبيق" badge={newProfitLogs.length} onOpen={handleViewProfitLog}>
               <div className="max-h-96 overflow-y-auto pr-2">
                  {profitLog.length > 0 ? (
                      <table className="w-full text-sm text-right text-gray-300">
                          <thead className="text-xs text-cyan-300 uppercase bg-gray-900 sticky top-0">
                              <tr>
                                  <th scope="col" className="px-4 py-3">اللاعب</th>
                                  <th scope="col" className="px-4 py-3">اللعبة</th>
                                  <th scope="col" className="px-4 py-3">ربح التطبيق</th>
                                  <th scope="col" className="px-4 py-3">الوقت والتاريخ</th>
                              </tr>
                          </thead>
                          <tbody>
                              {profitLog.map(log => {
                                  const isUnread = newProfitLogs.some(newLog => newLog.id === log.id);
                                  return (
                                      <tr key={log.id} className={`border-b border-gray-700 transition-colors duration-500 ${isUnread ? 'bg-cyan-900/30' : 'bg-gray-800/50'}`}>
                                          <td className="px-4 py-2 font-medium text-yellow-300 whitespace-nowrap">{log.userEmail}</td>
                                          <td className="px-4 py-2 text-purple-300">{gameDisplayNames[log.gameId] || log.gameId}</td>
                                          <td className="px-4 py-2 font-bold text-green-400 flex items-center gap-1">{formatNumber(log.amount)} <DiamondIcon className="w-3 h-3"/></td>
                                          <td className="px-4 py-2 text-gray-400 text-xs">{formatTimestamp(log.timestamp)}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  ) : <p className="text-center text-gray-500 py-4">لا توجد أرباح مسجلة بعد.</p>}
              </div>
          </Accordion>

          <Accordion title="صيانة">
              <div className="flex flex-col items-center gap-4 text-center">
                   <p>
                      الحالة الحالية:
                      {isMaintenanceMode ? 
                          <span className="font-bold text-red-500 mx-2">مفعل</span> :
                          <span className="font-bold text-green-500 mx-2">متوقف</span>
                      }
                  </p>
                  <p className="text-gray-400 text-sm">عند تفعيل وضع الصيانة، لن يتمكن سوى المسؤولين من تسجيل الدخول إلى التطبيق.</p>
                  <div className="flex w-full gap-4 mt-2">
                      <button 
                          onClick={() => handleSetMaintenanceMode(true)} 
                          disabled={isMaintenanceMode || isTogglingMaintenance}
                          className="flex-1 py-3 text-lg font-bold bg-red-600 rounded-lg hover:bg-red-500 transition disabled:opacity-50 disabled:cursor-wait"
                      >
                          تفعيل
                      </button>
                      <button 
                          onClick={() => handleSetMaintenanceMode(false)} 
                          disabled={!isMaintenanceMode || isTogglingMaintenance}
                          className="flex-1 py-3 text-lg font-bold bg-green-600 rounded-lg hover:bg-green-500 transition disabled:opacity-50 disabled:cursor-wait"
                      >
                          إلغاء
                      </button>
                  </div>
              </div>
          </Accordion>

          <Accordion title="إدارة الخزنة">
            <div className="flex flex-col items-center gap-4">
                <p className="text-gray-400 text-center">أضف رصيدًا إلى الخزنة الرئيسية لتتمكن من شحن حسابات اللاعبين أو الموافقة على طلبات الإيداع.</p>
                <div>
                    <label htmlFor="topup-amount" className="block text-lg font-medium text-gray-300 mb-2 text-center">المبلغ المراد إضافته</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            id="topup-amount" 
                            value={treasuryTopUpAmount} 
                            onChange={(e) => setTreasuryTopUpAmount(parseInt(e.target.value, 10) || 0)} 
                            min={1000} 
                            step={1000} 
                            className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-3 pr-12 text-center text-xl font-bold focus:ring-cyan-500 focus:border-cyan-500 transition"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><DiamondIcon className="w-6 h-6 text-cyan-400" /></div>
                    </div>
                </div>
                <button onClick={handleTreasuryTopUpClick} disabled={isToppingUp} className="w-full py-3 mt-4 text-xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-wait">
                    {isToppingUp ? 'جاري الإضافة...' : 'إضافة للخزنة'}
                </button>
            </div>
        </Accordion>
        
          <Accordion title="إدارة الإعلانات">
              <h4 className="text-lg font-bold text-purple-400 mb-3 text-center border-b border-gray-700 pb-2">الإعلان النصي المتحرك</h4>
              <div className="flex flex-col items-center gap-4">
                  <textarea
                      id="announcement-text"
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      placeholder="اكتب إعلانك هنا ليظهر لجميع اللاعبين..."
                      rows={3}
                      className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-2 px-4 text-white focus:ring-purple-500 focus:border-purple-500 transition"
                  />
                  <div className="flex w-full gap-4 mt-2">
                      <button onClick={handlePublishAnnouncement} disabled={isPublishing || !announcementText.trim()} className="flex-1 py-2 text-lg font-bold bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white hover:opacity-90 transition shadow-lg disabled:opacity-50">
                          {isPublishing ? '...' : 'نشر'}
                      </button>
                       <button onClick={handleStopAnnouncement} disabled={isStoppingAnnouncement || !announcement?.text} className="flex-1 py-2 text-lg font-bold bg-gradient-to-r from-red-600 to-yellow-600 rounded-lg text-white hover:opacity-90 transition shadow-lg disabled:opacity-50">
                          {isStoppingAnnouncement ? '...' : 'إيقاف'}
                      </button>
                  </div>
              </div>
              <hr className="border-gray-700 my-8" />
              <h4 className="text-lg font-bold text-purple-400 mb-3 text-center border-b border-gray-700 pb-2">إعلان البنر الصوري (الرئيسية)</h4>
              <div className="flex flex-col items-center gap-4">
                  {previewUrl ? (
                      <img src={previewUrl} alt="Banner Preview" className="w-full max-w-sm rounded-lg object-contain border-2 border-cyan-400" />
                  ) : (
                      imageBanner?.imageUrl && <img src={imageBanner.imageUrl} alt="Current Banner" className="w-full max-w-sm rounded-lg object-contain" />
                  )}
                  
                  <input type="file" accept="image/png, image/jpeg, image/webp, image/gif" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

                  {selectedFile ? (
                      <div className="w-full flex gap-4 mt-2">
                          <button onClick={handleCancelUpload} disabled={isUploading} className="flex-1 py-3 text-lg font-bold bg-gray-600 rounded-lg hover:bg-gray-500 transition disabled:opacity-50">
                              إلغاء
                          </button>
                          <button onClick={handleConfirmUpload} disabled={isUploading} className="flex-1 py-3 text-lg font-bold bg-green-600 rounded-lg hover:bg-green-500 transition disabled:opacity-50 flex items-center justify-center gap-2">
                              {isUploading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : null}
                              <span>{isUploading ? 'جاري الرفع...' : 'تأكيد الرفع'}</span>
                          </button>
                      </div>
                  ) : (
                      <>
                          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full py-3 text-lg font-bold bg-gray-700 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 flex items-center justify-center gap-2">
                               <UploadIcon className="w-6 h-6"/> <span>{imageBanner?.imageUrl ? 'تغيير الصورة' : 'رفع صورة جديدة'}</span>
                          </button>
                          <div className="flex w-full gap-4 mt-2">
                              <button onClick={handleToggleBanner} disabled={!imageBanner?.imageUrl || isTogglingBanner} className="flex-1 py-2 text-lg font-bold bg-blue-600 rounded-lg hover:bg-blue-500 transition disabled:opacity-50">
                                  {isTogglingBanner ? '...' : (imageBanner?.isActive ? 'إيقاف الإعلان' : 'تشغيل الإعلان')}
                              </button>
                              <button onClick={handleDeleteBanner} disabled={!imageBanner?.imageUrl || isDeletingBanner} className="flex-1 py-2 text-lg font-bold bg-red-600 rounded-lg hover:bg-red-500 transition disabled:opacity-50">
                                  {isDeletingBanner ? '...' : 'مسح الإعلان'}
                              </button>
                          </div>
                      </>
                  )}
              </div>
          </Accordion>

          <Accordion title="محاكاة فوز كبير">
            <div className="flex flex-col items-center gap-4">
                <p className="text-gray-400 text-center text-sm">استخدم هذا النموذج لإظهار إعلان فوز كبير لجميع اللاعبين. مفيد للاختبار أو للاحتفال بلحظات مميزة.</p>
                <div>
                    <label htmlFor="winner-nickname" className="block text-lg font-medium text-gray-300 mb-2 text-center">لقب الفائز</label>
                    <input type="text" id="winner-nickname" value={winnerNickname} onChange={(e) => setWinnerNickname(e.target.value)} placeholder="مثال: TheKing" className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-2 px-3 text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500"/>
                </div>
                <div>
                    <label htmlFor="win-amount" className="block text-lg font-medium text-gray-300 mb-2 text-center">مبلغ الفوز</label>
                    <div className="relative">
                        <input type="number" id="win-amount" value={winAmount} onChange={(e) => setWinAmount(Number(e.target.value))} className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-2 pr-12 text-center font-bold focus:ring-yellow-500 focus:border-yellow-500"/>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><DiamondIcon className="w-6 h-6 text-yellow-300" /></div>
                    </div>
                </div>
                 <div>
                    <label htmlFor="win-game-name" className="block text-lg font-medium text-gray-300 mb-2 text-center">اسم اللعبة</label>
                    <input type="text" id="win-game-name" value={winGameName} onChange={(e) => setWinGameName(e.target.value)} placeholder="مثال: عجلة الحظ" className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-2 px-3 text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500"/>
                </div>
                <button onClick={handleAnnounceWin} disabled={isAnnouncingWin} className="w-full py-3 mt-4 text-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-500 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105 shadow-lg disabled:opacity-50">
                    {isAnnouncingWin ? 'جاري الإعلان...' : '🏆 إعلان الفوز'}
                </button>
            </div>
        </Accordion>

          <Accordion title="اللاعبون النشطون" badge={activePlayers.length}>
               <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {activePlayers.length > 0 ? activePlayers.map(player => (
                      <div key={player.id} className="bg-gray-800 p-2 rounded-lg flex justify-between items-center text-sm">
                           <span className="text-yellow-300 font-bold">{player.email}</span>
                      </div>
                  )) : <p className="text-center text-gray-500 py-4">لا توجد لاعبون نشطون حاليًا.</p>}
              </div>
          </Accordion>

          <Accordion title="سجل الإشعارات" badge={systemNotifications.length} onOpen={onMarkAllNotificationsRead}>
               <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {systemNotifications.length > 0 ? systemNotifications.map(notif => (
                      <div key={notif.id} className="bg-gray-800 p-3 rounded-lg text-sm flex justify-between items-start gap-2">
                           <div className="flex-grow">
                               <div className="flex justify-between items-center mb-1">
                                  <p className="font-bold text-white">{notif.title}</p>
                                  <p className="text-xs text-gray-400">{formatTimestamp(notif.timestamp)}</p>
                               </div>
                               <p><span className="font-semibold text-gray-400">إلى:</span> <span className="text-cyan-300">{notif.recipientEmail}</span></p>
                               <p className="text-gray-300 mt-1">{notif.body}</p>
                           </div>
                           <button 
                                onClick={() => onMarkNotificationAsRead(notif.id)}
                                className="p-2 bg-gray-700 hover:bg-green-600 rounded-full transition-colors text-gray-300 hover:text-white"
                                title="تحديد كمقروء (إخفاء)"
                           >
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                   <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                               </svg>
                           </button>
                      </div>
                  )) : <p className="text-center text-gray-500 py-4">لا توجد إشعارات جديدة.</p>}
              </div>
          </Accordion>
        </div>
      </div>
    </>
  );
};

export default AdminPanel;
