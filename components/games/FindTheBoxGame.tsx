
import React, { useState, useCallback, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import HowToPlay from '../HowToPlay';
import { useGameLoop } from '../hooks/useGameLoop';
import GameTimerDisplay from '../GameTimerDisplay';

interface UserProfile extends AppUser {
    balance: number;
}

interface FindTheBoxGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const BOX_COUNT = 3;
const WIN_MULTIPLIER = 3;
const PREPARATION_TIME = 10;
const GAME_TIME = 3;
const RESULTS_TIME = 4;

const FindTheBoxGame: React.FC<FindTheBoxGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [selectedBox, setSelectedBox] = useState<number | null>(null);
    const [winningBox, setWinningBox] = useState<number | null>(null);
    const [result, setResult] = useState<'win' | 'loss' | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    const handleRoundStart = async () => {
        if (selectedBox === null) {
            addToast("الرجاء اختيار صندوق قبل بدء الجولة.", "info");
            return;
        }
        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
            addToast("الرهان غير صالح أو رصيدك غير كافٍ.", "error");
            return;
        }

        const success = await onBalanceUpdate(-bet, 'findTheBox');
        if (!success) return;

        const winner = Math.floor(Math.random() * BOX_COUNT);
        setWinningBox(winner);

        if (selectedBox === winner) {
            const winnings = bet * WIN_MULTIPLIER;
            setResult('win');
            onBalanceUpdate(winnings, 'findTheBox');
            addToast(`لقد ربحت ${formatNumber(winnings)} 💎!`, 'success');
            if (winnings > 10000 && userProfile.displayName) {
                onAnnounceWin(userProfile.displayName, winnings, 'findTheBox');
            }
            if (winnings > bet * 5) {
                setShowConfetti(true);
            }
        } else {
            setResult('loss');
            addToast("لم يكن هذا الصندوق الصحيح!", "info");
        }
    };

    const resetGame = useCallback(() => {
        setSelectedBox(null);
        setWinningBox(null);
        setResult(null);
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
    
    const controlsDisabled = phase !== 'preparing';

    const getResultMessage = () => {
        if (phase !== 'results' || !result) return null;
        if (result === 'win') {
            return <div className="text-green-400">🎉 لقد فزت بـ {formatNumber(bet * WIN_MULTIPLIER)} 💎!</div>;
        } else {
            return <div className="text-red-500">حظ أفضل في المرة القادمة.</div>;
        }
    };

    return (
        <div className="flex flex-col items-center justify-between h-full p-4 relative">
            {showConfetti && <Confetti onComplete={() => {}} />}
            
            <HowToPlay>
                 <p>1. حدد مبلغ الرهان.</p>
                 <p>2. اختر أحد الصناديق الثلاثة (🎁).</p>
                 <p>3. انتظر كشف النتائج.</p>
                 <p>4. هناك جائزة (💎) مخبأة في صندوق واحد فقط.</p>
                 <p>5. إذا كان اختيارك صحيحاً، ستربح 3 أضعاف رهانك!</p>
            </HowToPlay>

            <GameTimerDisplay phase={phase} timeRemaining={timeRemaining} totalTime={totalTime} />

            <div className="flex-grow w-full flex items-center justify-center my-4">
                <div className="grid grid-cols-3 gap-4 sm:gap-8 w-full max-w-xl">
                    {[...Array(BOX_COUNT)].map((_, index) => {
                        const isSelected = selectedBox === index;
                        const isWinner = winningBox === index;
                        const isRevealed = winningBox !== null;
                        
                        let boxStyle = 'bg-gray-700 border-gray-600';
                        if (controlsDisabled && isSelected) boxStyle = 'bg-yellow-600 border-yellow-400 scale-105';
                        if (isRevealed) {
                           if (isWinner) {
                               boxStyle = 'bg-green-500 border-green-300 scale-110 animate-pulse';
                           } else if (isSelected) {
                               boxStyle = 'bg-red-600 border-red-400 opacity-50';
                           } else {
                               boxStyle = 'bg-gray-800 border-gray-700 opacity-50';
                           }
                        }

                        return (
                             <button
                                key={index}
                                onClick={() => setSelectedBox(index)}
                                disabled={controlsDisabled}
                                className={`aspect-square rounded-2xl border-4 flex items-center justify-center text-6xl sm:text-7xl transition-all duration-300 transform disabled:cursor-default 
                                ${!controlsDisabled ? 'hover:scale-105' : ''} ${boxStyle}`}
                            >
                                {isRevealed && isWinner ? '💎' : isRevealed ? '❌' : '🎁'}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="h-10 text-xl font-bold text-center mt-2 game-container-animation">
                {getResultMessage()}
            </div>
            
            <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={controlsDisabled} />
        </div>
    );
};

export default FindTheBoxGame;
