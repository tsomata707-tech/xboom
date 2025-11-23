
/*
  [ملاحظة هامة جداً للمطور] *** سبب قفل التطبيق وكيفية إصلاحه نهائياً ***

  إذا كان التطبيق "مقفلاً" عند شاشة تسجيل الدخول ويعرض خطأ "أذونات غير كافية"،
  فالسبب الوحيد والمؤكد هو أن قواعد أمان Firestore في مشروع Firebase الخاص بك غير صحيحة.

  الحل بسيط ومباشر:
  1. اذهب إلى ملف `App.tsx` في هذا المشروع.
  2. ستجد في أعلى الملف تعليقاً يحتوي على مجموعة القواعد الكاملة والصحيحة (قسم لـ Firestore وقسم لـ Storage).
  3. انسخ مجموعة قواعد Firestore بالكامل.
  4. اذهب إلى لوحة تحكم مشروعك في Firebase -> Firestore Database -> Rules.
  5. احذف كل ما هو موجود والصق القواعد التي نسختها.
  6. اضغط "Publish".

  **هذا هو الحل الوحيد والنهائي للمشكلة. لا يمكن إصلاحها من خلال تعديل الكود.**
*/
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
    // [ملاحظة للمطور] تم تبسيط هذه الدالة لإزالة الاستعلام عن قاعدة البيانات،
    // والذي كان يسبب خطأ "أذونات غير كافية" عند إنشاء حساب جديد.
    // لا يملك المستخدمون الجدد إذنًا للبحث في مجموعة "users" بأكملها.
    // هذا الحل يولد ID عشوائيًا، وفي بيئة الإنتاج الحقيقية، يجب ضمان التفرد
    // عبر دالة سحابية (Cloud Function) لتجنب التضارب المحتملة.
    const playerID = Math.floor(10000000 + Math.random() * 90000000).toString();
    return playerID;
}


const AuthGate: React.FC = () => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        // هذا المستمع من Firebase يعمل عند تغيير حالة تسجيل الدخول (دخول، خروج، أو عند تحميل الصفحة أول مرة)
        const unsubscribe = onAuthStateChanged(auth, async (currentUser: FirebaseUser | null) => {
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
                    
                } catch (error: any) {
                    // --- معالجة الأخطاء المحتملة أثناء العملية ---
                    console.error("AuthGate: Error handling user document:", error);
                    const isPermissionError = error.code === 'permission-denied' || 
                                              (error.message && (error.message.toLowerCase().includes('permission denied') || error.message.toLowerCase().includes('insufficient permissions')));
                    
                    const isOfflineError = error.code === 'unavailable' || (error.message && error.message.toLowerCase().includes('client is offline'));

                    if (isPermissionError) {
                        // خطأ شائع جداً: قواعد الأمان في Firestore غير صحيحة.
                        // يتم تعيين مفتاح خاص لعرض شاشة الإصلاح الكاملة في صفحة تسجيل الدخول.
                        setAuthError('LOCKOUT:PERMISSION_DENIED');
                    } else if (isOfflineError) {
                         setAuthError('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.');
                    } else {
                        setAuthError('حدث خطأ في تهيئة الحساب. يرجى المحاولة مرة أخرى أو التواصل مع الدعم إذا استمرت المشكلة.');
                    }
                    // تسجيل خروج المستخدم لمنعه من الدخول في حالة حلقة خطأ
                    await signOut(auth);
                    setUser(null);
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

    // عرض واجهة التطبيق إذا كان المستخدم مسجلاً، وإلا عرض صفحة تسجيل الدخول
    return user ? <App user={user} /> : <LoginPage errorFromGate={authError} />;
};

export default AuthGate;
