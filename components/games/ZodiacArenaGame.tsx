
import React, { useState, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import GameTimerDisplay from '../GameTimerDisplay';
import HowToPlay from '../HowToPlay';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const ZODIACS = [
    { name: 'الحمل', icon: '♈', color: 'text-red-500' },
    { name: 'الثور', icon: '♉', color: 'text-green-500' },
    { name: 'الجوزاء', icon: '♊', color: 'text-yellow-400' },
    { name: 'السرطان', icon: '♋', color: 'text-gray-300' },
    { name: 'الأسد', icon: '♌', color: 'text-orange-500' },
    { name: 'العذراء', icon: '♍', color: 'text-emerald-400' },
    { name: 'الميزان', icon: '♎', color: 'text-pink-400' },
    { name: 'العقرب', icon: '♏', color: 'text-purple-500' },
    { name: 'القوس', icon: '♐', color: 'text-blue-500' },
    { name: 'الجدي', icon: '♑', color: 'text-amber-700' },
    { name: 'الدلو', icon: '♒', color: 'text-cyan-400' },
    { name: 'الحوت', icon: '♓', color: 'text-indigo-400' },
];

const ZodiacArenaGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'spinning' | 'result'>('betting');
    const [timeLeft, setTimeLeft] = useState(15);
    const [bet, setBet] = useState(100);
    const [selectedSign, setSelectedSign] = useState<number | null>(null);
    const [winningSign, setWinningSign] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [spinIndex, setSpinIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (phase === 'betting') {
                        setPhase('spinning');
                        startSpin();
                        return 5;
                    } else if (phase === 'spinning') {
                        // handled by startSpin animation logic
                        return 0;
                    } else {
                        setPhase('betting');
                        setSelectedSign(null);
                        setWinningSign(null);
                        setShowConfetti(false);
                        return 15;
                    }
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const startSpin = () => {
        let speed = 50;
        let counter = 0;
        const maxSpins = 30 + Math.floor(Math.random() * 10); // Random spin count
        const finalSign = Math.floor(Math.random() * 12);
        
        const spinInterval = () => {
            setSpinIndex(prev => (prev + 1) % 12);
            counter++;
            
            if (counter < maxSpins) {
                speed += 5; // Slow down
                setTimeout(spinInterval, speed);
            } else {
                setSpinIndex(finalSign);
                resolveRound(finalSign);
            }
        };
        setTimeout(spinInterval, speed);
    };

    const resolveRound = (winner: number) => {
        setWinningSign(winner);
        setPhase('result');
        setTimeLeft(5);

        if (selectedSign === winner) {
            const win = bet * 10; // 10x Payout
            onBalanceUpdate(win, 'zodiacArena');
            addToast(`مبروك! فاز برج ${ZODIACS[winner].name}. ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else if (selectedSign !== null) {
            addToast(`فاز برج ${ZODIACS[winner].name}. حظ أوفر.`, 'error');
        }
    };

    const handleBet = async (index: number) => {
        if (phase !== 'betting') return;
        if (selectedSign !== null) return; // One bet per round
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'zodiacArena');
        if (success) {
            setSelectedSign(index);
            addToast(`تم الرهان على ${ZODIACS[index].name}`, 'success');
        }
    };

    return (
        <div className="flex flex-col h-full p-2 relative bg-[#0d0d16]">
            <HowToPlay>
                <p>1. اختر برجك المفضل للرهان عليه.</p>
                <p>2. انتظر انتهاء وقت الرهان لتبدأ العجلة بالدوران.</p>
                <p>3. يتم اختيار برج فائز واحد عشوائياً.</p>
                <p>4. إذا فاز برجك، تحصل على 10 أضعاف رهانك (x10)!</p>
            </HowToPlay>
            
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            <GameTimerDisplay phase={phase === 'betting' ? 'preparing' : phase === 'spinning' ? 'running' : 'results'} timeRemaining={timeLeft} totalTime={phase === 'betting' ? 15 : 5} />

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 my-4 flex-grow overflow-y-auto">
                {ZODIACS.map((sign, i) => {
                    const isSelected = selectedSign === i;
                    const isWinner = winningSign === i;
                    const isSpinning = phase === 'spinning' && spinIndex === i;

                    return (
                        <button
                            key={i}
                            onClick={() => handleBet(i)}
                            disabled={phase !== 'betting' || (selectedSign !== null && !isSelected)}
                            className={`
                                rounded-xl p-2 flex flex-col items-center justify-center border-2 transition-all duration-300
                                ${isSelected ? 'bg-purple-900/80 border-purple-400 scale-105 shadow-[0_0_15px_#a855f7]' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700'}
                                ${isWinner ? 'bg-green-600 border-green-300 scale-110 shadow-[0_0_20px_#4ade80] z-10' : ''}
                                ${isSpinning ? 'bg-yellow-500/20 border-yellow-400 shadow-[0_0_10px_yellow]' : ''}
                                disabled:opacity-60 disabled:cursor-not-allowed
                            `}
                        >
                            <span className={`text-4xl mb-1 ${sign.color}`}>{sign.icon}</span>
                            <span className="font-bold text-sm text-gray-200">{sign.name}</span>
                            {isSelected && <span className="text-xs text-purple-300 mt-1">رهانك</span>}
                        </button>
                    );
                })}
            </div>

            <div className="mt-auto">
                 <div className="flex justify-center items-center mb-2">
                     <p className="text-yellow-300 font-bold text-sm">الجائزة: x10</p>
                 </div>
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            </div>
        </div>
    );
};

export default ZodiacArenaGame;
