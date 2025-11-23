
import React, { useState, useCallback, useMemo } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import HowToPlay from '../HowToPlay';
import { useGameLoop } from '../hooks/useGameLoop';
import GameTimerDisplay from '../GameTimerDisplay';
import BetControls from '../BetControls';

interface UserProfile extends AppUser {
    balance: number;
}

interface GuessColorGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const COLORS = [
    { id: 'red', name: 'أحمر', bg: 'bg-red-600', hover: 'hover:bg-red-500', ring: 'ring-red-400' },
    { id: 'green', name: 'أخضر', bg: 'bg-green-600', hover: 'hover:bg-green-500', ring: 'ring-green-400' },
    { id: 'blue', name: 'أزرق', bg: 'bg-blue-600', hover: 'hover:bg-blue-500', ring: 'ring-blue-400' },
    { id: 'yellow', name: 'أصفر', bg: 'bg-yellow-500', hover: 'hover:bg-yellow-400', ring: 'ring-yellow-300' },
];
const MULTIPLIER = 4;
const PREPARATION_TIME = 10;
const GAME_TIME = 2; // Short time for revealing
const RESULTS_TIME = 4;

const GuessColorGame: React.FC<GuessColorGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [winningColor, setWinningColor] = useState<string | null>(null);
    const [winnings, setWinnings] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    const handleRoundStart = async () => {
        if (!selectedColor) return;
        if (!userProfile || bet > userProfile.balance) {
            addToast("رصيدك غير كافٍ لإتمام الرهان.", "error");
            return;
        }

        const success = await onBalanceUpdate(-bet, 'guessColor');
        if (!success) return;

        const winner = COLORS[Math.floor(Math.random() * COLORS.length)].id;
        setWinningColor(winner);

        let winAmount = 0;
        if (winner === selectedColor) {
            winAmount = bet * MULTIPLIER;
        }
        
        setWinnings(winAmount);

        if (winAmount > 0) {
            onBalanceUpdate(winAmount, 'guessColor');
            addToast(`لقد ربحت ${formatNumber(winAmount)} 💎!`, 'success');
            if (winAmount > 10000 && userProfile.displayName) {
                onAnnounceWin(userProfile.displayName, winAmount, 'guessColor');
            }
            if (winAmount > bet * 5) {
                setShowConfetti(true);
            }
        }
    };

    const resetGame = useCallback(() => {
        setSelectedColor(null);
        setWinningColor(null);
        setWinnings(0);
    }, []);

    const { phase, timeRemaining, totalTime } = useGameLoop({
        onRoundStart: handleRoundStart,
        onRoundEnd: resetGame,
    }, {
        preparationTime: PREPARATION_TIME,
        gameTime: GAME_TIME,
        resultsTime: RESULTS_TIME,
    });

    const controlsDisabled = phase !== 'preparing';

    return (
        <div className="flex flex-col items-center justify-between h-full p-4 relative">
             {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
             
             <HowToPlay>
                <p>1. قم بتحديد قيمة الرهان.</p>
                <p>2. اختر لوناً واحداً من الألوان الأربعة (أحمر، أخضر، أزرق، أصفر).</p>
                <p>3. انتظر انتهاء المؤقت.</p>
                <p>4. سيتم اختيار لون عشوائي. إذا تطابق مع اختيارك، تربح 4 أضعاف رهانك (x4)!</p>
            </HowToPlay>

             <GameTimerDisplay phase={phase} timeRemaining={timeRemaining} totalTime={totalTime} />

            <div className="flex-grow w-full flex items-center justify-center">
                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                {COLORS.map(color => {
                    const isWinner = winningColor === color.id;
                    const isSelected = selectedColor === color.id;
                    return (
                        <div key={color.id} className="relative aspect-square">
                            <button
                                onClick={() => setSelectedColor(color.id)}
                                disabled={controlsDisabled}
                                className={`w-full h-full rounded-2xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold transition-all duration-300 transform 
                                ${color.bg} ${!controlsDisabled ? color.hover + ' hover:scale-105' : ''} 
                                ${isSelected && !controlsDisabled ? 'ring-4 ring-offset-2 ring-offset-gray-800 ' + color.ring : ''}
                                disabled:opacity-50
                                ${phase === 'results' && !isWinner ? 'opacity-30' : ''}
                                ${isWinner ? `scale-110 ring-4 ring-offset-2 ring-offset-gray-800 ${color.ring} shadow-2xl` : ''}`}
                            >
                                {color.name}
                            </button>
                        </div>
                    );
                })}
                </div>
            </div>
            
            <div className="h-8 text-xl font-bold text-center mt-6 game-container-animation">
                {phase === 'results' && winnings > 0 && <span className="text-green-400">🎉 لقد ربحت {formatNumber(winnings)} 💎!</span>}
                {phase === 'results' && winnings === 0 && <span className="text-red-500">حظ أفضل في المرة القادمة!</span>}
            </div>

            <BetControls
                bet={bet}
                setBet={setBet}
                balance={userProfile?.balance ?? 0}
                disabled={controlsDisabled}
            />
        </div>
    );
};

export default GuessColorGame;
