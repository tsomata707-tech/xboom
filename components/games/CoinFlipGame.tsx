
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, CoinFlipGameState, CoinFlipBet } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import GameTimerDisplay from '../GameTimerDisplay';
import { convertTimestamps } from '../utils/convertTimestamps';

interface UserProfile extends AppUser {
    balance: number;
}

interface CoinFlipGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const CoinFlipGame: React.FC<CoinFlipGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<CoinFlipGameState | null>(null);
    const [bet, setBet] = useState(25);
    const [showConfetti, setShowConfetti] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [hasBet, setHasBet] = useState(false);
    
    // --- 1. Sync with Firestore ---
    useEffect(() => {
        const docRef = doc(db, 'public', 'coinFlip');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as CoinFlipGameState;
                setGameState(data);
            }
        });

        // Timer Logic
        const timer = setInterval(() => {
            if (gameState) {
                const now = Date.now();
                const diff = Math.max(0, Math.ceil((gameState.endTime - now) / 1000));
                setTimeLeft(diff);
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, [gameState?.endTime]); // Re-run only when endTime changes or gameState ref changes deeply, simplifying dependancy

    // Reset local state on new round
    useEffect(() => {
        if (gameState?.status === 'betting') {
            setHasBet(false);
            setShowConfetti(false);
        } else if (gameState?.status === 'result') {
            // Check if user won this round
            if (userProfile && gameState.lastRoundWinners) {
                const winnerEntry = gameState.lastRoundWinners.find(w => w.nickname === userProfile.displayName);
                if (winnerEntry) {
                    setShowConfetti(true);
                    addToast(`مبروك! ربحت ${formatNumber(winnerEntry.amount)} 💎`, 'success');
                }
            }
        }
    }, [gameState?.status, gameState?.roundId]);

    const handleBet = useCallback(async (choice: 'king' | 'writing') => {
        if (!userProfile || !gameState) return;
        if (gameState.status !== 'betting') {
            addToast('انتظر الجولة القادمة للرهان.', 'info');
            return;
        }
        if (hasBet) {
            addToast('لقد راهنت بالفعل في هذه الجولة.', 'info');
            return;
        }
        if (bet <= 0 || bet > userProfile.balance) {
            addToast('رصيد غير كاف.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'coinFlip');
        if (success) {
            try {
                await runTransaction(db, async (transaction) => {
                    const gameRef = doc(db, 'public', 'coinFlip');
                    const sfDoc = await transaction.get(gameRef);
                    if (!sfDoc.exists()) throw "Game doc missing";

                    const currentData = sfDoc.data() as CoinFlipGameState;
                    if (currentData.status !== 'betting') throw "Game not betting";

                    const newBet: CoinFlipBet = {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        avatar: userProfile.photoURL || '👤',
                        amount: bet,
                        choice: choice,
                        timestamp: Date.now()
                    };

                    const bets = currentData.bets || {};
                    bets[userProfile.uid] = newBet;

                    transaction.update(gameRef, { bets: bets });
                });
                setHasBet(true);
                addToast(`تم الرهان على ${choice === 'king' ? 'ملك 👑' : 'كتابة ✍️'}`, 'success');
            } catch (e) {
                console.error("Bet failed", e);
                // Refund
                await onBalanceUpdate(bet, 'coinFlip');
                addToast('فشل الرهان. تم استرجاع الرصيد.', 'error');
            }
        }
    }, [bet, userProfile, gameState, hasBet, onBalanceUpdate, addToast]);

    if (!gameState) return <div className="flex justify-center items-center h-full text-cyan-400">جاري الاتصال بالسيرفر...</div>;

    const getCoinClasses = () => {
        if (gameState.status === 'flipping' || gameState.status === 'result') {
            if (gameState.result === 'king') return 'flipping-king';
            if (gameState.result === 'writing') return 'flipping-writing';
        }
        return '';
    };

    const myBet = userProfile && gameState.bets ? gameState.bets[userProfile.uid] : null;
    const betsList = (Object.values(gameState.bets || {}) as CoinFlipBet[]).sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="flex flex-col items-center p-2 game-container h-full justify-start gap-2 relative overflow-hidden">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Status Header */}
            <div className="w-full bg-gray-800/50 p-2 rounded-xl border border-gray-700 flex justify-between items-center">
                <div className="text-xs text-gray-400">
                    <p>الجولة #{gameState.roundId}</p>
                    <p>{betsList.length} لاعبين</p>
                </div>
                <div className={`px-4 py-1 rounded-full font-bold text-xl font-mono shadow-inner ${gameState.status === 'betting' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                    {timeLeft}s
                </div>
                <div className="text-xs text-gray-400 text-left">
                    <p>الحالة</p>
                    <p className={gameState.status === 'betting' ? 'text-green-400' : 'text-yellow-400'}>
                        {gameState.status === 'betting' ? 'مفتوح للرهان' : gameState.status === 'flipping' ? 'جاري الرمي...' : 'النتيجة'}
                    </p>
                </div>
            </div>

            <div className="coin-container my-4">
                <div className={`coin ${getCoinClasses()}`}>
                    <div className="coin-face coin-face-front text-[48px]">👑</div>
                    <div className="coin-face coin-face-back text-[48px]">✍️</div>
                </div>
            </div>

            <div className="h-8 mb-2 flex items-center justify-center w-full">
                {gameState.status === 'result' && gameState.result ? (
                    <div className="bg-yellow-500/20 px-6 py-2 rounded-full border border-yellow-500 animate-bounce">
                        <span className="font-bold text-yellow-300 text-xl">
                            فاز {gameState.result === 'king' ? 'الملك 👑' : 'الكتابة ✍️'}
                        </span>
                    </div>
                ) : (
                    myBet && <div className="text-sm text-cyan-300">رهانك: {formatNumber(myBet.amount)} على {myBet.choice === 'king' ? '👑' : '✍️'}</div>
                )}
            </div>
            
            <div className="w-full max-w-sm flex flex-col items-center gap-2 z-10">
                 <div className="flex gap-4 w-full">
                    <button 
                        onClick={() => handleBet('king')}
                        disabled={gameState.status !== 'betting' || hasBet}
                        className={`flex-1 py-4 text-2xl font-bold rounded-xl border-4 transition-all duration-300 flex flex-col items-center justify-center
                            ${myBet?.choice === 'king' ? 'border-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_#facc15]' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        <span>👑</span>
                        <span className="text-sm mt-1">ملك</span>
                    </button>
                    <button 
                        onClick={() => handleBet('writing')}
                        disabled={gameState.status !== 'betting' || hasBet}
                        className={`flex-1 py-4 text-2xl font-bold rounded-xl border-4 transition-all duration-300 flex flex-col items-center justify-center
                            ${myBet?.choice === 'writing' ? 'border-cyan-400 bg-cyan-400/20 shadow-[0_0_20px_#22d3ee]' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        <span>✍️</span>
                        <span className="text-sm mt-1">كتابة</span>
                    </button>
                 </div>
            </div>

            <div className="w-full mt-2">
                <BetControls
                    bet={bet}
                    setBet={setBet}
                    balance={userProfile?.balance ?? 0}
                    disabled={gameState.status !== 'betting' || hasBet}
                />
            </div>

            {/* Live Bets Feed */}
            <div className="w-full mt-4 flex-grow overflow-hidden flex flex-col bg-black/20 rounded-t-xl border-t border-gray-700">
                <div className="bg-gray-900/80 p-2 text-xs text-gray-400 font-bold border-b border-gray-700">
                    نشاط اللاعبين ({betsList.length})
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-2 custom-scrollbar max-h-[150px]">
                    {betsList.map((b, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-800/50 p-2 rounded animate-fade-in">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center text-xs">
                                    {b.avatar.includes('http') ? <img src={b.avatar} className="w-full h-full"/> : b.avatar}
                                </div>
                                <span className="text-xs font-bold text-gray-300 truncate max-w-[80px]">{b.nickname}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-yellow-300 font-mono">{formatNumber(b.amount)}</span>
                                <span className="text-lg">{b.choice === 'king' ? '👑' : '✍️'}</span>
                            </div>
                        </div>
                    ))}
                    {betsList.length === 0 && <p className="text-center text-gray-600 text-xs mt-4">بانتظار الرهانات...</p>}
                </div>
            </div>
        </div>
    );
};

export default CoinFlipGame;
