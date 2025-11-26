
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import ChickenIcon from '../icons/ChickenIcon';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import DiamondIcon from '../icons/DiamondIcon';
import BetControls from '../BetControls';

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
    
    const chickenStepRef = useRef(chickenStep);
    useEffect(() => { chickenStepRef.current = chickenStep; }, [chickenStep]);
    
    const currentMultiplier = useMemo(() => {
        if (chickenStep === 0) return 1;
        return difficultySettings[difficulty].multipliers[chickenStep - 1] || 1;
    }, [chickenStep, difficulty]);
    
    const currentPotentialWin = useMemo(() => {
        if (chickenStep === 0) return bet; 
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
            setChickenStep(0);
        }
    };
    
    const handleCashOut = useCallback(async (isAuto = false) => {
        if (gameState !== 'playing') return;
        
        const currentStep = isAuto ? chickenStepRef.current : chickenStep;

        if (currentStep === 0 && !isAuto) {
             addToast('يجب أن تتحرك خطوة واحدة على الأقل!', 'info');
             return;
        }
        
        const multiplierIndex = currentStep - 1;
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

    const handleContinue = () => {
        if (gameState !== 'playing') return;

        const isBusted = Math.random() < difficultySettings[difficulty].collisionChance;
        
        if (isBusted) {
            setGameState('busted');
            addToHistory(0, false);
        } else {
            const nextStep = chickenStep + 1;
            setChickenStep(nextStep);
            if (nextStep >= STEPS) {
                setTimeout(() => handleCashOut(true), 500); 
            }
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-between p-1 relative overflow-hidden">
             {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

             {/* Header / Multiplier Display */}
             <div className="w-full flex justify-between items-center px-4 py-2 bg-gray-900/50 rounded-lg mb-2">
                 <div className="flex flex-col">
                     <span className="text-xs text-gray-400">المضاعف الحالي</span>
                     <span className="text-2xl font-bold text-yellow-400 font-mono">x{currentMultiplier.toFixed(2)}</span>
                 </div>
                 <div className="flex flex-col items-end">
                     <span className="text-xs text-gray-400">الربح المتوقع</span>
                     <span className="text-xl font-bold text-green-400 flex items-center gap-1">
                         {formatNumber(currentPotentialWin)} <DiamondIcon className="w-4 h-4" />
                     </span>
                 </div>
             </div>

             {/* Game Visual Area */}
             <div className="flex-grow w-full flex flex-col justify-center items-center relative bg-gray-800/30 rounded-xl border border-gray-700 p-4 my-2">
                 <div className="w-full flex flex-col-reverse gap-2">
                     {Array.from({length: STEPS}).map((_, index) => {
                         const stepIndex = index + 1;
                         const isActive = chickenStep === stepIndex;
                         const isPassed = chickenStep > stepIndex;
                         const multipliers = difficultySettings[difficulty].multipliers;
                         
                         return (
                             <div key={index} className={`w-full h-12 rounded-lg flex items-center justify-between px-4 border-2 transition-all duration-300 
                                 ${isActive ? 'bg-yellow-500/20 border-yellow-400 scale-105' : 
                                   isPassed ? 'bg-green-500/20 border-green-500' : 
                                   'bg-gray-700/20 border-gray-600'}`}
                             >
                                 <span className={`font-mono font-bold ${isActive || isPassed ? 'text-white' : 'text-gray-500'}`}>
                                     x{multipliers[index].toFixed(2)}
                                 </span>
                                 {isActive && !showConfetti && gameState !== 'busted' && (
                                     <div className="text-3xl animate-bounce">🐔</div>
                                 )}
                                 {gameState === 'busted' && chickenStep === index && (
                                     <span className="text-3xl">💥</span>
                                 )}
                             </div>
                         );
                     })}
                     {/* Start Line */}
                     <div className={`w-full h-12 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-500 ${chickenStep === 0 ? 'bg-gray-700' : 'opacity-50'}`}>
                         {chickenStep === 0 && gameState !== 'busted' && <span className="text-3xl">🐔</span>}
                         {chickenStep === 0 && gameState === 'busted' && <span className="text-3xl">💥</span>}
                         <span className="text-xs text-gray-400 absolute right-2">البداية</span>
                     </div>
                 </div>
             </div>

             {/* Difficulty Selection */}
             {gameState === 'betting' && (
                 <div className="w-full grid grid-cols-4 gap-2 mb-2">
                     {(['easy', 'medium', 'hard', 'hardcore'] as Difficulty[]).map((d) => (
                         <button
                             key={d}
                             onClick={() => setDifficulty(d)}
                             className={`py-2 rounded-lg text-xs font-bold transition-all
                                 ${difficulty === d 
                                     ? (d === 'easy' ? 'bg-green-600 text-white' : d === 'medium' ? 'bg-yellow-600 text-black' : d === 'hard' ? 'bg-orange-600 text-white' : 'bg-red-600 text-white')
                                     : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                 }`}
                         >
                             {difficultySettings[d].name}
                         </button>
                     ))}
                 </div>
             )}

             {/* Controls */}
             <div className="w-full bg-gray-800/80 p-3 rounded-xl border border-gray-700 backdrop-blur-sm">
                 {gameState === 'betting' ? (
                     <>
                         <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={false} />
                         <button onClick={handleStartGame} className="w-full mt-3 py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-lg shadow-lg transition">
                             بدء اللعب
                         </button>
                     </>
                 ) : gameState === 'playing' ? (
                     <div className="flex gap-3">
                         <button onClick={() => handleCashOut(false)} className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xl rounded-lg shadow-lg transition disabled:opacity-50" disabled={chickenStep === 0}>
                             سحب {formatNumber(currentPotentialWin)}
                         </button>
                         <button onClick={handleContinue} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-lg shadow-lg transition">
                             تقدم ⬆️
                         </button>
                     </div>
                 ) : (
                     <button onClick={resetGame} className={`w-full py-3 font-bold text-xl rounded-lg shadow-lg transition text-white ${gameState === 'won' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                         {gameState === 'won' ? 'لعب مرة أخرى' : 'حاول مرة أخرى'}
                     </button>
                 )}
             </div>
        </div>
    );
};

export default ChickenRoadGame;
