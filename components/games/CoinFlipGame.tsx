
import React, { useState, useCallback } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import { useGameLoop } from '../hooks/useGameLoop';
import GameTimerDisplay from '../GameTimerDisplay';
import HowToPlay from '../HowToPlay';


interface UserProfile extends AppUser {
    balance: number;
}

interface CoinFlipGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

type Choice = 'king' | 'writing';
type Result = 'win' | 'loss';

const PREPARATION_TIME = 10;
const GAME_TIME = 10;
const RESULTS_TIME = 4;

const CoinFlipGame: React.FC<CoinFlipGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const [bet, setBet] = useState(25);
    const [choice, setChoice] = useState<Choice | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [winningSide, setWinningSide] = useState<Choice | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const { addToast } = useToast();

    const handleFlip = useCallback(async () => {
        if (!choice) {
            addToast('يجب اختيار جانب قبل بدء الجولة.', 'info');
            // Allow the round to continue but the player loses by default if no choice is made.
            setWinningSide(Math.random() < 0.5 ? 'king' : 'writing');
            setResult('loss');
            return;
        }
        if (!userProfile) return;
        if (bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ. سيتم تخطي هذه الجولة.', 'error');
            setResult(null); // No result as bet wasn't placed
            return;
        }

        const success = await onBalanceUpdate(-bet, 'coinFlip');
        if (!success) {
            // If balance update fails, don't proceed.
             setResult(null);
            return;
        };

        const randomResult: Choice = Math.random() < 0.5 ? 'king' : 'writing';
        setWinningSide(randomResult);

        setTimeout(() => {
            if (randomResult === choice) {
                const winnings = bet * 2;
                onBalanceUpdate(winnings, 'coinFlip');
                setResult('win');
                addToast(`لقد فزت بـ ${formatNumber(winnings)} 💎!`, 'success');
                if (winnings > 10000 && userProfile.displayName) {
                    onAnnounceWin(userProfile.displayName, winnings, 'coinFlip');
                }
                if (winnings > bet * 10) {
                    setShowConfetti(true);
                }
            } else {
                setResult('loss');
                addToast('حظ أفضل في المرة القادمة!', 'info');
            }
        }, 1300); // Animation timeout

    }, [choice, bet, userProfile, onBalanceUpdate, addToast, onAnnounceWin]);
    
    const resetGame = useCallback(() => {
        setChoice(null);
        setResult(null);
        setWinningSide(null);
    }, []);

    const { phase, timeRemaining, totalTime } = useGameLoop({
        onRoundStart: handleFlip,
        onRoundEnd: resetGame
    }, {
        preparationTime: PREPARATION_TIME,
        gameTime: GAME_TIME,
        resultsTime: RESULTS_TIME,
    });
    
    const getCoinClasses = () => {
        if (phase !== 'running' && phase !== 'results') return '';
        if (winningSide) {
             return winningSide === 'king' ? 'flipping-king' : 'flipping-writing';
        }
        return '';
    };
    
    const getResultMessage = () => {
        if ((phase !== 'running' && phase !== 'results') || !result) return null;
        if (result === 'win') {
            return (
                <div className="game-text font-bold text-green-400 game-container-animation">
                    🎉 لقد فزت بـ {formatNumber(bet * 2)} 💎!
                </div>
            );
        } else {
             return (
                <div className="game-text font-bold text-red-400 game-container-animation">
                    {choice ? 'لقد خسرت رهانك.' : 'لم تختر جانبًا.'}
                </div>
            );
        }
    }

    const controlsDisabled = phase !== 'preparing';

    return (
        <div className="flex flex-col items-center p-2 game-container h-full justify-start gap-2 relative">
            <HowToPlay>
                <p>1. حدد مبلغ الرهان الذي تريد المشاركة به.</p>
                <p>2. اختر وجهاً للعملة: إما <strong>"ملك"</strong> أو <strong>"كتابة"</strong>.</p>
                <p>3. انتظر انتهاء وقت التجهيز ليتم رمي العملة.</p>
                <p>4. إذا سقطت العملة على الوجه الذي اخترته، تربح ضعف رهانك (x2).</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <GameTimerDisplay 
                phase={phase} 
                timeRemaining={timeRemaining}
                totalTime={totalTime}
            />

            <div className="coin-container my-2 game-board">
                <div className={`coin ${getCoinClasses()}`}>
                    <div className="coin-face coin-face-front">👑</div>
                    <div className="coin-face coin-face-back">✍️</div>
                </div>
            </div>

            <div className="h-8 mb-2 flex items-center justify-center">
                {getResultMessage()}
            </div>
            
            <div className="w-full max-w-sm flex flex-col items-center gap-2">
                 <h3 className="text-lg font-bold text-gray-300">اختر جانبك</h3>
                 <div className="flex gap-4">
                    <button 
                        onClick={() => setChoice('king')}
                        disabled={controlsDisabled}
                        className={`game-item py-2 text-2xl font-bold rounded-lg border-4 transition-all duration-300 ${choice === 'king' && !controlsDisabled ? 'border-yellow-400 bg-yellow-400/20 scale-110' : 'border-gray-600 bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        👑 ملك
                    </button>
                    <button 
                        onClick={() => setChoice('writing')}
                        disabled={controlsDisabled}
                        className={`game-item py-2 text-2xl font-bold rounded-lg border-4 transition-all duration-300 ${choice === 'writing' && !controlsDisabled ? 'border-yellow-400 bg-yellow-400/20 scale-110' : 'border-gray-600 bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        ✍️ كتابة
                    </button>
                 </div>
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

export default CoinFlipGame;
