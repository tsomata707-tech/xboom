
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

const MONSTERS = [
    { id: 0, name: 'التنين', icon: '🐉', color: 'text-red-500', bg: 'bg-red-900/30' },
    { id: 1, name: 'العملاق', icon: '👹', color: 'text-green-500', bg: 'bg-green-900/30' },
    { id: 2, name: 'العنقاء', icon: '🦅', color: 'text-yellow-500', bg: 'bg-yellow-900/30' },
];

const MonsterHuntGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'hunt' | 'result'>('betting');
    const [timeLeft, setTimeLeft] = useState(12);
    const [bet, setBet] = useState(100);
    const [selectedMonster, setSelectedMonster] = useState<number | null>(null);
    const [winningMonster, setWinningMonster] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (phase === 'betting') {
                        setPhase('hunt');
                        return 4;
                    } else if (phase === 'hunt') {
                        resolveHunt();
                        return 5;
                    } else {
                        setPhase('betting');
                        setSelectedMonster(null);
                        setWinningMonster(null);
                        setShowConfetti(false);
                        return 12;
                    }
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [phase]);

    const resolveHunt = () => {
        const winner = Math.floor(Math.random() * 3);
        setWinningMonster(winner);
        setPhase('result');

        if (selectedMonster === winner) {
            const win = bet * 3;
            onBalanceUpdate(win, 'monsterHunt' as GameId);
            addToast(`تم صيد ${MONSTERS[winner].name}! ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else if (selectedMonster !== null) {
            addToast(`الوحش ${MONSTERS[winner].name} هو الذي ظهر. حظ أوفر.`, 'error');
        }
    };

    const handleBet = async (index: number) => {
        if (phase !== 'betting') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'monsterHunt' as GameId);
        if (success) {
            setSelectedMonster(index);
            addToast(`تم الرهان على ${MONSTERS[index].name}`, 'success');
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-[#1a1a1a] relative overflow-hidden">
            <HowToPlay>
                <p>1. راهن على الوحش الذي سيتم اصطياده.</p>
                <p>2. لديك 3 خيارات: التنين، العملاق، العنقاء.</p>
                <p>3. الصيد ناجح يعطيك 3 أضعاف الرهان!</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

            <div className="text-center mb-6 z-10">
                <h2 className="text-3xl font-black text-red-600 uppercase tracking-widest">صيد الوحوش 🏹</h2>
            </div>

            <GameTimerDisplay phase={phase === 'betting' ? 'preparing' : phase === 'hunt' ? 'running' : 'results'} timeRemaining={timeLeft} totalTime={phase === 'betting' ? 12 : 5} />

            <div className="flex-grow flex flex-col justify-center gap-4 z-10">
                {MONSTERS.map((monster, i) => (
                    <button
                        key={i}
                        onClick={() => handleBet(i)}
                        disabled={phase !== 'betting' || (selectedMonster !== null && selectedMonster !== i)}
                        className={`
                            h-20 rounded-lg border-2 flex items-center px-4 justify-between transition-all transform
                            ${monster.bg}
                            ${selectedMonster === i ? 'border-white scale-105 shadow-[0_0_15px_white]' : 'border-gray-700 hover:border-gray-500'}
                            ${phase === 'result' && winningMonster === i ? 'border-green-500 ring-2 ring-green-400 z-20' : ''}
                            ${phase === 'result' && winningMonster !== i ? 'opacity-30' : ''}
                        `}
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">{monster.icon}</span>
                            <span className={`text-xl font-bold ${monster.color}`}>{monster.name}</span>
                        </div>
                        
                        {phase === 'hunt' && selectedMonster === i && (
                            <span className="text-2xl animate-pulse">⚔️</span>
                        )}
                        
                        {phase === 'result' && winningMonster === i && (
                            <span className="text-2xl animate-bounce">💀</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="mt-auto bg-gray-800 p-4 rounded-xl border border-gray-600 z-10">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            </div>
        </div>
    );
};

export default MonsterHuntGame;
