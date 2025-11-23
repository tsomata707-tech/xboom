
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import ChickenIcon from '../icons/ChickenIcon';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import DiamondIcon from '../icons/DiamondIcon';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface ChickenRoadGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'hardcore';

const difficultySettings: Record<Difficulty, { name: string, multipliers: number[], collisionChance: number }> = {
    easy:     { name: 'سهل', multipliers: [1.20, 1.40, 1.60, 1.80, 2.00], collisionChance: 0.30 }, 
    medium:   { name: 'متوسط', multipliers: [1.40, 1.80, 2.20, 2.60, 3.00], collisionChance: 0.50 }, 
    hard:     { name: 'صعب', multipliers: [2.00, 3.50, 5.50, 7.50, 10.00], collisionChance: 0.70 }, 
    hardcore: { name: 'خبير', multipliers: [5.00, 10.00, 20.00, 40.00, 70.00], collisionChance: 0.90 } 
};

const STEPS = 5;
const QUICK_BETS = [25, 100, 500, 1000, 5000];

interface RoundResult {
    id: number;
    multiplier: number;
    win: boolean;
}

const ChickenRoadGame: React.FC<ChickenRoadGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(25);
    const [difficulty, setDifficulty] = useState<Difficulty>('easy');
    const [gameState, setGameState] = useState<'betting' | 'playing' | 'busted' | 'won'>('betting');
    const [chickenStep, setChickenStep] = useState(0); // 0 = Start, 1..5 = Multipliers
    const [winnings, setWinnings] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [history, setHistory] = useState<RoundResult[]>([]);
    
    // Ref to track current step to avoid stale closures in timeouts
    const chickenStepRef = useRef(chickenStep);
    useEffect(() => { chickenStepRef.current = chickenStep; }, [chickenStep]);
    
    // حساب المضاعف الحالي بناءً على موقع الدجاجة
    const currentMultiplier = useMemo(() => {
        if (chickenStep === 0) return 1;
        return difficultySettings[difficulty].multipliers[chickenStep - 1] || 1;
    }, [chickenStep, difficulty]);
    
    // الأرباح الحالية المتاحة للسحب
    const currentPotentialWin = useMemo(() => {
        if (chickenStep === 0) return bet; // لم يبدأ التحرك بعد
        return bet * currentMultiplier;
    }, [bet, currentMultiplier, chickenStep]);

    const addToHistory = (multiplier: number, win: boolean) => {
        setHistory(prev => {
            const newHistory = [{ id: Date.now(), multiplier, win }, ...prev];
            return newHistory.slice(0, 30);
        });
    };

    const resetGame = useCallback(() => {
        setGameState('betting');
        setChickenStep(0);
        setWinnings(0);
        setShowConfetti(false);
    }, []);

    const handleStartGame = async () => {
        if (!userProfile || bet < 25 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'chickenRoad');
        if (success) {
            setGameState('playing');
            setChickenStep(0); // الدجاجة في نقطة البداية
        }
    };
    
    const handleContinue = () => {
        if (gameState !== 'playing') return;

        const isBusted = Math.random() < difficultySettings[difficulty].collisionChance;
        
        if (isBusted) {
            setGameState('busted');
            addToHistory(0, false);
            // لا حاجة لـ Toast هنا، التأثير البصري يكفي
        } else {
            const nextStep = chickenStep + 1;
            setChickenStep(nextStep);
            if (nextStep >= STEPS) {
                // عند الوصول للنهاية، الفوز يكون تلقائياً بالمضاعف الأخير
                setTimeout(() => handleCashOut(true), 500); 
            }
        }
    };
    
    const handleCashOut = useCallback(async (isAuto = false) => {
        if (gameState !== 'playing') return;
        
        // Use Ref for auto cashout to ensure we get the updated step from the timeout closure
        const currentStep = isAuto ? chickenStepRef.current : chickenStep;

        // التأكد من أن الدجاجة تحركت خطوة واحدة على الأقل، إلا إذا كان سحب تلقائي في النهاية
        if (currentStep === 0 && !isAuto) {
             addToast('يجب أن تتحرك خطوة واحدة على الأقل!', 'info');
             return;
        }
        
        const multiplierIndex = currentStep - 1;
        // Guard against out of bounds or undefined
        const finalMultiplier = difficultySettings[difficulty].multipliers[multiplierIndex] || 1.0;
        const finalWinnings = bet * finalMultiplier;
        setWinnings(finalWinnings);

        const success = await onBalanceUpdate(finalWinnings, 'chickenRoad');
        if (success) {
            setGameState('won');
            addToHistory(finalMultiplier, true);
            addToast(`تم السحب! ربحت ${formatNumber(finalWinnings)} 💎`, 'success');
            if (finalWinnings > 10000 && userProfile?.displayName) {
                onAnnounceWin(userProfile.displayName, finalWinnings, 'chickenRoad');
            }
            if (finalWinnings > bet * 3) {
                setShowConfetti(true);
            }
        } else {
            addToast('حدث خطأ أثناء السحب.', 'error');
            setGameState('busted');
        }
    }, [gameState, chickenStep, bet, difficulty, onBalanceUpdate, addToast, userProfile?.displayName, onAnnounceWin]);

    const controlsDisabled = gameState !== 'betting';

    return (
        <div className="w-full h-full flex flex-col items-center justify-between p-1 relative">
             <HowToPlay>
                <p>1. اختر مستوى الصعوبة ومبلغ الرهان.</p>
                <p>2. اضغط "بدء اللعبة".</p>
                <p>3. ساعد الدجاجة في عبور الطريق بالضغط على زر <strong>"تقدم"</strong>.</p>
                <p>4. كل خطوة تنجح فيها يزداد الربح.</p>
                <p>5. احذر من السيارات! إذا صدمتك تخسر الرهان.</p>
                <p>6. يمكنك سحب أرباحك في أي وقت قبل الاصطدام.</p>
             </HowToPlay>

             {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

             {/* Header / Multiplier Display */}
             <div className="w-full flex justify-between items-center px-4 py-2 bg-gray-900/50 rounded-lg mb-2">
                 <div className="flex flex-col">
                     <span className="text-xs text-gray-400">المضاعف الحالي</span>
                     <span className="text-2xl font-bold text-yellow-300">x{currentMultiplier.toFixed(2)}</span>
                 </div>
                 <div className="flex flex-col items-end">
                     <span className="text-xs text-gray-400">الربح المتوقع</span>
                     <span className="text-2xl font-bold text-green-400">{formatNumber(currentPotentialWin)}</span>
                 </div>
             </div>

             {/* The Road / Steps */}
             <div className="flex-grow w-full flex flex-col-reverse justify-evenly items-center gap-2 py-4">
                 {Array.from({ length: STEPS }).map((_, index) => {
                     const stepIndex = index + 1; // 1 to 5
                     const isCurrent = chickenStep === stepIndex;
                     const isPassed = chickenStep > stepIndex;
                     const multiplier = difficultySettings[difficulty].multipliers[index];
                     
                     return (
                         <div key={index} className={`w-full max-w-xs h-12 rounded-lg flex items-center justify-between px-4 transition-all duration-300 border-2 
                             ${isCurrent ? 'bg-blue-600 border-blue-400 shadow-lg scale-105' : 
                               isPassed ? 'bg-green-600/50 border-green-500/50 opacity-60' : 
                               'bg-gray-800 border-gray-700'}
                         `}>
                             <span className="font-bold text-white">x{multiplier.toFixed(2)}</span>
                             {isCurrent && <div className="text-3xl animate-bounce"><ChickenIcon className="w-8 h-8"/></div>}
                             {gameState === 'busted' && chickenStep === index && <span className="text-2xl">💥</span>}
                         </div>
                     );
                 })}
                 
                 {/* Start Line */}
                 <div className={`w-full max-w-xs h-2 rounded-full ${chickenStep === 0 ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
                 {chickenStep === 0 && gameState !== 'busted' && <div className="text-3xl -mt-6"><ChickenIcon className="w-8 h-8"/></div>}
             </div>
             
             {/* History */}
             <div className="w-full overflow-x-auto flex gap-2 py-2 px-2 no-scrollbar h-10">
                 {history.map(h => (
                     <div key={h.id} className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap flex items-center ${h.win ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                         {h.multiplier.toFixed(2)}x
                     </div>
                 ))}
             </div>

             {/* Controls */}
             <div className="w-full bg-gray-800 p-4 rounded-t-2xl border-t border-gray-700">
                 {gameState === 'betting' ? (
                     <div className="flex flex-col gap-4">
                         {/* Difficulty Selection */}
                         <div className="flex gap-2 bg-gray-900/50 p-1 rounded-lg">
                             {(['easy', 'medium', 'hard', 'hardcore'] as Difficulty[]).map(d => (
                                 <button
                                     key={d}
                                     onClick={() => setDifficulty(d)}
                                     className={`flex-1 py-2 rounded text-xs font-bold transition-colors ${difficulty === d ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                                 >
                                     {difficultySettings[d].name}
                                 </button>
                             ))}
                         </div>

                         {/* Bet Amount */}
                         <div>
                             <div className="flex justify-between text-gray-400 text-xs mb-1">
                                 <span>مبلغ الرهان</span>
                                 <span>رصيدك: {formatNumber(userProfile?.balance || 0)}</span>
                             </div>
                             <div className="flex gap-2 mb-2">
                                 {QUICK_BETS.map(amt => (
                                     <button key={amt} onClick={() => setBet(amt)} className={`flex-1 py-2 bg-gray-700 rounded text-xs font-bold ${bet === amt ? 'border border-yellow-500 text-yellow-500' : 'text-gray-300'}`}>
                                         {formatNumber(amt)}
                                     </button>
                                 ))}
                             </div>
                             <input 
                                 type="number" 
                                 value={bet} 
                                 onChange={(e) => setBet(Number(e.target.value))} 
                                 className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-center text-xl font-bold text-white focus:border-purple-500 outline-none"
                             />
                         </div>
                         
                         <button onClick={handleStartGame} className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-xl text-xl font-black text-white shadow-lg hover:scale-[1.02] transition-transform">
                             بدء اللعبة
                         </button>
                     </div>
                 ) : (
                     <div className="flex flex-col gap-3">
                         {gameState === 'playing' ? (
                             <div className="flex gap-3">
                                 <button onClick={handleContinue} className="flex-1 py-4 bg-blue-600 rounded-xl text-white font-bold text-xl shadow-[0_4px_0_rgb(30,64,175)] active:shadow-none active:translate-y-1 transition-all">
                                     تقدم ⬆️
                                 </button>
                                 {chickenStep > 0 && (
                                     <button onClick={() => handleCashOut()} className="flex-1 py-4 bg-green-600 rounded-xl text-white font-bold text-xl shadow-[0_4px_0_rgb(21,128,61)] active:shadow-none active:translate-y-1 transition-all">
                                         سحب {formatNumber(currentPotentialWin)}
                                     </button>
                                 )}
                             </div>
                         ) : (
                             <button onClick={resetGame} className="w-full py-4 bg-gray-700 rounded-xl text-white font-bold text-xl">
                                 لعب مجدداً
                             </button>
                         )}
                     </div>
                 )}
             </div>
        </div>
    );
};

export default ChickenRoadGame;
