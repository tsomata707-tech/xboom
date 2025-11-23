
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { useGameLoop } from '../hooks/useGameLoop';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import DiamondIcon from '../icons/DiamondIcon';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface XboomStockMarketGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Game Config
type BetDirection = 'up' | 'down';
type Bet = { commodityId: string; direction: BetDirection; amount: number };
type Result = { [commodityId: string]: 'win' | 'loss' };

const COMMODITIES = [
    { id: 'gold', name: 'ذهب', icon: '🥇' },
    { id: 'oil', name: 'نفط', icon: '🛢️' },
    { id: 'silver', name: 'فضة', icon: '🥈' },
    { id: 'btc', name: 'بيتكوين', icon: '₿' },
    { id: 'eth', name: 'إيثريوم', icon: 'Ξ' },
    { id: 'usd', name: 'دولار', icon: '💵' },
    { id: 'apple', name: 'أسهم أبل', icon: '🍏' },
    { id: 'tesla', name: 'أسهم تسلا', icon: '🚗' },
    { id: 'coffee', name: 'قهوة', icon: '☕' },
    { id: 'wheat', name: 'قمح', icon: '🌾' },
    { id: 'gas', name: 'غاز', icon: '💨' },
    { id: 'sp500', name: 'مؤشر S&P', icon: '📊' },
];

const WIN_MULTIPLIER = 1.95;
const PREPARATION_TIME = 10;
const GAME_TIME = 10;
const RESULTS_TIME = 5;
const QUICK_BETS = [25, 100, 500, 1000];

// Chart Component
const MiniChart: React.FC<{ running: boolean; result?: 'win' | 'loss' }> = ({ running, result }) => {
    const [points, setPoints] = useState('0,50 10,50 20,50 30,50 40,50 50,50 60,50 70,50 80,50 90,50 100,50');

    useEffect(() => {
        if (running) {
            let y = 50;
            const newPoints = Array.from({ length: 11 }, (_, i) => {
                const change = (Math.random() - 0.5) * 20;
                y = Math.max(10, Math.min(90, y + change));
                return `${i * 10},${y}`;
            });
            setPoints(newPoints.join(' '));
        } else if (!running && !result) {
            setPoints('0,50 10,50 20,50 30,50 40,50 50,50 60,50 70,50 80,50 90,50 100,50');
        }
    }, [running, result]);

    const finalColor = result === 'win' ? 'stroke-green-400' : 'stroke-red-500';

    return (
        <svg viewBox="0 0 100 100" className="w-full h-16">
            <polyline
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
                className={`transition-all duration-300 ${result ? finalColor : 'stroke-gray-500'}`}
                style={{
                    strokeDasharray: running ? '500' : '0',
                    strokeDashoffset: running ? '500' : '0',
                    animation: running ? 'dash 10s linear forwards' : 'none'
                }}
            />
             <style>{`
                @keyframes dash {
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>
        </svg>
    );
};

const XboomStockMarketGame: React.FC<XboomStockMarketGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bets, setBets] = useState<Bet[]>([]);
    const [betAmount, setBetAmount] = useState(100);
    const [results, setResults] = useState<Result>({});
    const [totalWinnings, setTotalWinnings] = useState(0);

    const totalBet = useMemo(() => bets.reduce((sum, bet) => sum + bet.amount, 0), [bets]);

    const handleRoundStart = useCallback(async () => {
        if (totalBet === 0) return;
        if (!userProfile || totalBet > userProfile.balance) {
            addToast('رصيدك غير كافٍ لإتمام الرهانات.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-totalBet, 'stockMarketGame');
        if (!success) return;

        const newResults: Result = {};
        let winnings = 0;
        for (const bet of bets) {
            const outcomeUp = Math.random() > 0.5;
            const didWin = (bet.direction === 'up' && outcomeUp) || (bet.direction === 'down' && !outcomeUp);
            if (didWin) {
                newResults[bet.commodityId] = 'win';
                winnings += bet.amount * WIN_MULTIPLIER;
            } else {
                newResults[bet.commodityId] = 'loss';
            }
        }

        setResults(newResults);
        setTotalWinnings(winnings);

        if (winnings > 0) {
            onBalanceUpdate(winnings, 'stockMarketGame');
            addToast(`لقد ربحت ${formatNumber(winnings)} 💎!`, 'success');
            if (winnings > 10000 && userProfile.displayName) {
                onAnnounceWin(userProfile.displayName, winnings, 'stockMarketGame');
            }
        }
    }, [bets, totalBet, userProfile, onBalanceUpdate, addToast, onAnnounceWin]);

    const resetGame = useCallback(() => {
        setBets([]);
        setResults({});
        setTotalWinnings(0);
    }, []);

    const { phase, timeRemaining } = useGameLoop({
        onRoundStart: handleRoundStart,
        onRoundEnd: resetGame,
    }, {
        preparationTime: PREPARATION_TIME,
        gameTime: GAME_TIME,
        resultsTime: RESULTS_TIME,
    });
    
    const placeBet = (commodityId: string, direction: BetDirection) => {
        if (phase !== 'preparing') return;
        const existingBetIndex = bets.findIndex(b => b.commodityId === commodityId);
        const newBets = [...bets];
        if (existingBetIndex > -1) {
            // Update existing bet
            newBets[existingBetIndex] = { ...newBets[existingBetIndex], direction, amount: newBets[existingBetIndex].amount + betAmount };
        } else {
            // Add new bet
            newBets.push({ commodityId, direction, amount: betAmount });
        }
        setBets(newBets);
    };

    const getBetForCommodity = (id: string) => bets.find(b => b.commodityId === id);

    return (
        <div className="flex flex-col h-full p-2 relative">
             <HowToPlay>
                <p>1. حدد مبلغ الرهان من الأسفل.</p>
                <p>2. توقع حركة السعر لأي أصل (ذهب، نفط، بيتكوين...) خلال الـ 10 ثواني القادمة.</p>
                <p>3. اضغط <strong>"صعود ▲"</strong> إذا كنت تتوقع ارتفاع السعر.</p>
                <p>4. اضغط <strong>"هبوط ▼"</strong> إذا كنت تتوقع انخفاض السعر.</p>
                <p>5. إذا صح توقعك، تربح 1.95 ضعف رهانك!</p>
            </HowToPlay>

            {totalWinnings > totalBet * 5 && <Confetti onComplete={() => {}} />}
            <header className="text-center mb-4 mt-6">
                <h1 className="text-4xl font-bold">بورصة اكس بوم</h1>
                <p className="text-gray-400">توقع حركة السعر واربح x{WIN_MULTIPLIER}</p>
            </header>

            {/* Game Grid */}
            <div className="flex-grow grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto pr-2">
                {COMMODITIES.map(c => {
                    const bet = getBetForCommodity(c.id);
                    const result = results[c.id];
                    return (
                        <div key={c.id} className={`game-item p-3 rounded-lg flex flex-col justify-between transition-all duration-300
                            ${result === 'win' ? 'bg-green-500/20 border-2 border-green-400' : ''}
                            ${result === 'loss' ? 'bg-red-500/20 border-2 border-red-400' : ''}
                            ${!result ? 'bg-gray-900/50 border border-gray-700' : ''}
                        `}>
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">{c.icon}</span>
                                    <h3 className="font-bold text-white">{c.name}</h3>
                                </div>
                                <MiniChart running={phase === 'running'} result={result} />
                                {bet && (
                                    <div className={`mt-2 text-center text-sm font-bold p-1 rounded ${
                                        bet.direction === 'up' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                                    }`}>
                                        رهان: {formatNumber(bet.amount)} ({bet.direction === 'up' ? 'صعود' : 'هبوط'})
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button onClick={() => placeBet(c.id, 'up')} disabled={phase !== 'preparing'}
                                    className="flex-1 py-2 text-sm font-bold bg-green-600 hover:bg-green-500 rounded transition disabled:opacity-50 disabled:cursor-not-allowed">
                                    صعود ▲
                                </button>
                                <button onClick={() => placeBet(c.id, 'down')} disabled={phase !== 'preparing'}
                                    className="flex-1 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 rounded transition disabled:opacity-50 disabled:cursor-not-allowed">
                                    هبوط ▼
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Controls */}
            <footer className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                        <label className="text-sm text-gray-400">مبلغ الرهان</label>
                        <div className="flex gap-2 mt-1">
                            {QUICK_BETS.map(amount => (
                                <button key={amount} onClick={() => setBetAmount(amount)} disabled={phase !== 'preparing'}
                                    className={`flex-1 py-2 font-bold rounded transition ${betAmount === amount ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600'} disabled:opacity-50`}>
                                    {formatNumber(amount)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-400">إجمالي الرهان</p>
                        <p className="text-2xl font-bold text-yellow-300 flex items-center gap-2">
                           <DiamondIcon className="w-6 h-6" /> {formatNumber(totalBet)}
                        </p>
                    </div>
                    <div className="text-center">
                        {phase === 'preparing' && <p className="text-cyan-400">الجولة تبدأ بعد: {timeRemaining} ثانية</p>}
                        {phase === 'running' && <p className="text-red-500 animate-pulse">الجولة جارية...</p>}
                        {phase === 'results' && (
                             <div>
                                <p className="text-purple-400">النتائج</p>
                                <p className={`text-xl font-bold ${totalWinnings >= totalBet ? 'text-green-400' : 'text-red-400'}`}>
                                    {totalWinnings >= totalBet ? '+' : ''}{formatNumber(totalWinnings - totalBet)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default XboomStockMarketGame;
