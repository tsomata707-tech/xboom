
import React, { useState, useCallback, useMemo } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import HowToPlay from '../HowToPlay';
import { useGameLoop } from '../hooks/useGameLoop';
import GameTimerDisplay from '../GameTimerDisplay';

interface UserProfile extends AppUser {
    balance: number;
}

interface NumberGuessGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const NUMBERS = Array.from({ length: 10 }, (_, i) => i + 1);
const WIN_MULTIPLIER = 9;
const MAX_BETS = 5;
const PREPARATION_TIME = 10;
const GAME_TIME = 3;
const RESULTS_TIME = 4;

const NumberGuessGame: React.FC<NumberGuessGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bets, setBets] = useState<{ [key: number]: number }>({});
    const [betAmount, setBetAmount] = useState(100);
    const [winningNumber, setWinningNumber] = useState<number | null>(null);
    const [winnings, setWinnings] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    const totalBet = useMemo(() => Object.values(bets).reduce((sum: number, val: number) => sum + val, 0), [bets]);
    const bettedCount = useMemo(() => Object.keys(bets).length, [bets]);

    const handleRoundStart = async () => {
        if (totalBet === 0) return;
        if (!userProfile || totalBet > userProfile.balance) {
            addToast("رصيدك غير كافٍ.", "error");
            return;
        }

        const success = await onBalanceUpdate(-totalBet, 'numberGuess');
        if (!success) return;

        const winner = Math.floor(Math.random() * 10) + 1;
        setWinningNumber(winner);

        const winAmount = (bets[winner] || 0) * WIN_MULTIPLIER;
        setWinnings(winAmount);

        if (winAmount > 0) {
            onBalanceUpdate(winAmount, 'numberGuess');
            addToast(`لقد ربحت ${formatNumber(winAmount)} 💎!`, 'success');
            if (winAmount > 10000 && userProfile.displayName) {
                onAnnounceWin(userProfile.displayName, winAmount, 'numberGuess');
            }
             if (winAmount > totalBet * 10) {
                setShowConfetti(true);
            }
        }
    };

    const resetGame = useCallback(() => {
        setBets({});
        setWinningNumber(null);
        setWinnings(0);
        setShowConfetti(false);
    }, []);
    
    const { phase, timeRemaining, totalTime } = useGameLoop({
        onRoundStart: handleRoundStart,
        onRoundEnd: resetGame,
    }, {
        preparationTime: PREPARATION_TIME,
        gameTime: GAME_TIME,
        resultsTime: RESULTS_TIME,
    });
    
    const placeBet = (num: number) => {
        if (bettedCount >= MAX_BETS && !bets[num]) {
            addToast(`يمكنك المراهنة على ${MAX_BETS} أرقام كحد أقصى.`, 'info');
            return;
        }
        setBets(prev => ({
            ...prev,
            [num]: (prev[num] || 0) + betAmount
        }));
    };

    const controlsDisabled = phase !== 'preparing';
    const quickBets = [25, 100, 500, 1000];

    return (
        <div className="flex flex-col items-center justify-between h-full p-2 sm:p-4 relative">
            {showConfetti && <Confetti onComplete={() => {}} />}
            
            <HowToPlay>
                <p>1. حدد مبلغ الرهان لكل رقم.</p>
                <p>2. اضغط على الأرقام التي تتوقع فوزها (من 1 إلى 10).</p>
                <p>3. يمكنك اختيار حتى 5 أرقام مختلفة.</p>
                <p>4. انتظر انتهاء المؤقت.</p>
                <p>5. إذا فاز رقمك، تحصل على 9 أضعاف المبلغ الذي راهنت به على هذا الرقم!</p>
            </HowToPlay>

            <GameTimerDisplay phase={phase} timeRemaining={timeRemaining} totalTime={totalTime} />
            
            <div className="flex-grow w-full flex items-center justify-center my-4">
                <div className="grid grid-cols-5 gap-2 sm:gap-4 w-full max-w-xl">
                    {NUMBERS.map(num => {
                        const isWinner = winningNumber === num;
                        const betValue = bets[num] || 0;
                        let tileStyle = 'bg-gray-700 border-gray-600';
                        if (phase === 'results') {
                            if (isWinner) {
                                tileStyle = 'bg-yellow-500 border-yellow-300 scale-110 ring-4 ring-yellow-400 shadow-lg';
                            } else {
                                tileStyle = 'bg-gray-800 border-gray-700 opacity-40';
                            }
                        }

                        return (
                             <div key={num} className="relative">
                                <button
                                    onClick={() => placeBet(num)}
                                    disabled={controlsDisabled}
                                    className={`aspect-square rounded-lg border-4 flex items-center justify-center text-2xl sm:text-3xl font-bold transition-all duration-300 disabled:cursor-default 
                                        ${!controlsDisabled ? 'hover:scale-105 hover:border-cyan-400' : ''} ${tileStyle}`}
                                >
                                    {num}
                                </button>
                                {betValue > 0 && (
                                    <div className="absolute -bottom-2 right-1/2 translate-x-1/2 bg-purple-600 text-white px-2 py-0.5 rounded-full text-xs font-bold border-2 border-purple-400 pointer-events-none">
                                        {formatNumber(betValue)}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="h-8 text-xl font-bold text-center mt-2 game-container-animation">
                {phase === 'results' && winnings > 0 && <span className="text-green-400">🎉 لقد ربحت {formatNumber(winnings)} 💎!</span>}
                {phase === 'results' && winnings === 0 && <span className="text-red-500">حظ أفضل في المرة القادمة!</span>}
            </div>

            <div className="w-full max-w-lg bg-gray-900/50 p-3 sm:p-4 rounded-2xl border border-gray-700 mt-4">
                <div className="flex justify-between items-center mb-3 px-1">
                    <h3 className="text-sm sm:text-lg font-bold">مقدار الرهان لكل نقرة</h3>
                    <div className="flex items-center gap-4">
                         <span className={`font-bold text-sm ${bettedCount >= MAX_BETS ? 'text-yellow-400' : 'text-gray-400'}`}>
                            ({bettedCount}/{MAX_BETS})
                        </span>
                        <div className="text-sm sm:text-lg">
                            <span>إجمالي:</span>
                            <span className="font-bold text-yellow-300 ml-2">{formatNumber(totalBet)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                    {quickBets.map(amount => (
                        <button key={amount} onClick={() => setBetAmount(amount)} disabled={controlsDisabled}
                            className={`flex-1 py-2 px-3 text-sm rounded-lg font-bold transition ${betAmount === amount ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>
                            {formatNumber(amount)}
                        </button>
                    ))}
                    <button onClick={() => setBets({})} disabled={controlsDisabled || totalBet === 0}
                        className="py-2 px-3 text-sm rounded-lg font-bold transition bg-red-800 hover:bg-red-700 disabled:opacity-50">
                        مسح
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NumberGuessGame;
