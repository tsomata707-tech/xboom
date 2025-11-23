
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    AuthError,
    sendEmailVerification,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import DiamondIcon from './icons/DiamondIcon';

// دالة لإنشاء ID فريد للاعب (نسخة مبسطة لتجنب مشاكل الأذونات عند التسجيل)
async function generateUniquePlayerID(): Promise<string> {
    const playerID = Math.floor(10000000 + Math.random() * 90000000).toString();
    return playerID;
}

const pricingTiers = [
    { diamonds: 250, price: '50 جنيه' },
    { diamonds: 1000, price: '200 جنيه' },
    { diamonds: 5000, price: '1,000 جنيه' },
    { diamonds: 50000, price: '10,000 جنيه' },
    { diamonds: 100000, price: '20,000 جنيه' },
];

const PricingInfo: React.FC = () => {
    return (
        <div className="absolute left-0 mt-2 w-64 bg-gray-800 border border-purple-500/30 rounded-lg shadow-lg z-10 p-4 game-container-animation">
           <h3 className="text-lg font-bold text-purple-400 mb-3 text-center">باقات 💎</h3>
           <ul className="space-y-2 text-right">
               {pricingTiers.map(tier => (
                   <li key={tier.diamonds} className="flex justify-between items-center border-b border-gray-700 pb-2 last:border-b-0">
                       <span className="flex items-center">
                           <DiamondIcon className="w-4 h-4 text-cyan-400 ml-2" />
                           {tier.diamonds.toLocaleString()}
                       </span>
                       <span className="font-bold text-cyan-400">{tier.price}</span>
                   </li>
               ))}
           </ul>
           <p className="text-xs text-gray-500 mt-4 text-center">لشحن رصيدك، يرجى التواصل مع المشرف.</p>
        </div>
    );
};

interface LoginPageProps {
    errorFromGate?: string;
}

const LoginPage: React.FC<LoginPageProps> = ({ errorFromGate }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState(localStorage.getItem('savedUserEmail') || '');
    const [password, setPassword] = useState('');
    const [age, setAge] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [error, setError] = useState(errorFromGate && errorFromGate !== 'LOCKOUT:PERMISSION_DENIED' ? errorFromGate : '');
    const [loading, setLoading] = useState(false);
    const [showPrices, setShowPrices] = useState(false);

    // Using the new input-gold-border class for shimmering gold edges
    const inputStyle = "w-full mt-1 rounded-lg py-3 px-4 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-inner shadow-black/40 input-gold-border placeholder-gray-500";

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            await setPersistence(auth, browserLocalPersistence);

            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                localStorage.setItem('savedUserEmail', email);
            } else { // Registration Flow
                if (Number(age) < 18) {
                    setError('يجب أن يكون عمرك 18 عامًا على الأقل.');
                    setLoading(false);
                    return;
                }
                if (!termsAccepted) {
                    setError('يجب الموافقة على الشروط والأحكام للمتابعة.');
                    setLoading(false);
                    return;
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                if (user) {
                    const userDocRef = doc(db, 'users', user.uid);
                    
                    const displayName = user.displayName || `User_${user.uid.substring(0, 5)}`;
                    const newPlayerID = await generateUniquePlayerID();
                    
                    const newUser_data = {
                        email: user.email,
                        balance: 0,
                        displayName: displayName,
                        photoURL: user.photoURL || '👤',
                        playerID: newPlayerID,
                        age: Number(age),
                        createdAt: serverTimestamp(),
                        lastActive: serverTimestamp()
                    };
                    
                    await setDoc(userDocRef, newUser_data);
                    
                    await sendEmailVerification(user);
                    sessionStorage.setItem('show_verification_toast', 'true');
                }
            }
        } catch (err) {
            const authError = err as AuthError;
            console.error(`${isLogin ? 'Login' : 'Registration'} Error:`, authError.code, authError.message);
            switch (authError.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
                    break;
                case 'auth/invalid-email':
                    setError('صيغة البريد الإلكتروني غير صالحة.');
                    break;
                case 'auth/email-already-in-use':
                    setError('هذا البريد الإلكتروني مستخدم بالفعل. الرجاء تسجيل الدخول.');
                    break;
                case 'auth/weak-password':
                    setError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
                    break;
                case 'auth/network-request-failed':
                    setError('فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.');
                    break;
                default:
                    setError(`حدث خطأ: ${authError.message}`);
                    break;
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleAuthMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setPassword('');
        setAge('');
        setTermsAccepted(false);
    }
    
    if (errorFromGate === 'LOCKOUT:PERMISSION_DENIED') {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
                <div className="w-full max-w-2xl mx-auto bg-red-900/50 border-2 border-red-500 rounded-2xl p-8 shadow-2xl shadow-red-900/50 game-container-animation text-center">
                    <div className="text-5xl mb-4" role="img" aria-label="Lock">🔒</div>
                    <h1 className="text-3xl font-bold text-red-400 tracking-wider">تنبيه حرج: التطبيق متوقف</h1>
                    <p className="text-gray-300 mt-4 mb-6">تم قفل التطبيق بسبب خطأ في الأذونات. يرجى مراجعة المسؤول.</p>
                    <button onClick={() => window.location.reload()} className="w-full max-w-sm h-[52px] flex items-center justify-center py-3 text-lg font-bold bg-gradient-to-r from-green-600 to-cyan-600 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105">
                        إعادة تحميل الصفحة
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 selection:bg-purple-500 selection:text-white">
            
            <div className="absolute top-4 left-4 z-20">
                <div className="relative">
                    <button
                        onClick={() => setShowPrices(prev => !prev)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-full hover:bg-gray-600 transition"
                        aria-haspopup="true"
                        aria-expanded={showPrices}
                    >
                        <DiamondIcon className="w-5 h-5 text-cyan-400" />
                        <span>أسعار الشحن</span>
                        <svg className={`w-4 h-4 transition-transform duration-300 ${showPrices ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    {showPrices && <PricingInfo />}
                </div>
            </div>

            <div className="w-full max-w-md mx-auto bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl p-8 shadow-2xl shadow-purple-900/20 game-container-animation relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 transition-opacity duration-300 ${loading ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 animate-progress-indeterminate"></div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-5xl sm:text-6xl font-black tracking-wider flex items-center justify-center gap-3" style={{ fontFamily: 'sans-serif' }}>
                        <span className="xboom-gold-logo">XBOOM</span> 
                        <span className="text-5xl sm:text-6xl eagle-gold-glow">🦅</span>
                    </h1>
                    <p className="text-gray-400 mt-2">{isLogin ? 'سجل الدخول للمتابعة' : 'أنشئ حساباً جديداً'}</p>
                </div>

                {error && (
                    <div className="bg-red-600 border border-red-400 text-white p-4 mb-6 rounded-lg shadow-lg shadow-red-900/50" role="alert">
                        <div className="flex items-center">
                            <div className="text-3xl mr-3" role="img" aria-label="Warning">⚠️</div>
                            <div>
                                <p className="font-bold text-lg">حدث خطأ</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleAuthAction} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                            📧 البريد الإلكتروني
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            className={inputStyle}
                            placeholder="name@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                            🔒 كلمة المرور
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            className={inputStyle}
                            placeholder="••••••••"
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div>
                                <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1">
                                    العمر
                                </label>
                                <input
                                    id="age"
                                    name="age"
                                    type="number"
                                    required
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                    disabled={loading}
                                    className={inputStyle}
                                    placeholder="يجب أن يكون 18 عامًا أو أكثر"
                                />
                            </div>

                            <div className="flex items-center mt-2">
                                <input
                                    id="terms"
                                    name="terms"
                                    type="checkbox"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    disabled={loading}
                                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-purple-600 focus:ring-purple-500"
                                />
                                <label htmlFor="terms" className="ml-2 rtl:mr-2 block text-sm text-gray-400">
                                    أوافق على <a href="#" onClick={(e) => e.preventDefault()} className="font-medium text-purple-400 hover:text-purple-300">الشروط والأحكام</a>
                                </label>
                            </div>
                        </>
                    )}


                    <div>
                        <button
                            type="submit"
                            disabled={loading || (!isLogin && (!termsAccepted || !age || Number(age) < 18))}
                            className="w-full h-[52px] flex items-center justify-center py-3 text-lg font-bold bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'
                            )}
                        </button>
                    </div>
                </form>

                <p className="mt-8 text-center text-sm text-gray-400">
                    {isLogin ? 'ليس لديك حساب؟' : 'هل لديك حساب بالفعل؟'}
                    <button onClick={toggleAuthMode} className="font-medium text-purple-400 hover:text-purple-300 transition underline ms-1">
                        {isLogin ? 'أنشئ حساباً' : 'سجل الدخول'}
                    </button>
                </p>
            </div>

            <div className="mt-8 text-center">
                <a 
                  href="https://wa.me/201055455403"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 py-2 px-6 bg-green-700/50 border border-green-600 rounded-full hover:bg-green-600 transition text-green-300 hover:text-white font-bold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                  <span>تواصل مع خدمة العملاء</span>
                </a>
            </div>
        </div>
    );
};

export default LoginPage;
