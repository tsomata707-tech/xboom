
import React, { useState, useEffect, useRef } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import BetControls from '../BetControls';
import Confetti from '../Confetti';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const CAMELS = ['🐫', '🐪', '🐎', '🦓', '🐂']; // Varied runners
const COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];

const CamelRaceGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'racing' | 'finished'>('betting');
    const [bet, setBet] = useState(100);
    const [selectedCamel, setSelectedCamel] = useState<number | null>(null);
    const [positions, setPositions] = useState<number[]>([0,0,0,0,0]); // 0 to 100%
    const [winner, setWinner] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const raceInterval = useRef<number | null>(null);

    const startRace = async () => {
        if (selectedCamel === null) {
            addToast('اختر جملاً للرهان عليه!', 'info');
            return;
        }
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        
        const success = await onBalanceUpdate(-bet, 'camelRace');
        if (!success) return;

        setPhase('racing');
        setPositions([0,0,0,0,0]);
        
        raceInterval.current = window.setInterval(() => {
            setPositions(prev => {
                const newPos = prev.map(p => p + Math.random() * 2); // Random speed
                
                // Check winner
                const winningIndex = newPos.findIndex(p => p >= 90); // Finish line at 90%
                if (winningIndex !== -1) {
                    finishRace(winningIndex);
                }
                return newPos;
            });
        }, 50);
    };

    const finishRace = (winningIndex: number) => {
        if (raceInterval.current) clearInterval(raceInterval.current);
        setWinner(winningIndex);
        setPhase('finished');
        
        if (selectedCamel === winningIndex) {
            const winnings = bet * 4; // 4x payout for 5 camels
            onBalanceUpdate(winnings, 'camelRace');
            addToast(`فاز الجمل رقم ${winningIndex + 1}! ربحت ${formatNumber(winnings)}`, 'success');
            setShowConfetti(true);
        } else {
            addToast(`فاز الجمل رقم ${winningIndex + 1}. حظ أوفر.`, 'error');
        }

        setTimeout(() => {
            setPhase('betting');
            setSelectedCamel(null);
            setPositions([0,0,0,0,0]);
            setShowConfetti(false);
        }, 5000);
    };

    useEffect(() => {
        return () => { if(raceInterval.current) clearInterval(raceInterval.current); };
    }, []);

    return (
        <div className="flex flex-col h-full p-2">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="bg-gray-800 p-2 rounded-xl mb-4 border-2 border-yellow-600/50 relative overflow-hidden flex-grow flex flex-col justify-center">
                {/* Finish Line */}
                <div className="absolute top-0 bottom-0 right-[10%] w-2 border-r-2 border-dashed border-white z-0 flex flex-col justify-center items-center opacity-50">
                    <span className="text-xs bg-black text-white rotate-90 whitespace-nowrap">FINISH</span>
                </div>

                {CAMELS.map((icon, i) => (
                    <div key={i} className="relative h-12 mb-2 w-full border-b border-gray-700/50 last:border-0 flex items-center">
                         <span className="absolute left-0 text-xs font-bold text-gray-500 w-6">{i+1}</span>
                         <div 
                            className="absolute text-3xl transition-all duration-75 ease-linear z-10 transform -translate-y-1/2 top-1/2"
                            style={{ left: `${positions[i]}%` }}
                         >
                             {icon}
                             {phase === 'finished' && winner === i && <span className="absolute -top-4 left-0 text-sm">👑</span>}
                         </div>
                         {/* Track Line */}
                         <div className="w-full h-1 bg-gray-700/30 rounded"></div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-5 gap-2 mb-4">
                {CAMELS.map((icon, i) => (
                    <button
                        key={i}
                        onClick={() => phase === 'betting' && setSelectedCamel(i)}
                        disabled={phase !== 'betting'}
                        className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all ${selectedCamel === i ? `border-white ${COLORS[i]} bg-opacity-50 scale-105` : 'border-gray-600 bg-gray-800'} disabled:opacity-50`}
                    >
                        <span className="text-2xl">{icon}</span>
                        <span className="text-xs font-bold">#{i+1}</span>
                    </button>
                ))}
            </div>

            <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            
            {phase === 'betting' && (
                <button onClick={startRace} className="w-full mt-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition">
                    بدء السباق 🏁
                </button>
            )}
        </div>
    );
};

export default CamelRaceGame;
