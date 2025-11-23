
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

const POTIONS = [
    { id: 0, name: 'الأحمر', color: 'bg-red-500', ring: 'ring-red-400' },
    { id: 1, name: 'الأزرق', color: 'bg-blue-500', ring: 'ring-blue-400' },
    { id: 2, name: 'الأخضر', color: 'bg-green-500', ring: 'ring-green-400' },
    { id: 3, name: 'الأصفر', color: 'bg-yellow-500', ring: 'ring-yellow-400' },
];

const PotionLabGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'mixing' | 'result'>('betting');
    const [timeLeft, setTimeLeft] = useState(12);
    const [bet, setBet] = useState(100);
    const [selectedPotion, setSelectedPotion] = useState<number | null>(null);
    const [winningPotion, setWinningPotion] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (phase === 'betting') {
                        setPhase('mixing');
                        return 3;
                    } else if (phase === 'mixing') {
                        resolveMix();
                        return 5;
                    } else {
                        setPhase('betting');
                        setSelectedPotion(null);
                        setWinningPotion(null);
                        setShowConfetti(false);
                        return 12;
                    }
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const resolveMix = () => {
        const winner = Math.floor(Math.random() * 4);
        setWinningPotion(winner);
        setPhase('result');

        if (selectedPotion === winner) {
            const win = bet * 4;
            onBalanceUpdate(win, 'potionLab' as GameId);
            addToast(`نجحت الخلطة ${POTIONS[winner].name}! ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else if (selectedPotion !== null) {
            addToast(`فشلت الخلطة. الفائز هو اللون ${POTIONS[winner].name}.`, 'error');
        }
    };

    const handleBet = async (index: number) => {
        if (phase !== 'betting') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'potionLab' as GameId);
        if (success) {
            setSelectedPotion(index);
            addToast(`تم اختيار الجرعة ${POTIONS[index].name}`, 'success');
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-slate-900 relative overflow-hidden">
            <HowToPlay>
                <p>1. راهن على لون الجرعة التي ستنجح في التفاعل.</p>
                <p>2. اختر من بين 4 ألوان.</p>
                <p>3. إذا نجح اختيارك، تربح 4 أضعاف رهانك!</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="text-center mb-2">
                <h2 className="text-2xl font-bold text-cyan-300">مختبر الكيمياء 🧪</h2>
            </div>

            <GameTimerDisplay phase={phase === 'betting' ? 'preparing' : phase === 'mixing' ? 'running' : 'results'} timeRemaining={timeLeft} totalTime={phase === 'betting' ? 12 : 5} />

            <div className="flex-grow flex items-center justify-center">
                <div className="grid grid-cols-2 gap-6 w-full max-w-sm">
                    {POTIONS.map((potion, i) => (
                        <button
                            key={i}
                            onClick={() => handleBet(i)}
                            disabled={phase !== 'betting' || (selectedPotion !== null && selectedPotion !== i)}
                            className={`
                                aspect-square rounded-full border-4 transition-all transform relative flex items-center justify-center overflow-hidden
                                ${selectedPotion === i ? `scale-110 shadow-[0_0_30px_currentColor] ${potion.ring}` : 'border-slate-700 hover:border-slate-500'}
                                ${phase === 'result' && winningPotion === i ? 'scale-125 z-20 ring-4 ring-yellow-300 shadow-[0_0_50px_yellow]' : ''}
                                ${phase === 'result' && winningPotion !== i ? 'opacity-30 grayscale scale-90' : ''}
                            `}
                        >
                            <div className={`absolute bottom-0 w-full ${potion.color} transition-all duration-1000 ${phase === 'mixing' ? 'animate-bounce h-full' : 'h-3/4'}`}></div>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30"></div>
                            <span className="relative z-10 font-black text-xl text-white drop-shadow-md">{potion.name}</span>
                            
                            {/* Bubbles */}
                            {(phase === 'mixing' || (phase === 'result' && winningPotion === i)) && (
                                <div className="absolute w-full h-full">
                                    <div className="absolute bottom-2 left-1/4 w-2 h-2 bg-white rounded-full animate-ping"></div>
                                    <div className="absolute bottom-4 right-1/4 w-3 h-3 bg-white rounded-full animate-ping delay-75"></div>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-auto bg-slate-800/80 p-4 rounded-xl z-10">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            </div>
        </div>
    );
};

export default PotionLabGame;
