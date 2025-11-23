
import React, { useState, useEffect, useRef } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import BetControls from '../BetControls';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface LuckyWheelGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// تعريف القطاعات - الترتيب مهم جداً لحساب الزوايا
// نبدأ من الأعلى (مؤشر الساعة 12) ونتجه مع عقارب الساعة
const SEGMENTS = [
    { id: 'grand_prize', multiplier: 50, label: 'x50', icon: '🏍️', type: 'grand_prize', color: '#FFD700', textColor: '#000' }, // 0
    { id: 'loss_1', multiplier: 0, label: 'x0', icon: '💣', type: 'loss', color: '#1A202C', textColor: '#FFF' }, // 1
    { id: 'win_2x', multiplier: 2, label: 'x2', icon: '🍒', type: 'win', color: '#3182CE', textColor: '#FFF' }, // 2
    { id: 'loss_2', multiplier: 0, label: 'x0', icon: '💣', type: 'loss', color: '#1A202C', textColor: '#FFF' }, // 3
    { id: 'free_spin', multiplier: 0, label: 'مجانية', icon: '🔄', type: 'free_spin', color: '#805AD5', textColor: '#FFF' }, // 4
    { id: 'win_5x', multiplier: 5, label: 'x5', icon: '🍀', type: 'win', color: '#38A169', textColor: '#FFF' }, // 5
    { id: 'loss_3', multiplier: 0, label: 'x0', icon: '💣', type: 'loss', color: '#1A202C', textColor: '#FFF' }, // 6
    { id: 'win_1.5x', multiplier: 1.5, label: 'x1.5', icon: '🍋', type: 'win', color: '#319795', textColor: '#FFF' }, // 7
    { id: 'loss_4', multiplier: 0, label: 'x0', icon: '💣', type: 'loss', color: '#1A202C', textColor: '#FFF' }, // 8
    { id: 'win_10x', multiplier: 10, label: 'x10', icon: '💎', type: 'win', color: '#E53E3E', textColor: '#FFF' }, // 9
];

// احتمالات الظهور (مجموع الأوزان)
const WEIGHTS = {
    grand_prize: 0.2,
    win_10x: 3,
    win_5x: 7,
    win_2x: 15,
    win_1_5x: 20,
    free_spin: 10,
    loss: 44.8
};

const MIN_GRAND_PRIZE_INTERVAL = 15 * 60 * 60 * 1000; // 15 ساعة

const LuckyWheelGame: React.FC<LuckyWheelGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [freeSpinPending, setFreeSpinPending] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [winMessage, setWinMessage] = useState<React.ReactNode | null>(null);
    
    const wheelRef = useRef<HTMLDivElement>(null);

    // منطق تحديد النتيجة (الخوارزمية)
    const determineOutcome = () => {
        // 1. اللفة المجانية دائماً تخسر بعدها لضبط نسبة الربح
        if (freeSpinPending) {
            const lossSegments = SEGMENTS.filter(s => s.type === 'loss');
            return lossSegments[Math.floor(Math.random() * lossSegments.length)];
        }

        // 2. التحقق من توقيت الجائزة الكبرى
        const lastGrandPrizeTime = parseInt(localStorage.getItem('lastGrandPrizeTime') || '0');
        const now = Date.now();
        const canWinGrandPrize = (now - lastGrandPrizeTime) > MIN_GRAND_PRIZE_INTERVAL;

        // 3. الاختيار المرجح
        const rand = Math.random() * 100;
        let cumulative = 0;
        
        if (canWinGrandPrize) {
            cumulative += WEIGHTS.grand_prize;
            if (rand < cumulative) {
                localStorage.setItem('lastGrandPrizeTime', now.toString());
                return SEGMENTS.find(s => s.id === 'grand_prize')!;
            }
        }

        cumulative += WEIGHTS.win_10x;
        if (rand < cumulative) return SEGMENTS.find(s => s.id === 'win_10x')!;
        
        cumulative += WEIGHTS.win_5x;
        if (rand < cumulative) return SEGMENTS.find(s => s.id === 'win_5x')!;

        cumulative += WEIGHTS.win_2x;
        if (rand < cumulative) return SEGMENTS.find(s => s.id === 'win_2x')!;
        
        cumulative += WEIGHTS.win_1_5x;
        if (rand < cumulative) return SEGMENTS.find(s => s.id === 'win_1.5x')!;

        cumulative += WEIGHTS.free_spin;
        if (rand < cumulative) return SEGMENTS.find(s => s.id === 'free_spin')!;
        
        // الافتراضي خسارة
        const lossSegments = SEGMENTS.filter(s => s.type === 'loss');
        return lossSegments[Math.floor(Math.random() * lossSegments.length)];
    };

    const handleSpin = async () => {
        if (isSpinning || !userProfile) return;

        // 1. التحقق المبدئي
        if (!freeSpinPending) {
            if (bet <= 0 || bet > userProfile.balance) {
                addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
                return;
            }
        }

        // 2. بدء الحالة فوراً لمنع التأخير البصري
        setIsSpinning(true);
        setWinMessage(null);
        setShowConfetti(false);

        // 3. خصم الرصيد (إذا لم تكن لفة مجانية)
        if (!freeSpinPending) {
            const success = await onBalanceUpdate(-bet, 'luckyWheel');
            if (!success) {
                setIsSpinning(false);
                return; // توقف إذا فشل الخصم
            }
        }

        // 4. تحديد النتيجة منطقياً
        const targetSegment = determineOutcome();
        
        // 5. حساب الزوايا بدقة متناهية
        const segmentCount = SEGMENTS.length; // 10
        const segmentAngle = 360 / segmentCount; // 36 درجة
        const targetIndex = SEGMENTS.indexOf(targetSegment);

        // المعادلة: لجعل المؤشر (عند الزاوية 0) يقف على القطاع المستهدف
        // نحتاج لتدوير العجلة بحيث يأتي القطاع إلى الأعلى.
        // العجلة تدور مع عقارب الساعة (موجب).
        // القطاع 1 (36 درجة يمين) يحتاج دوران 360 - 36 = 324 درجة ليصبح في الأعلى.
        // الصيغة: TargetRotation = 360 - (Index * 36)
        const baseTargetAngle = (360 - (targetIndex * segmentAngle)) % 360;

        // إضافة عدد لفات كاملة (5 لفات على الأقل)
        const extraSpins = 5 * 360;

        // إضافة عشوائية آمنة داخل القطاع (±14 درجة) لتجنب الوقوف على الخط
        // القطاع 36 درجة، نترك 4 درجات هامش أمان من كل جانب
        const randomOffset = (Math.random() * 28) - 14;

        // حساب الدوران الحالي بالنسبة لـ 360
        const currentRotationMod = rotation % 360;
        
        // حساب المسافة التي يجب قطعها من النقطة الحالية للوصول للهدف
        let distanceToTarget = baseTargetAngle - currentRotationMod;
        if (distanceToTarget < 0) distanceToTarget += 360; // التأكد من الدوران للأمام دائماً

        const finalRotation = rotation + extraSpins + distanceToTarget + randomOffset;

        // تنفيذ الدوران
        setRotation(finalRotation);

        // 6. انتظار انتهاء الحركة (4 ثواني) ومعالجة النتائج
        setTimeout(async () => {
            setIsSpinning(false);
            
            // التأكد من النتيجة بناءً على الكائن المختار منطقياً (وليس بصرياً فقط)
            if (targetSegment.type === 'win' || targetSegment.type === 'grand_prize') {
                const winnings = bet * targetSegment.multiplier;
                await onBalanceUpdate(winnings, 'luckyWheel');
                
                setWinMessage(
                    <div className="text-center">
                        <div className="text-sm text-gray-300">مبروك!</div>
                        <div className="text-xl font-bold text-green-400">{formatNumber(winnings)} 💎</div>
                    </div>
                );
                
                if (winnings > 10000 && userProfile.displayName) {
                    onAnnounceWin(userProfile.displayName, winnings, 'luckyWheel');
                }
                if (targetSegment.multiplier >= 5) {
                    setShowConfetti(true);
                }
            } else if (targetSegment.type === 'free_spin') {
                setFreeSpinPending(true);
                setWinMessage(
                    <div className="text-center text-purple-300 font-bold">
                        لفة مجانية! 🔄
                    </div>
                );
                addToast('حصلت على لفة مجانية! اضغط "لف" مرة أخرى.', 'info');
            } else {
                // خسارة
                if (freeSpinPending) {
                    setFreeSpinPending(false);
                    setWinMessage(<span className="text-gray-400">انتهت اللفة المجانية.</span>);
                } else {
                    setWinMessage(<span className="text-red-400">حظ أوفر في المرة القادمة (x0).</span>);
                }
            }

        }, 4000); // يجب أن تطابق مدة الـ CSS transition
    };

    return (
        <div className="flex flex-col items-center h-full w-full max-w-md mx-auto overflow-hidden justify-start pt-2 relative">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <HowToPlay>
                <p>1. اختر مبلغ الرهان.</p>
                <p>2. اضغط "لف العجلة" لتبدأ بالدوران.</p>
                <p>3. انتظر حتى تتوقف العجلة عند المؤشر.</p>
                <p>4. تربح قيمة الرهان مضروبة في الرقم الذي توقفت عنده (مثلاً x2, x5, x10).</p>
                <p>5. احذر من القنابل (x0) لأنها تخسرك الرهان!</p>
            </HowToPlay>

            {/* منطقة العجلة */}
            <div className="relative flex-grow flex flex-col items-center justify-center w-full min-h-[280px]">
                {/* المؤشر - ثابت */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-10 h-12 filter drop-shadow-xl">
                     <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-yellow-500">
                        <path d="M12 22L2 2h20L12 22z" stroke="#744210" strokeWidth="2"/>
                        <circle cx="12" cy="4" r="2" fill="#744210" />
                     </svg>
                </div>

                {/* العجلة الدوارة */}
                <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
                    <div 
                        ref={wheelRef}
                        className="w-full h-full rounded-full border-4 border-gray-700 shadow-2xl overflow-hidden relative"
                        style={{ 
                            transform: `rotate(${rotation}deg)`,
                            transition: isSpinning ? 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none'
                        }}
                    >
                        {/* رسم القطاعات */}
                        <svg viewBox="0 0 100 100" className="absolute top-0 left-0 w-full h-full pointer-events-none">
                            {SEGMENTS.map((segment, index) => {
                                const count = SEGMENTS.length;
                                const angle = 360 / count; // 36
                                // تحويل الزوايا لراديان. نبدأ من -90 (الأعلى)
                                // لإزاحة القطاع ليكون مركزه عند الزاوية، نطرح نصف الزاوية
                                const startAngle = ((index * angle) - 90 - (angle/2)) * (Math.PI / 180);
                                const endAngle = (((index + 1) * angle) - 90 - (angle/2)) * (Math.PI / 180);
                                
                                const x1 = 50 + 50 * Math.cos(startAngle);
                                const y1 = 50 + 50 * Math.sin(startAngle);
                                const x2 = 50 + 50 * Math.cos(endAngle);
                                const y2 = 50 + 50 * Math.sin(endAngle);

                                return (
                                    <path 
                                        key={segment.id}
                                        d={`M50,50 L${x1},${y1} A50,50 0 0,1 ${x2},${y2} Z`} 
                                        fill={segment.color}
                                        stroke="#111827"
                                        strokeWidth="0.8"
                                    />
                                );
                            })}
                        </svg>

                        {/* المحتويات (أيقونات ونصوص) */}
                        {SEGMENTS.map((segment, index) => {
                            const angle = (360 / SEGMENTS.length) * index;
                             return (
                                <div 
                                    key={segment.id}
                                    className="absolute top-0 left-1/2 w-[1px] h-1/2 origin-bottom flex flex-col items-center pt-3"
                                    style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
                                >
                                    <span className="text-2xl mb-1 transform" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                                        {segment.icon}
                                    </span>
                                    <span 
                                        className="font-black text-sm sm:text-base transform rotate-180 whitespace-nowrap px-1 rounded" 
                                        style={{ color: segment.textColor, writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                    >
                                        {segment.label}
                                    </span>
                                </div>
                            );
                        })}

                        {/* المركز */}
                        <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-gradient-to-br from-gray-800 to-black rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-yellow-500 z-10 flex items-center justify-center shadow-lg">
                            <span className="text-xl">🎰</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* رسالة النتيجة - تظهر في المنتصف */}
            <div className="h-10 flex items-center justify-center w-full px-4 -mt-4 z-20 relative">
                {winMessage && (
                    <div className="bg-gray-900/95 px-8 py-2 rounded-2xl border-2 border-cyan-500/50 shadow-2xl backdrop-blur-xl transform scale-110 transition-all animate-bounce-in">
                        {winMessage}
                    </div>
                )}
            </div>

            {/* أزرار التحكم - مرفوعة للأعلى وملاصقة للعجلة */}
            <div className="w-full px-4 pb-2 flex flex-col gap-2 bg-gray-800/80 pt-4 rounded-t-3xl border-t border-cyan-500/30 mt-1 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
                {freeSpinPending ? (
                    <button 
                        onClick={handleSpin} 
                        disabled={isSpinning}
                        className="w-full py-3 text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl text-white hover:opacity-90 transition transform active:scale-95 shadow-lg shadow-purple-900/50 animate-pulse"
                    >
                        {isSpinning ? 'جاري الدوران...' : 'لف مجاني! 🔄'}
                    </button>
                ) : (
                    <>
                        <div className="flex-grow -mt-6">
                             <BetControls 
                                bet={bet} 
                                setBet={setBet} 
                                balance={userProfile?.balance ?? 0} 
                                disabled={isSpinning} 
                            />
                        </div>
                        <button 
                            onClick={handleSpin} 
                            disabled={isSpinning}
                            className="w-full py-3 text-2xl font-bold bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl text-white hover:opacity-90 transition transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isSpinning ? 'جاري الدوران...' : 'لـــف العجلة!'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default LuckyWheelGame;
