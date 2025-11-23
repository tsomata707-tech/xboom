
import React, { useState, useCallback } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface DiceRollGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const DICE_FACES: { [key: number]: string } = {
    1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅'
};

const WIN_MULTIPLIER = 5;

const DiceRollGame: React.FC<DiceRollGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
    const [diceResult, setDiceResult] = useState<number>(1);
    const [isRolling, setIsRolling] = useState(false);
    const [resultMessage, setResultMessage] = useState<React.ReactNode | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    const handleRoll = async () => {
        if (isRolling) return;
        if (selectedNumber === null) {
            addToast('الرجاء اختيار رقم للمراهنة عليه.', 'info');
            return;
        }
        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }

        setIsRolling(true);
        setResultMessage(null);
        setShowConfetti(false);
        const success = await onBalanceUpdate(-bet, 'diceRoll');
        if (!success) {
            setIsRolling(false);
            return;
        }

        // Animation
        let rollCount = 0;
        const rollInterval = setInterval(() => {
            setDiceResult(Math.floor(Math.random() * 6) + 1);
            rollCount++;
            if (rollCount > 15) {
                clearInterval(rollInterval);
                finishRoll();
            }
        }, 100);

        const finishRoll = () => {
            const finalResult = Math.floor(Math.random() * 6) + 1;
            setDiceResult(finalResult);

            if (finalResult === selectedNumber) {
                const winnings = bet * WIN_MULTIPLIER;
                onBalanceUpdate(winnings, 'diceRoll');
                setResultMessage(<span className="text-green-400">🎉 لقد ربحت {formatNumber(winnings)} 💎!</span>);
                if (winnings > 10000 && userProfile.displayName) {
                    onAnnounceWin(userProfile.displayName, winnings, 'diceRoll');
                }
                if (winnings > bet * 10) {
                    setShowConfetti(true);
                }
            } else {
                setResultMessage(<span className="text-red-500">خسرت! كان الرقم {finalResult}.</span>);
            }
            setIsRolling(false);
        };
    };

    return (
        <div className="flex flex-col items-center justify-around h-full p-4 relative">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <HowToPlay>
                <p>1. حدد مبلغ الرهان.</p>
                <p>2. اختر رقماً واحداً من 1 إلى 6 تتوقع ظهوره.</p>
                <p>3. اضغط على زر <strong>"ارمِ النرد!"</strong>.</p>
                <p>4. إذا ظهر الرقم الذي اخترته، تفوز بـ 5 أضعاف رهانك!</p>
            </HowToPlay>

            <div className="my-8 text-8xl sm:text-9xl text-white transition-transform duration-100" style={{ transform: isRolling ? `rotate(${Math.random() * 360}deg) scale(0.9)` : '' }}>
                {DICE_FACES[diceResult]}
            </div>

            <div className="h-10 text-xl font-bold text-center game-container-animation">
                {resultMessage}
            </div>
            
            <div className="w-full max-w-lg flex flex-col items-center gap-4">
                <p className="font-bold text-gray-300">اختر رقمًا:</p>
                <div className="grid grid-cols-6 gap-2 sm:gap-4 w-full">
                    {[1, 2, 3, 4, 5, 6].map(num => (
                        <button
                            key={num}
                            onClick={() => setSelectedNumber(num)}
                            disabled={isRolling}
                            className={`aspect-square text-2xl sm:text-3xl font-bold rounded-lg border-4 transition-all duration-300
                            ${selectedNumber === num ? 'border-yellow-400 bg-yellow-400/20 scale-110' : 'border-gray-600 bg-gray-700'}
                            disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {DICE_FACES[num]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-6">
                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={isRolling} />
                <button onClick={handleRoll} disabled={isRolling} className="w-full py-4 mt-4 text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-wait">
                    {isRolling ? 'جاري الرمي...' : 'ارمِ النرد!'}
                </button>
            </div>
        </div>
    );
};

export default DiceRollGame;
