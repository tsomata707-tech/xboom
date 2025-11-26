
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, GreedyGameState } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import BetControls from '../BetControls';
import { convertTimestamps } from '../utils/convertTimestamps';

// Prop types
interface UserProfile extends AppUser {
    balance: number;
}

interface GreedyGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Game Data
const ITEMS = [
    { id: 'tomato', name: 'طماطم', icon: '🍅', multiplier: 5, color: '#EF4444', type: 'veg' }, // 0
    { id: 'chicken', name: 'دجاج', icon: '🍗', multiplier: 10, color: '#F59E0B', type: 'meat' }, // 1
    { id: 'cucumber', name: 'خيار', icon: '🥒', multiplier: 5, color: '#10B981', type: 'veg' }, // 2
    { id: 'bacon', name: 'لحم', icon: '🥓', multiplier: 15, color: '#EC4899', type: 'meat' }, // 3
    { id: 'carrot', name: 'جزر', icon: '🥕', multiplier: 5, color: '#F97316', type: 'veg' }, // 4
    { id: 'beef', name: 'ستيك', icon: '🍖', multiplier: 25, color: '#7F1D1D', type: 'meat' }, // 5
    { id: 'corn', name: 'ذرة', icon: '🌽', multiplier: 5, color: '#FACC15', type: 'veg' }, // 6
    { id: 'fish', name: 'سمك', icon: '🐟', multiplier: 45, color: '#3B82F6', type: 'meat' }, // 7
];

const GreedyGame: React.FC<GreedyGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    
    // Server State
    const [gameState, setGameState] = useState<GreedyGameState | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [serverTimerEnd, setServerTimerEnd] = useState(0);

    // Local Betting State
    const [bet, setBet] = useState(100);
    const [myLockedBets, setMyLockedBets] = useState<Record<string, number>>({}); // ItemID -> BetAmount
    
    // Visual State
    const [activeHighlight, setActiveHighlight] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [resultMessage, setResultMessage] = useState<React.ReactNode | null>(null);
    const spinIntervalRef = useRef<number | null>(null);

    // --- 1. Sync with Firestore ---
    useEffect(() => {
        const docRef = doc(db, 'public', 'greedyGame');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as GreedyGameState;
                setGameState(data);
                setServerTimerEnd(data.endTime);

                // Reset on new round
                if (data.status === 'betting') {
                    if (gameState?.status !== 'betting') {
                        setMyLockedBets({});
                        setResultMessage(null);
                        setShowConfetti(false);
                        stopSpinAnimation();
                        setActiveHighlight(null);
                    }
                } 
                // Trigger Spin
                else if (data.status === 'spinning' && data.winningItemId) {
                    startSpinAnimation(data.winningItemId);
                }
            }
        });

        // Timer
        const timer = setInterval(() => {
            if (serverTimerEnd) {
                const now = Date.now();
                const diff = Math.max(0, Math.ceil((serverTimerEnd - now) / 1000));
                setTimeLeft(diff);
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(timer);
            stopSpinAnimation();
        };
    }, [serverTimerEnd, gameState?.status, gameState?.winningItemId]);

    // --- 2. Check Winnings ---
    useEffect(() => {
        if (gameState?.status === 'result' && gameState.lastRoundWinners && userProfile) {
            stopSpinAnimation();
            // Set highlight to winner
            const winnerIdx = ITEMS.findIndex(i => i.id === gameState.winningItemId);
            if (winnerIdx !== -1) setActiveHighlight(winnerIdx);

            const myWin = gameState.lastRoundWinners.find(w => w.nickname === userProfile.displayName);
            
            if (myWin) {
                // Simple Win Message (Just the number)
                setResultMessage(
                    <div className="animate-bounce text-center">
                        <span className="text-green-400 font-black text-4xl sm:text-5xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                            +{formatNumber(myWin.amount)}
                        </span>
                    </div>
                );
                
                // Confetti only for big wins (> 10,000)
                if (myWin.amount > 10000) {
                    setShowConfetti(true);
                    onAnnounceWin(userProfile.displayName || 'User', myWin.amount, 'greedyGame');
                }
            } else if (Object.keys(myLockedBets).length > 0) {
                // Lost
                setResultMessage(
                    <div className="text-center">
                        <span className="text-red-500 font-bold text-2xl drop-shadow-md">حظ أوفر</span>
                    </div>
                );
            }
        }
    }, [gameState?.status, gameState?.lastRoundWinners, userProfile]);

    // --- Animation Logic ---
    const startSpinAnimation = (winningId: string) => {
        if (spinIntervalRef.current) return; // Already spinning

        const winningIndex = ITEMS.findIndex(i => i.id === winningId);
        if (winningIndex === -1) return;

        let currentIdx = 0;
        let speed = 30; // Start very fast
        let rounds = 0;
        const minRounds = 3;

        const animate = () => {
            setActiveHighlight(currentIdx);
            currentIdx = (currentIdx + 1) % 8;

            if (currentIdx === 0) rounds++;

            // Deceleration Logic
            if (rounds >= minRounds) {
                // Start slowing down
                speed += 15; 
            }

            // Stop condition
            if (rounds >= minRounds && currentIdx === winningIndex && speed > 200) {
                 setActiveHighlight(winningIndex);
                 stopSpinAnimation();
                 return;
            }

            spinIntervalRef.current = window.setTimeout(animate, speed);
        };
        
        spinIntervalRef.current = window.setTimeout(animate, speed);
    };

    const stopSpinAnimation = () => {
        if (spinIntervalRef.current) {
            clearTimeout(spinIntervalRef.current);
            spinIntervalRef.current = null;
        }
    };

    // --- Betting Logic ---
    const handlePlaceBet = async (item: typeof ITEMS[0]) => {
        // Validation
        if (!gameState || gameState.status !== 'betting') return;
        if (!userProfile) {
            addToast('يرجى تسجيل الدخول', 'error');
            return;
        }
        
        // Silent limit: Max 6 items (Don't allow betting on a NEW 7th item)
        if (Object.keys(myLockedBets).length >= 6 && !myLockedBets[item.id]) {
            return; // Ignore new item selection
        }

        const amount = Number(bet);
        if (amount > userProfile.balance) {
            addToast('رصيد غير كافٍ', 'error');
            return;
        }

        // Optimistic UI update (Deduct current bet amount)
        const success = await onBalanceUpdate(-amount, 'greedyGame');
        
        if (success) {
            // Add to existing bet locally
            setMyLockedBets(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + amount }));

            try {
                await runTransaction(db, async (transaction) => {
                    const gameRef = doc(db, 'public', 'greedyGame');
                    const sfDoc = await transaction.get(gameRef);
                    if (!sfDoc.exists()) throw "Error";

                    const currentData = sfDoc.data() as GreedyGameState;
                    if (currentData.status !== 'betting') throw "Late";

                    const betsMap = currentData.bets || {};
                    const existingUserBet = betsMap[userProfile.uid] || {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        bets: {}
                    };

                    // Calculate new total for this item
                    const currentItemBet = existingUserBet.bets[item.id] || 0;
                    const newItemBet = currentItemBet + amount;

                    existingUserBet.bets = {
                        ...existingUserBet.bets,
                        [item.id]: newItemBet
                    };

                    betsMap[userProfile.uid] = existingUserBet;
                    transaction.update(gameRef, { bets: betsMap });
                });
            } catch (e) {
                // Refund on failure
                await onBalanceUpdate(amount, 'greedyGame');
                setMyLockedBets(prev => {
                    const copy = { ...prev };
                    // Revert local state
                    if (copy[item.id] && copy[item.id] > amount) {
                        copy[item.id] -= amount;
                    } else {
                        delete copy[item.id];
                    }
                    return copy;
                });
                addToast('فشل الرهان. تم الاسترجاع.', 'error');
            }
        }
    };

    // --- Layout Calculations (Responsive) ---
    // Returns percentage positions to keep it responsive
    const getCircularStyle = (index: number, total: number) => {
        const radiusPercentage = 38; // Distance from center in %
        const angle = (index / total) * 2 * Math.PI - (Math.PI / 2);
        const x = Math.cos(angle) * radiusPercentage;
        const y = Math.sin(angle) * radiusPercentage;
        
        return {
            left: `${50 + x}%`,
            top: `${50 + y}%`,
            transform: 'translate(-50%, -50%)'
        };
    };

    return (
        <div className="flex flex-col h-full p-2 bg-[#111827] relative overflow-hidden items-center justify-center">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Main Game Container (Square Aspect Ratio, Responsive Width) */}
            <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center mt-4">
                
                {/* Center Result / Timer */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 text-center w-1/3 h-1/3 flex items-center justify-center rounded-full bg-gray-900 border-4 border-gray-700 shadow-2xl">
                    {resultMessage ? (
                        resultMessage
                    ) : gameState?.status === 'betting' ? (
                        <div className="flex flex-col items-center">
                            <div className="text-4xl sm:text-5xl font-black text-white font-mono">{timeLeft}</div>
                            <div className="text-[10px] text-green-400 font-bold mt-1 uppercase tracking-wider">Place Bets</div>
                        </div>
                    ) : (
                        <div className="text-sm sm:text-base font-bold text-yellow-400 animate-pulse">
                            {gameState?.status === 'spinning' ? 'جاري الدوران' : 'النتيجة'}
                        </div>
                    )}
                </div>

                {/* Items Ring */}
                {ITEMS.map((item, index) => {
                    const isLocked = !!myLockedBets[item.id];
                    const isHighlighted = activeHighlight === index;
                    const isWinner = gameState?.status === 'result' && gameState.winningItemId === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => handlePlaceBet(item)}
                            disabled={gameState?.status !== 'betting'}
                            className={`
                                absolute w-[23%] h-[23%] rounded-full border-2 flex flex-col items-center justify-center transition-all duration-150 z-10
                                ${isHighlighted ? 'scale-125 shadow-[0_0_20px_#fbbf24] border-yellow-400 bg-gray-800 ring-2 ring-yellow-200' : 'bg-gray-800 border-gray-600'}
                                ${isLocked ? 'border-green-500 ring-1 ring-green-400 opacity-100' : ''}
                                ${!isLocked && !isHighlighted ? 'hover:scale-110 opacity-90' : ''}
                                ${isWinner ? 'scale-125 ring-4 ring-green-500 z-30' : ''}
                            `}
                            style={getCircularStyle(index, 8)}
                        >
                            <div className="text-3xl sm:text-4xl leading-none mb-1">{item.icon}</div>
                            <div className={`text-[10px] sm:text-xs font-bold px-2 rounded-full text-white ${item.type === 'veg' ? 'bg-green-700' : 'bg-red-700'}`}>
                                x{item.multiplier}
                            </div>
                            
                            {/* Bet Badge */}
                            {isLocked && (
                                <div className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-white">
                                    {formatNumber(myLockedBets[item.id])}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* History Strip */}
            <div className="w-full max-w-md bg-black/40 p-2 rounded-lg mb-2 flex gap-2 overflow-x-auto no-scrollbar items-center h-12 border border-gray-800">
                <span className="text-[10px] text-gray-500 font-bold sticky left-0 bg-black/80 px-1 h-full flex items-center">History</span>
                {gameState?.history?.map((itemId, i) => {
                    const item = ITEMS.find(it => it.id === itemId);
                    if (!item) return null;
                    return (
                        <div key={i} className={`min-w-[30px] h-[30px] rounded-full flex items-center justify-center text-sm border ${item.type === 'veg' ? 'bg-green-900/50 border-green-700' : 'bg-red-900/50 border-red-700'}`}>
                            {item.icon}
                        </div>
                    )
                })}
            </div>

            {/* Controls */}
            <div className="mt-auto w-full max-w-md bg-gray-900/90 p-4 rounded-t-2xl border-t border-gray-700 backdrop-blur-sm z-30">
                <div className="flex justify-between items-center mb-2">
                    <div className="text-xs text-gray-400">الرصيد</div>
                    <div className="text-lg font-bold text-white">{formatNumber(userProfile?.balance || 0)} 💎</div>
                </div>
                <BetControls
                    bet={bet}
                    setBet={setBet}
                    balance={userProfile?.balance ?? 0}
                    disabled={gameState?.status !== 'betting'}
                />
            </div>
        </div>
    );
};

export default GreedyGame;
