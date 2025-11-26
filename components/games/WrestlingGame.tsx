
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
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const OPPONENTS = [
    { id: 0, name: 'مبتدئ', title: 'Rookie', multiplier: 1.5, power: 3, color: 'from-green-500 to-green-700', icon: '🧒' },
    { id: 1, name: 'هاوي', title: 'Amateur', multiplier: 2.0, power: 5, color: 'from-yellow-500 to-yellow-700', icon: '👱' },
    { id: 2, name: 'محترف', title: 'Pro', multiplier: 3.0, power: 7, color: 'from-orange-500 to-orange-700', icon: '🧔' },
    { id: 3, name: 'بطل', title: 'Champion', multiplier: 5.0, power: 9, color: 'from-red-500 to-red-700', icon: '👹' },
];

const WrestlingGame: React.FC<Props> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [phase, setPhase] = useState<'betting' | 'fighting' | 'result'>('betting');
    const [bet, setBet] = useState(100);
    const [selectedOpponent, setSelectedOpponent] = useState(0);
    const [powerBalance, setPowerBalance] = useState(50); // 0 (Lose) - 100 (Win)
    const [timeLeft, setTimeLeft] = useState(10);
    const [gameResult, setGameResult] = useState<'win' | 'loss' | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    
    const gameInterval = useRef<number | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        return () => {
            if (gameInterval.current) clearInterval(gameInterval.current);
        };
    }, []);

    const startGame = async () => {
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'wrestling' as GameId);
        if (!success) return;

        setPhase('fighting');
        setPowerBalance(50);
        setTimeLeft(10);
        setGameResult(null);
        setShowConfetti(false);

        const opponent = OPPONENTS[selectedOpponent];
        
        gameInterval.current = window.setInterval(() => {
            // 1. Timer logic
            setTimeLeft(prev => {
                if (prev <= 0.1) {
                    endGame('loss');
                    return 0;
                }
                return prev - 0.1;
            });

            // 2. Opponent pushing logic
            setPowerBalance(prev => {
                // Harder opponents push faster
                // Add some randomness to push speed
                const push = (opponent.power * 0.4) + (Math.random() * 1.5); 
                const newBalance = prev - push;
                
                if (newBalance <= 0) {
                    endGame('loss');
                    return 0;
                }
                return newBalance;
            });

        }, 100);
    };

    const handleTap = () => {
        if (phase !== 'fighting') return;
        
        // Visual feedback
        if (buttonRef.current) {
            buttonRef.current.classList.add('scale-95');
            setTimeout(() => buttonRef.current?.classList.remove('scale-95'), 50);
        }

        setPowerBalance(prev => {
            const tapPower = 5; // Base tap power
            const newBalance = prev + tapPower;
            if (newBalance >= 100) {
                endGame('win');
                return 100;
            }
            return newBalance;
        });
    };

    const endGame = (outcome: 'win' | 'loss') => {
        if (gameInterval.current) clearInterval(gameInterval.current);
        
        setGameResult(outcome);
        setPhase('result');

        if (outcome === 'win') {
            const opponent = OPPONENTS[selectedOpponent];
            const winnings = bet * opponent.multiplier;
            onBalanceUpdate(winnings, 'wrestling' as GameId);
            addToast(`لقد هزمت ${opponent.name}! ربحت ${formatNumber(winnings)}`, 'success');
            setShowConfetti(true);
            if (winnings > 10000 && userProfile.displayName) {
                onAnnounceWin(userProfile.displayName, winnings, 'wrestling' as GameId);
            }
        } else {
            addToast('هزمك الخصم. حظ أوفر.', 'error');
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-slate-900 relative overflow-hidden">
            <HowToPlay>
                <p>1. اختر خصمك (مبتدئ، هاوي، محترف، بطل).</p>
                <p>2. كلما زادت قوة الخصم، زادت صعوبة اللعبة وزاد الربح.</p>
                <p>3. اضغط بسرعة على زر "اضغط!" (TAP) لدفع ذراع الخصم.</p>
                <p>4. تغلب على الخصم قبل انتهاء الوقت (10 ثواني) لتربح.</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

            <div className="text-center mb-4 z-10">
                <h2 className="text-3xl font-black text-red-500 italic uppercase tracking-widest drop-shadow-lg">المصارعة 💪</h2>
            </div>

            <div className="flex-grow flex flex-col justify-center items-center gap-6 z-10 w-full max-w-md mx-auto">
                
                {phase === 'betting' ? (
                    <div className="grid grid-cols-2 gap-3 w-full">
                        {OPPONENTS.map((opp, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedOpponent(i)}
                                className={`
                                    relative p-4 rounded-xl border-2 transition-all transform overflow-hidden
                                    ${selectedOpponent === i ? 'scale-105 border-white shadow-xl' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'}
                                `}
                            >
                                <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${opp.color}`}></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <span className="text-4xl mb-2">{opp.icon}</span>
                                    <h3 className="font-bold text-lg">{opp.name}</h3>
                                    <p className="text-xs text-gray-400">{opp.title}</p>
                                    <span className="mt-2 bg-black/40 px-2 py-1 rounded text-yellow-400 font-bold">x{opp.multiplier}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="w-full flex flex-col gap-6">
                        {/* VS Display */}
                        <div className="flex justify-between items-center px-4">
                            <div className="flex flex-col items-center">
                                <span className="text-4xl">😠</span>
                                <span className="text-sm font-bold text-blue-400">أنت</span>
                            </div>
                            <div className="text-2xl font-black text-red-500 italic">VS</div>
                            <div className="flex flex-col items-center">
                                <span className="text-4xl">{OPPONENTS[selectedOpponent].icon}</span>
                                <span className="text-sm font-bold text-red-400">{OPPONENTS[selectedOpponent].name}</span>
                            </div>
                        </div>

                        {/* Power Bar */}
                        <div className="relative h-12 bg-gray-800 rounded-full border-4 border-gray-700 overflow-hidden shadow-inner">
                            {/* Center Line */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/20 z-20"></div>
                            
                            {/* Bar Fill */}
                            <div 
                                className={`absolute top-0 bottom-0 left-0 transition-all duration-75 ease-linear
                                    ${powerBalance > 50 ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gradient-to-r from-red-600 to-red-400'}
                                `}
                                style={{ width: `${powerBalance}%` }}
                            ></div>
                            
                            {/* Indicator Icon */}
                            <div 
                                className="absolute top-1/2 -translate-y-1/2 transition-all duration-75 ease-linear z-30"
                                style={{ left: `${powerBalance}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                <div className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-sm border-2 border-gray-300">
                                    ✊
                                </div>
                            </div>
                        </div>

                        {/* Timer */}
                        <div className="text-center">
                            <span className={`text-2xl font-mono font-bold ${timeLeft < 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                {timeLeft.toFixed(1)}s
                            </span>
                        </div>

                        {phase === 'fighting' && (
                            <button
                                ref={buttonRef}
                                onMouseDown={handleTap}
                                onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
                                className="w-full h-32 bg-gradient-to-b from-red-600 to-red-800 rounded-2xl shadow-[0_10px_0_rgb(153,27,27)] active:shadow-none active:translate-y-[10px] transition-all flex items-center justify-center"
                            >
                                <div className="text-center pointer-events-none">
                                    <span className="text-4xl block">🔥</span>
                                    <span className="text-3xl font-black text-white uppercase tracking-widest">اضغط!</span>
                                </div>
                            </button>
                        )}

                        {phase === 'result' && (
                            <div className="text-center animate-bounce-in">
                                <h3 className={`text-4xl font-black mb-2 ${gameResult === 'win' ? 'text-green-400' : 'text-red-500'}`}>
                                    {gameResult === 'win' ? 'انتصرت!' : 'خسرت!'}
                                </h3>
                                {gameResult === 'win' && (
                                    <p className="text-yellow-400 text-xl font-bold">
                                        +{formatNumber(bet * OPPONENTS[selectedOpponent].multiplier)} 💎
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-auto bg-slate-800/80 p-4 rounded-xl border border-slate-700 z-10">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={phase !== 'betting'} />
                {phase === 'betting' && (
                    <button 
                        onClick={startGame}
                        className="w-full mt-3 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black text-xl rounded-lg shadow-lg hover:scale-[1.02] transition-transform"
                    >
                        ابدأ النزال 🥊
                    </button>
                )}
                {phase === 'result' && (
                    <button 
                        onClick={() => setPhase('betting')}
                        className="w-full mt-3 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold text-xl rounded-lg transition-colors"
                    >
                        نزال جديد
                    </button>
                )}
            </div>
        </div>
    );
};

export default WrestlingGame;
