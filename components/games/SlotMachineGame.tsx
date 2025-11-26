
import React, { useState, useEffect, useCallback } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';

interface UserProfile extends AppUser {
    balance: number;
}

interface SlotMachineGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
const PAYOUTS: { [key: string]: number } = {
    '🍒': 2, '🍋': 2, '🍊': 2, '🍇': 2, // Any 3 fruits
    '🔔🔔🔔': 10,
    '💎💎💎': 25,
    '7️⃣7️⃣7️⃣': 100,
};

const Reel: React.FC<{ symbols: string[]; finalSymbol: string; spinning: boolean }> = ({ symbols, finalSymbol, spinning }) => {
    const [displaySymbols, setDisplaySymbols] = useState<string[]>([]);

    useEffect(() => {
        if (spinning) {
            const interval = setInterval(() => {
                setDisplaySymbols(Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]));
            }, 80);
            return () => clearInterval(interval);
        } else {
            setDisplaySymbols(['', finalSymbol, '']);
        }
    }, [spinning, finalSymbol, symbols]);
    
    return (
        <div className="w-24 h-32 sm:w-32 sm:h-40 bg-gray-900/50 rounded-lg overflow-hidden relative border-2 border-gray-600">
            <div className={`absolute w-full h-full flex flex-col justify-center transition-opacity duration-200 ${spinning ? 'opacity-80 blur-[1px]' : 'opacity-100'}`}>
                {displaySymbols.map((s, i) => (
                    <div key={i} className="flex-1 flex items-center justify-center text-5xl sm:text-6xl">
                        {s}
                    </div>
                ))}
            </div>
        </div>
    );
};

const SlotMachineGame: React.FC<SlotMachineGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [reels, setReels] = useState(['7️⃣', '7️⃣', '7️⃣']);
    const [spinning, setSpinning] = useState(false);
    const [resultMessage, setResultMessage] = useState<React.ReactNode | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    const handleSpin = async () => {
        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }
        setSpinning(true);
        setResultMessage(null);
        setShowConfetti(false);
        const success = await onBalanceUpdate(-bet, 'slotMachine');
        if (!success) {
            setSpinning(false);
            return;
        }

        setTimeout(() => {
            const newReels = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
            setReels(newReels);

            let winnings = 0;
            const key = newReels.join('');
            if (PAYOUTS[key]) {
                winnings = bet * PAYOUTS[key];
            } else if (newReels.every(s => ['🍒', '🍋', '🍊', '🍇'].includes(s))) {
                 if (newReels[0] === newReels[1] && newReels[1] === newReels[2]) {
                    winnings = bet * 5; // 3 of a kind fruit
                 } else {
                    winnings = bet * PAYOUTS['🍒']; // Any 3 fruits
                 }
            }
            
            if (winnings > 0) {
                onBalanceUpdate(winnings, 'slotMachine');
                setResultMessage(<span className="text-green-400">🎉 لقد ربحت {formatNumber(winnings)} 💎!</span>);
                if (winnings > 10000 && userProfile.displayName) {
                    onAnnounceWin(userProfile.displayName, winnings, 'slotMachine');
                }
                if (winnings > bet * 20) {
                    setShowConfetti(true);
                }
            } else {
                setResultMessage(<span className="text-gray-400">حظ أفضل في المرة القادمة!</span>);
            }

            setSpinning(false);
        }, 2000); // 2 seconds of spinning
    };

    return (
        <div className="flex flex-col items-center justify-around h-full p-4 relative">
             {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
             
            <div className="p-4 sm:p-6 bg-gray-800 rounded-2xl border-4 border-yellow-500 shadow-lg shadow-yellow-800/40">
                <div className="flex justify-center items-center gap-4 sm:gap-6 relative">
                    <Reel symbols={SYMBOLS} finalSymbol={reels[0]} spinning={spinning} />
                    <Reel symbols={SYMBOLS} finalSymbol={reels[1]} spinning={spinning} />
                    <Reel symbols={SYMBOLS} finalSymbol={reels[2]} spinning={spinning} />
                    {/* Payline */}
                    <div className="absolute w-full h-1 bg-red-500/70 top-1/2 -translate-y-1/2 shadow-md shadow-red-500/50"></div>
                </div>
            </div>

            <div className="h-10 text-xl font-bold text-center game-container-animation">
                {resultMessage}
            </div>

            <div className="w-full max-w-sm flex flex-col items-center gap-4">
                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={spinning} />
                <button onClick={handleSpin} disabled={spinning} className="w-full py-4 mt-4 text-2xl font-bold bg-gradient-to-r from-red-600 to-yellow-500 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-wait">
                    {spinning ? 'جاري اللف...' : 'لــف!'}
                </button>
            </div>
        </div>
    );
};

export default SlotMachineGame;
