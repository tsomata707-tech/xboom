
import React, { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import App from './App';
import LoginPage from './components/LoginPage';
import Toast from './components/Toast';
import type { AppUser } from './types';

// --- Toast Context and Provider ---
interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  addToast: (message: string, type: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastMessage['type']) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = (id: number) => {
    setToasts(toasts => toasts.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
// ------------------------------------

async function generateUniquePlayerID(): Promise<string> {
    const playerID = Math.floor(10000000 + Math.random() * 90000000).toString();
    return playerID;
}


const AuthGate: React.FC = () => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        // هذا المستمع من Firebase يعمل عند تغيير حالة تسجيل الدخول (دخول، خروج، أو عند تحميل الصفحة أول مرة)
        const unsubscribe = onAuthStateChanged(auth, async (currentUser: FirebaseUser | null) => {
            setIsOffline(false); // Reset offline state on new attempt
            
            if (currentUser) {
                // --- المستخدم مسجل دخوله ---
                const userDocRef = doc(db, 'users', currentUser.uid);
                const maintenanceRef = doc(db, 'public', 'maintenance');
                
                try {
                    // جلب بيانات المستخدم وحالة الصيانة معًا لتحسين الأداء
                    const [userDoc, maintenanceDoc] = await Promise.all([
                        getDoc(userDocRef),
                        getDoc(maintenanceRef)
                    ]);
                    
                    const userData = userDoc.exists() ? userDoc.data() : null;
                    const isMaintenanceActive = maintenanceDoc.exists() && maintenanceDoc.data().isActive === true;

                    // 0. التحقق من الحظر (Ban Check) - NEW
                    if (userData?.isBanned) {
                        setAuthError('⛔ تم حظر حسابك. تواصل مع الإدارة لاستعادة الوصول.');
                        await signOut(auth);
                        setUser(null);
                        setLoading(false);
                        return;
                    }

                    // 1. التحقق من وضع الصيانة
                    if (isMaintenanceActive && !userData?.isAdmin) {
                        // إذا كان وضع الصيانة مفعل والمستخدم ليس مسؤولاً، يتم تسجيل خروجه
                        setAuthError('التطبيق في وضع الصيانة حاليًا. نعتذر عن الإزعاج.');
                        await signOut(auth);
                        setUser(null);
                        setLoading(false);
                        return;
                    }

                    let finalPlayerID = '';

                    // 2. التحقق مما إذا كان المستخدم جديدًا
                    if (!userDoc.exists()) {
                        // إذا لم يكن لديه مستند في قاعدة البيانات، فهو مستخدم جديد
                        const displayName = currentUser.displayName || `User_${currentUser.uid.substring(0, 5)}`;
                        const newPlayerID = await generateUniquePlayerID();
                        
                        const newUser_data = {
                            email: currentUser.email,
                            balance: 0,
                            displayName: displayName,
                            photoURL: currentUser.photoURL || '👤',
                            playerID: newPlayerID,
                            // لا يتم جمع العمر من تسجيل دخول جوجل
                            createdAt: serverTimestamp(),
                            lastActive: serverTimestamp(),
                            isBanned: false
                        };
                        
                        // إنشاء مستند جديد للمستخدم في Firestore
                        await setDoc(userDocRef, newUser_data);
                        finalPlayerID = newPlayerID;
                    } else {
                        // Check if existing user needs playerID backfill
                        if (userData && !userData.playerID) {
                             const newPlayerID = await generateUniquePlayerID();
                             await updateDoc(userDocRef, { playerID: newPlayerID });
                             finalPlayerID = newPlayerID;
                        } else {
                             finalPlayerID = userData?.playerID;
                        }
                    }
                    
                    // 3. إذا سارت الأمور على ما يرام، يتم تعيين بيانات المستخدم والسماح له بالدخول
                    setUser({
                        uid: currentUser.uid,
                        email: currentUser.email,
                        displayName: currentUser.displayName,
                        photoURL: currentUser.photoURL,
                        playerID: finalPlayerID
                    });
                    setAuthError('');
                    
                } catch (error: any) {
                    // --- معالجة الأخطاء المحتملة أثناء العملية ---
                    const isPermissionError = error.code === 'permission-denied' || 
                                              (error.message && (error.message.toLowerCase().includes('permission denied') || error.message.toLowerCase().includes('insufficient permissions')));
                    
                    const isOfflineError = error.code === 'unavailable' || 
                                           (error.message && (error.message.toLowerCase().includes('client is offline') || error.message.toLowerCase().includes('backend didn\'t respond'))) ||
                                           !navigator.onLine;

                    if (isOfflineError) {
                         console.warn("AuthGate: Offline detected during auth init.");
                         // Don't sign out, show offline screen
                         setIsOffline(true);
                    } else if (isPermissionError) {
                        console.error("AuthGate: Permission Denied", error);
                        setAuthError('LOCKOUT:PERMISSION_DENIED');
                        await signOut(auth);
                        setUser(null);
                    } else {
                        console.error("AuthGate: Critical Error handling user document:", error);
                        setAuthError('حدث خطأ في تهيئة الحساب. يرجى المحاولة مرة أخرى.');
                        // Keep user logged in but show error state in login page if we redirect
                        // For now, let's sign out to be safe for critical data errors
                        await signOut(auth);
                        setUser(null);
                    }
                }
            } else {
                // --- المستخدم غير مسجل دخوله ---
                setUser(null);
            }
            
            setLoading(false); // انتهاء التحميل
        });

        // دالة التنظيف: إلغاء الاشتراك في المستمع عند تفكيك المكون
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-2xl font-bold">
                جاري تحميل xboom...
            </div>
        );
    }

    if (isOffline) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4 text-center">
                <div className="text-6xl mb-4 animate-pulse">📡</div>
                <h2 className="text-2xl font-bold mb-2 text-red-400">انقطع الاتصال</h2>
                <p className="text-gray-400 mb-6 max-w-md">
                    تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت الخاص بك والمحاولة مرة أخرى.
                </p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                >
                    إعادة المحاولة
                </button>
            </div>
        );
    }

    // عرض واجهة التطبيق إذا كان المستخدم مسجلاً، وإلا عرض صفحة تسجيل الدخول
    return user ? <App user={user} /> : <LoginPage errorFromGate={authError} />;
};

export default AuthGate;
