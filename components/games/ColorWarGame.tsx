
import React, { useState, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import BetControls from '../BetControls';
import GameTimerDisplay from '../GameTimerDisplay';
import Confetti from '../Confetti';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const ColorWarGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'fighting' | 'result'>('betting');
    const [timeLeft, setTimeLeft] = useState(10);
    const [bet, setBet] = useState(100);
    const [selectedTeam, setSelectedTeam] = useState<'red' | 'blue' | null>(null);
    const [redPower, setRedPower] = useState(50);
    const [winner, setWinner] = useState<'red' | 'blue' | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    // Game Loop
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (phase === 'betting') {
                        setPhase('fighting');
                        return 5; // Fight duration
                    } else if (phase === 'fighting') {
                        setPhase('result');
                        determineWinner();
                        return 5; // Result duration
                    } else {
                        setPhase('betting');
                        setSelectedTeam(null);
                        setWinner(null);
                        setRedPower(50);
                        setShowConfetti(false);
                        return 10; // Next betting round
                    }
                }
                return prev - 1;
            });

            if (phase === 'fighting') {
                // Simulate power struggle
                setRedPower(prev => Math.max(10, Math.min(90, prev + (Math.random() - 0.5) * 15)));
            }

        }, 1000);
        return () => clearInterval(interval);
    }, [phase]);

    const determineWinner = () => {
        const finalWinner = Math.random() > 0.5 ? 'red' : 'blue';
        setWinner(finalWinner);
        setRedPower(finalWinner === 'red' ? 100 : 0);
        
        if (selectedTeam === finalWinner) {
            const winnings = bet * 1.9; // 1.9x payout
            onBalanceUpdate(winnings, 'colorWar');
            addToast(`انتصر الفريق ${finalWinner === 'red' ? 'الأحمر' : 'الأزرق'}! ربحت ${formatNumber(winnings)}`, 'success');
            setShowConfetti(true);
        } else if (selectedTeam) {
            addToast(`فاز الفريق ${finalWinner === 'red' ? 'الأحمر' : 'الأزرق'}. حظ أوفر!`, 'error');
        }
    };

    const handleBet = async (team: 'red' | 'blue') => {
        if (phase !== 'betting') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'colorWar');
        if (success) {
            setSelectedTeam(team);
            addToast(`تم الرهان على الفريق ${team === 'red' ? 'الأحمر' : 'الأزرق'}`, 'success');
        }
    };

    return (
        <div className="flex flex-col h-full p-2 text-white relative overflow-hidden">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <GameTimerDisplay phase={phase === 'betting' ? 'preparing' : phase === 'fighting' ? 'running' : 'results'} timeRemaining={timeLeft} totalTime={phase === 'betting' ? 10 : 5} />

            <div className="flex-grow flex flex-col justify-center gap-4">
                {/* Battle Bar */}
                <div className="h-24 w-full bg-gray-800 rounded-2xl overflow-hidden relative border-4 border-gray-700 shadow-2xl">
                    <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ease-out flex items-center justify-start px-4"
                        style={{ width: `${redPower}%` }}
                    >
                        <span className="text-2xl font-black animate-pulse">🔴</span>
                    </div>
                    <div 
                        className="absolute top-0 right-0 h-full bg-gradient-to-l from-blue-600 to-blue-400 transition-all duration-300 ease-out flex items-center justify-end px-4"
                        style={{ width: `${100 - redPower}%` }}
                    >
                        <span className="text-2xl font-black animate-pulse">🔵</span>
                    </div>
                    {/* Center Clash Marker */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white z-10 opacity-50"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-4xl drop-shadow-lg">
                        VS
                    </div>
                </div>

                {/* Status Text */}
                <div className="text-center h-12">
                    {phase === 'betting' && <p className="text-xl font-bold text-yellow-300 animate-bounce">اختر فريقك الآن!</p>}
                    {phase === 'fighting' && <p className="text-2xl font-black text-orange-500">⚔️ قتال! ⚔️</p>}
                    {phase === 'result' && (
                        <p className={`text-3xl font-black ${winner === 'red' ? 'text-red-500' : 'text-blue-500'}`}>
                            فاز الفريق {winner === 'red' ? 'الأحمر' : 'الأزرق'}!
                        </p>
                    )}
                </div>

                {/* Team Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleBet('red')}
                        disabled={phase !== 'betting' || selectedTeam !== null}
                        className={`h-32 rounded-xl border-4 transition-all transform ${selectedTeam === 'red' ? 'bg-red-600 border-white scale-105 shadow-[0_0_20px_red]' : 'bg-red-900/50 border-red-700 hover:bg-red-800'} disabled:opacity-50 flex flex-col items-center justify-center gap-2`}
                    >
                        <span className="text-4xl">🔴</span>
                        <span className="font-bold text-xl">الفريق الأحمر</span>
                        <span className="text-xs text-red-200">مضاعف x1.9</span>
                    </button>
                    <button
                        onClick={() => handleBet('blue')}
                        disabled={phase !== 'betting' || selectedTeam !== null}
                        className={`h-32 rounded-xl border-4 transition-all transform ${selectedTeam === 'blue' ? 'bg-blue-600 border-white scale-105 shadow-[0_0_20px_blue]' : 'bg-blue-900/50 border-blue-700 hover:bg-blue-800'} disabled:opacity-50 flex flex-col items-center justify-center gap-2`}
                    >
                        <span className="text-4xl">🔵</span>
                        <span className="font-bold text-xl">الفريق الأزرق</span>
                        <span className="text-xs text-blue-200">مضاعف x1.9</span>
                    </button>
                </div>
            </div>

            <div className="mt-4">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
            </div>
        </div>
    );
};

export default ColorWarGame;
