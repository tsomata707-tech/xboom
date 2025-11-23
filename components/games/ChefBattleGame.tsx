
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

const CHEFS = [
    { id: 0, name: 'الشيف الإيطالي', icon: '🍝', color: 'bg-green-700' },
    { id: 1, name: 'الشيف الشرقي', icon: '🍱', color: 'bg-orange-700' },
];

const ChefBattleGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'cooking' | 'result'>('betting');
    const [timeLeft, setTimeLeft] = useState(10);
    const [bet, setBet] = useState(100);
    const [selectedChef, setSelectedChef] = useState<number | null>(null);
    const [winningChef, setWinningChef] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (phase === 'betting') {
                        setPhase('cooking');
                        return 5;
                    } else if (phase === 'cooking') {
                        resolveCooking();
                        return 5;
                    } else {
                        setPhase('betting');
                        setSelectedChef(null);
                        setWinningChef(null);
                        setShowConfetti(false);
                        return 10;
                    }
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const resolveCooking = () => {
        const winner = Math.random() > 0.5 ? 0 : 1;
        setWinningChef(winner);
        setPhase('result');

        if (selectedChef === winner) {
            const win = bet * 1.95;
            onBalanceUpdate(win, 'chefBattle' as GameId);
            addToast(`فاز ${CHEFS[winner].name} بأفضل طبق! ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else if (selectedChef !== null) {
            addToast(`فاز ${CHEFS[winner].name}. حظ أوفر.`, 'error');
        }
    };

    const handleBet = async (index: number) => {
        if (phase !== 'betting') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'chefBattle' as GameId);
        if (success) {
            setSelectedChef(index);
            addToast(`تم الرهان على ${CHEFS[index].name}`, 'success');
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-stone-900 text-white relative overflow-hidden">
            <HowToPlay>
                <p>1. اختر الشيف الذي تعتقد أنه سيعد أفضل طبق.</p>
                <p>2. المنافسة بين الشيف الإيطالي والشيف الشرقي.</p>
                <p>3. الفائز يمنحك 1.95 ضعف رهانك!</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

            <div className="text-center mb-6 z-10">
                <h2 className="text-3xl font-black text-orange-400">تحدي الطبخ 👨‍🍳</h2>
            </div>

            <GameTimerDisplay phase={phase === 'betting' ? 'preparing' : phase === 'cooking' ? 'running' : 'results'} timeRemaining={timeLeft} totalTime={phase === 'betting' ? 10 : 5} />

            <div className="flex-grow flex items-center justify-center gap-4 z-10">
                {CHEFS.map((chef, i) => (
                    <button
                        key={i}
                        onClick={() => handleBet(i)}
                        disabled={phase !== 'betting' || (selectedChef !== null && selectedChef !== i)}
                        className={`
                            flex-1 h-64 rounded-2xl border-4 transition-all transform flex flex-col items-center justify-center gap-4 relative overflow-hidden
                            ${selectedChef === i ? `scale-105 shadow-2xl border-white` : 'border-stone-700 hover:border-stone-500'}
                            ${chef.color}
                            ${phase === 'result' && winningChef !== i ? 'opacity-50 grayscale scale-95' : ''}
                            ${phase === 'result' && winningChef === i ? 'ring-4 ring-yellow-500 z-20' : ''}
                        `}
                    >
                        <span className="text-6xl filter drop-shadow-lg">{chef.icon}</span>
                        <span className="font-bold text-xl">{chef.name}</span>
                        
                        {phase === 'cooking' && selectedChef === i && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <span className="text-4xl animate-spin">🍳</span>
                            </div>
                        )}
                        
                        {phase === 'result' && winningChef === i && (
                            <div className="absolute top-4 right-4 text-3xl animate-bounce">🏆</div>
                        )}
                    </button>
                ))}
                
                <div className="absolute text-4xl font-black text-white drop-shadow-md">VS</div>
            </div>

            <div className="mt-auto bg-stone-800/80 p-4 rounded-xl border border-stone-600 z-10">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            </div>
        </div>
    );
};

export default ChefBattleGame;
