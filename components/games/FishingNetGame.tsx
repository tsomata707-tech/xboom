
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

const ZONES = [
    { id: 0, name: 'الشاطئ', icon: '🏖️' },
    { id: 1, name: 'الأعماق', icon: '⚓' },
    { id: 2, name: 'الشعاب', icon: '🪸' },
];

const FishingNetGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'fishing' | 'result'>('betting');
    const [timeLeft, setTimeLeft] = useState(15);
    const [bet, setBet] = useState(100);
    const [selectedZone, setSelectedZone] = useState<number | null>(null);
    const [winningZone, setWinningZone] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (phase === 'betting') {
                        setPhase('fishing');
                        return 4;
                    } else if (phase === 'fishing') {
                        resolveFishing();
                        return 5;
                    } else {
                        setPhase('betting');
                        setSelectedZone(null);
                        setWinningZone(null);
                        setShowConfetti(false);
                        return 15;
                    }
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const resolveFishing = () => {
        const winner = Math.floor(Math.random() * 3);
        setWinningZone(winner);
        setPhase('result');

        if (selectedZone === winner) {
            const win = bet * 3;
            onBalanceUpdate(win, 'fishingNet' as GameId);
            addToast(`الصيد وفير في ${ZONES[winner].name}! ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else if (selectedZone !== null) {
            addToast(`الأسماك كانت في ${ZONES[winner].name}. حظ أوفر.`, 'error');
        }
    };

    const handleBet = async (index: number) => {
        if (phase !== 'betting') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'fishingNet' as GameId);
        if (success) {
            setSelectedZone(index);
            addToast(`تم رمي الشبكة في ${ZONES[index].name}`, 'success');
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-sky-900 relative overflow-hidden">
            <HowToPlay>
                <p>1. اختر المنطقة التي تريد الصيد فيها (الشاطئ، الأعماق، الشعاب).</p>
                <p>2. يظهر سرب الأسماك في منطقة واحدة فقط.</p>
                <p>3. إذا رميت شبكتك في المكان الصحيح، تربح 3 أضعاف الرهان!</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Water bubbles bg */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
                 <div className="absolute top-10 left-10 w-4 h-4 bg-white rounded-full animate-ping"></div>
                 <div className="absolute bottom-20 right-20 w-6 h-6 bg-white rounded-full animate-pulse"></div>
            </div>

            <div className="text-center mb-4 z-10">
                <h2 className="text-2xl font-bold text-sky-300">الصيد الوفير 🎣</h2>
            </div>

            <GameTimerDisplay phase={phase === 'betting' ? 'preparing' : phase === 'fishing' ? 'running' : 'results'} timeRemaining={timeLeft} totalTime={phase === 'betting' ? 15 : 5} />

            <div className="flex-grow flex flex-col justify-center gap-4 z-10">
                {ZONES.map((zone, i) => (
                    <button
                        key={i}
                        onClick={() => handleBet(i)}
                        disabled={phase !== 'betting' || (selectedZone !== null && selectedZone !== i)}
                        className={`
                            h-24 rounded-xl border-2 flex items-center justify-between px-6 transition-all transform
                            ${selectedZone === i ? 'bg-sky-700 border-sky-300 scale-105 shadow-lg' : 'bg-sky-900/50 border-sky-800 hover:bg-sky-800'}
                            ${phase === 'result' && winningZone === i ? 'bg-green-600 border-green-400 ring-2 ring-green-300 scale-105 z-20' : ''}
                            ${phase === 'result' && winningZone !== i ? 'opacity-50' : ''}
                        `}
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">{zone.icon}</span>
                            <span className="text-xl font-bold">{zone.name}</span>
                        </div>
                        
                        {phase === 'fishing' && selectedZone === i && (
                            <span className="text-2xl animate-bounce">🕸️</span>
                        )}
                        
                        {phase === 'result' && winningZone === i && (
                            <span className="text-3xl animate-pulse">🐟🐟</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="mt-auto bg-sky-950/80 p-4 rounded-xl border border-sky-800 z-10">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            </div>
        </div>
    );
};

export default FishingNetGame;
