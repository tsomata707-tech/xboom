
import React, { useState, useEffect, useRef } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import HowToPlay from '../HowToPlay';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const ANIMALS = [
    { id: 0, name: 'الأسد', icon: '🦁', color: 'bg-yellow-600' },
    { id: 1, name: 'النمر', icon: '🐯', color: 'bg-orange-600' },
    { id: 2, name: 'الدب', icon: '🐻', color: 'bg-amber-800' },
    { id: 3, name: 'الذئب', icon: '🐺', color: 'bg-gray-600' },
];

const ForestRunGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'racing' | 'finished'>('betting');
    const [positions, setPositions] = useState([0, 0, 0, 0]);
    const [selectedAnimal, setSelectedAnimal] = useState<number | null>(null);
    const [bet, setBet] = useState(100);
    const [winner, setWinner] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const raceInterval = useRef<number | null>(null);

    const startRace = async () => {
        if (selectedAnimal === null) {
            addToast('اختر حيواناً للرهان عليه!', 'info');
            return;
        }
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'forestRun');
        if (!success) return;

        setPhase('racing');
        setPositions([0, 0, 0, 0]);
        
        raceInterval.current = window.setInterval(() => {
            setPositions(prev => {
                const nextPos = prev.map(p => p + Math.random() * 3);
                const winningIdx = nextPos.findIndex(p => p >= 90);
                
                if (winningIdx !== -1) {
                    finishRace(winningIdx);
                }
                return nextPos;
            });
        }, 100);
    };

    const finishRace = (winnerIdx: number) => {
        if (raceInterval.current) clearInterval(raceInterval.current);
        setWinner(winnerIdx);
        setPhase('finished');
        
        if (selectedAnimal === winnerIdx) {
            const win = bet * 3.5; // 3.5x Payout
            onBalanceUpdate(win, 'forestRun');
            addToast(`فاز ${ANIMALS[winnerIdx].name}! ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else {
            addToast(`فاز ${ANIMALS[winnerIdx].name}. حظ أوفر.`, 'error');
        }

        setTimeout(() => {
            setPhase('betting');
            setSelectedAnimal(null);
            setPositions([0, 0, 0, 0]);
            setShowConfetti(false);
            setWinner(null);
        }, 4000);
    };

    useEffect(() => {
        return () => { if (raceInterval.current) clearInterval(raceInterval.current); };
    }, []);

    return (
        <div className="flex flex-col h-full p-3 bg-green-900/20">
             <HowToPlay>
                <p>1. اختر حيواناً من المتسابقين الأربعة (أسد، نمر، دب، ذئب).</p>
                <p>2. حدد قيمة الرهان واضغط "بدء السباق".</p>
                <p>3. الحيوانات تتسابق بسرعات عشوائية.</p>
                <p>4. إذا وصل حيوانك لخط النهاية أولاً، تربح 3.5 أضعاف رهانك!</p>
            </HowToPlay>
            
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

            <div className="flex-grow flex flex-col justify-center gap-4 relative">
                {/* Track */}
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500/50 z-0 border-l-2 border-dashed border-white/50">
                     <span className="absolute top-1/2 -right-2 transform -translate-y-1/2 rotate-90 text-xs font-bold text-white bg-red-600 px-1">FINISH</span>
                </div>

                {ANIMALS.map((animal, i) => (
                    <div key={i} className="relative">
                        <div className="h-12 bg-black/30 rounded-full w-full border border-white/10 overflow-hidden relative">
                            <div 
                                className={`absolute top-0 left-0 h-full transition-all duration-100 ease-linear flex items-center justify-end pr-2 ${animal.color}`}
                                style={{ width: `${Math.min(100, positions[i] + 10)}%` }}
                            >
                                <span className="text-3xl transform scale-x-[-1] filter drop-shadow-lg">{animal.icon}</span>
                            </div>
                        </div>
                        {phase === 'finished' && winner === i && (
                            <span className="absolute -top-3 left-1/2 text-yellow-400 font-bold animate-bounce text-sm">👑 الفائز!</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">
                {ANIMALS.map((animal, i) => (
                    <button
                        key={i}
                        onClick={() => phase === 'betting' && setSelectedAnimal(i)}
                        disabled={phase !== 'betting'}
                        className={`p-2 rounded-lg border-2 flex flex-col items-center transition-all ${selectedAnimal === i ? 'bg-white/20 border-yellow-400 scale-105' : 'bg-gray-800 border-gray-600 opacity-80'} disabled:opacity-50`}
                    >
                        <span className="text-2xl">{animal.icon}</span>
                        <span className="text-xs font-bold mt-1">{animal.name}</span>
                    </button>
                ))}
            </div>

            <div className="mt-4">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
                {phase === 'betting' && (
                    <button onClick={startRace} className="w-full mt-2 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition">
                        بدء السباق 🏁
                    </button>
                )}
            </div>
        </div>
    );
};

export default ForestRunGame;
