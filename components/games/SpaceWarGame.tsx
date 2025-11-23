
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

const FACTIONS = [
    { id: 0, name: 'المريخ', icon: '🪐', color: 'bg-red-600' },
    { id: 1, name: 'الأرض', icon: '🌍', color: 'bg-blue-600' },
    { id: 2, name: 'زحل', icon: '🌑', color: 'bg-yellow-600' },
];

const SpaceWarGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'battle' | 'result'>('betting');
    const [timeLeft, setTimeLeft] = useState(10);
    const [bet, setBet] = useState(100);
    const [selectedFaction, setSelectedFaction] = useState<number | null>(null);
    const [winningFaction, setWinningFaction] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (phase === 'betting') {
                        setPhase('battle');
                        return 3;
                    } else if (phase === 'battle') {
                        resolveBattle();
                        return 5;
                    } else {
                        setPhase('betting');
                        setSelectedFaction(null);
                        setWinningFaction(null);
                        setShowConfetti(false);
                        return 10;
                    }
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const resolveBattle = () => {
        const winner = Math.floor(Math.random() * 3);
        setWinningFaction(winner);
        setPhase('result');

        if (selectedFaction === winner) {
            const win = bet * 3;
            onBalanceUpdate(win, 'spaceWar' as GameId);
            addToast(`انتصر كوكب ${FACTIONS[winner].name}! ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else if (selectedFaction !== null) {
            addToast(`انتصر كوكب ${FACTIONS[winner].name}. حظ أوفر.`, 'error');
        }
    };

    const handleBet = async (index: number) => {
        if (phase !== 'betting') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'spaceWar' as GameId);
        if (success) {
            setSelectedFaction(index);
            addToast(`تم الرهان على ${FACTIONS[index].name}`, 'success');
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-black text-white relative overflow-hidden">
            <HowToPlay>
                <p>1. اختر الكوكب الذي تريد دعمه في حرب الفضاء.</p>
                <p>2. لديك 3 خيارات: المريخ، الأرض، زحل.</p>
                <p>3. إذا انتصر كوكبك، تربح 3 أضعاف الرهان!</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Stars Background */}
            <div className="absolute inset-0 opacity-50 pointer-events-none" style={{backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>

            <GameTimerDisplay phase={phase === 'betting' ? 'preparing' : phase === 'battle' ? 'running' : 'results'} timeRemaining={timeLeft} totalTime={phase === 'betting' ? 10 : 5} />

            <div className="flex-grow flex flex-col justify-center gap-4 relative z-10">
                <div className="text-center mb-4">
                    <h2 className="text-3xl font-black text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">حرب الفضاء 🚀</h2>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {FACTIONS.map((faction, i) => (
                        <button
                            key={i}
                            onClick={() => handleBet(i)}
                            disabled={phase !== 'betting' || (selectedFaction !== null && selectedFaction !== i)}
                            className={`
                                aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all transform
                                ${selectedFaction === i ? `border-white ${faction.color} scale-105 shadow-xl` : 'border-gray-700 bg-gray-900/80 hover:border-gray-500'}
                                ${phase === 'result' && winningFaction === i ? 'ring-4 ring-yellow-400 scale-110 z-20' : ''}
                                ${phase === 'result' && winningFaction !== i ? 'opacity-50 grayscale' : ''}
                                disabled:cursor-not-allowed
                            `}
                        >
                            <span className="text-5xl filter drop-shadow-lg">{faction.icon}</span>
                            <span className="font-bold text-lg">{faction.name}</span>
                            {phase === 'battle' && <span className="text-xs animate-pulse text-red-400">قتال...</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-auto bg-gray-900/80 p-4 rounded-xl border border-gray-700 z-10">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            </div>
        </div>
    );
};

export default SpaceWarGame;
