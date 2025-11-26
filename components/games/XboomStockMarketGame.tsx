
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, StockMarketGameState } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import { convertTimestamps } from '../utils/convertTimestamps';
import { formatNumber } from '../utils/formatNumber';

interface UserProfile extends AppUser { balance: number; }
interface Props { userProfile: UserProfile | null; onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>; onAnnounceWin: any; }

// Extended Commodities List (10 Items)
const COMMODITIES = [
    { id: 'gold', name: 'ذهب', icon: '🥇' },
    { id: 'oil', name: 'نفط', icon: '🛢️' },
    { id: 'btc', name: 'بيتكوين', icon: '₿' },
    { id: 'eth', name: 'إيثريوم', icon: 'Ξ' },
    { id: 'usd', name: 'دولار', icon: '💵' },
    { id: 'silver', name: 'فضة', icon: '🥈' },
    { id: 'gas', name: 'غاز', icon: '🔥' },
    { id: 'aapl', name: 'أبل', icon: '🍎' },
    { id: 'tsla', name: 'تسلا', icon: '🚗' },
    { id: 'eur', name: 'يورو', icon: '💶' },
];

const MarketSimulator: React.FC = () => {
    const [price, setPrice] = useState(12450.50);
    const [change, setChange] = useState(0.5);
    
    useEffect(() => {
        const interval = setInterval(() => {
            const volatility = (Math.random() - 0.5) * 50;
            setPrice(p => Math.max(1000, p + volatility));
            setChange(volatility);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const isUp = change >= 0;

    return (
        <div className="w-full bg-gray-900 rounded-lg p-3 mb-4 border-2 border-gray-700 flex items-center justify-between shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden relative">
            {/* Moving Graph Line Effect */}
            <div className="absolute inset-0 opacity-10 flex items-center">
                 <div className="w-full h-1 bg-green-500 animate-pulse"></div>
            </div>
            
            <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xl">📊</div>
                <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">MARKET INDEX</p>
                    <p className="text-xl font-mono font-black text-white">{price.toFixed(2)}</p>
                </div>
            </div>
            
            <div className={`text-right z-10 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                <p className="text-lg font-bold">{isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}</p>
                <p className="text-xs opacity-80">{isUp ? '+0.4%' : '-0.2%'}</p>
            </div>
        </div>
    );
};

const XboomStockMarketGame: React.FC<Props> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<StockMarketGameState | null>(null);
    const [bet, setBet] = useState(100);
    
    // Track bets per item: { 'gold': { direction: 'up', amount: 100 }, ... }
    const [userBets, setUserBets] = useState<Record<string, { direction: 'up' | 'down', amount: number }>>({});
    const [payoutProcessed, setPayoutProcessed] = useState(false);
    const lastRoundId = useRef<number | string>('');

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'public', 'stockMarket'), (s) => {
            if (s.exists()) {
                const data = convertTimestamps(s.data()) as StockMarketGameState;
                setGameState(data);
            }
        });
        return () => unsub();
    }, []);

    // Game Loop & Payout Logic
    useEffect(() => {
        if (!gameState) return;

        // 1. Reset on New Round
        if (gameState.roundId !== lastRoundId.current) {
            lastRoundId.current = gameState.roundId;
            if (gameState.status === 'betting') {
                setUserBets({});
                setPayoutProcessed(false);
            }
        }

        // 2. Handle Results
        if (gameState.status === 'result' && gameState.results && !payoutProcessed) {
            let totalWinnings = 0;
            let winCount = 0;

            // Check each bet the user made
            Object.entries(userBets).forEach(([commodityId, betInfo]) => {
                // Cast betInfo to the correct type
                const typedBetInfo = betInfo as { direction: 'up' | 'down', amount: number };
                const resultDirection = gameState.results ? gameState.results[commodityId] : null;
                
                if (resultDirection && resultDirection === typedBetInfo.direction) {
                    // Winner: 1.95x payout
                    totalWinnings += typedBetInfo.amount * 1.95;
                    winCount++;
                }
            });

            if (totalWinnings > 0) {
                onBalanceUpdate(totalWinnings, 'xboomStockMarket');
                addToast(`مبروك! ربحت ${formatNumber(totalWinnings)} 💎 من ${winCount} توقعات صحيحة`, 'success');
                
                if (totalWinnings > 10000 && userProfile?.displayName) {
                    onAnnounceWin(userProfile.displayName, totalWinnings, 'xboomStockMarket');
                }
            } else if (Object.keys(userBets).length > 0) {
                addToast('حظ أوفر، لم تصب توقعاتك هذه المرة.', 'error');
            }

            setPayoutProcessed(true);
        }
    }, [gameState, userBets, payoutProcessed, onBalanceUpdate, onAnnounceWin, userProfile]);

    const handleBet = async (id: string, direction: 'up' | 'down') => {
        if (!userProfile || gameState?.status !== 'betting') return;
        
        const currentBetsCount = Object.keys(userBets).length;
        const isExistingBet = !!userBets[id];

        // LIMIT: Only 4 items allowed per round
        if (currentBetsCount >= 4 && !isExistingBet) {
            addToast('يمكنك اختيار 4 صفقات فقط في الجولة الواحدة لضمان التوازن', 'info');
            return;
        }
        
        // Prevent betting on same item twice (override check handled by UI state usually, but good to have)
        if (isExistingBet) {
             addToast(`لقد قمت بالتوقع لـ ${COMMODITIES.find(c => c.id === id)?.name} بالفعل`, 'info');
             return;
        }

        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }

        // Deduct Balance
        const success = await onBalanceUpdate(-bet, 'xboomStockMarket');
        if (success) {
            // Update Local State
            setUserBets(prev => ({
                ...prev,
                [id]: { direction, amount: bet }
            }));
            
            const commName = COMMODITIES.find(c => c.id === id)?.name;
            addToast(`تم التوقع: ${direction === 'up' ? 'صعود' : 'هبوط'} لـ ${commName}`, 'success');

            // Sync with Server (Multiplayer Record)
            try {
                await runTransaction(db, async (transaction) => {
                    const gameRef = doc(db, 'public', 'stockMarket');
                    const sfDoc = await transaction.get(gameRef);
                    if (!sfDoc.exists()) throw new Error("MISSING_DOC");

                    const currentData = sfDoc.data() as StockMarketGameState;
                    if (currentData.status !== 'betting') throw new Error("GAME_CLOSED");

                    const betsMap = currentData.bets || {};
                    const userGameBet = betsMap[userProfile.uid] || {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        bets: []
                    };

                    const existingBets = Array.isArray(userGameBet.bets) ? userGameBet.bets : [];
                    existingBets.push({
                        commodityId: id,
                        direction: direction,
                        amount: bet
                    });

                    userGameBet.bets = existingBets;
                    betsMap[userProfile.uid] = userGameBet;
                    
                    transaction.update(gameRef, { bets: betsMap });
                });
            } catch (e: any) {
                console.error("Bet sync error:", e);
                // Refund on failure
                await onBalanceUpdate(bet, 'xboomStockMarket');
                setUserBets(prev => {
                    const newState = { ...prev };
                    delete newState[id];
                    return newState;
                });
                
                if (e.message === "GAME_CLOSED") {
                    addToast("انتهى وقت التوقعات لهذه الجولة", "info");
                } else {
                    addToast("حدث خطأ في الاتصال. تم استرجاع الرصيد.", "error");
                }
            }
        }
    };

    return (
        <div className="flex flex-col h-full p-2 overflow-y-auto">
            {/* Aesthetic Market Simulator */}
            <MarketSimulator />

            <div className="text-center mb-4 sticky top-0 z-10 bg-gray-900/90 pb-2 pt-1 backdrop-blur-sm border-b border-gray-800">
                <div className="flex justify-between items-center mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${gameState?.status === 'betting' ? 'bg-green-900 text-green-400 border border-green-700' : 'bg-yellow-900 text-yellow-400 border border-yellow-700'}`}>
                        {gameState?.status === 'betting' ? '🟢 التوقعات مفتوحة' : '🟡 جاري المعالجة...'}
                    </span>
                    {gameState?.status === 'betting' && (
                        <span className="text-xs text-gray-400">
                            اختر حتى 4 سلع ({Object.keys(userBets).length}/4)
                        </span>
                    )}
                </div>
            </div>

            <div className="grid gap-3 pb-20">
                {COMMODITIES.map(c => {
                    const myBet = userBets[c.id]; // { direction, amount }
                    const isLocked = !!myBet; 
                    const resultDirection = gameState?.status === 'result' && gameState.results ? gameState.results[c.id] : null;

                    return (
                        <div key={c.id} className={`p-3 rounded-lg flex items-center justify-between border transition-all
                            ${isLocked ? 'bg-gray-800 border-gray-600' : 'bg-gray-800/50 border-gray-700'}
                            ${resultDirection ? (resultDirection === 'up' ? 'shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'shadow-[0_0_10px_rgba(239,68,68,0.2)]') : ''}
                        `}>
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{c.icon}</span>
                                <div>
                                    <span className="font-bold text-gray-200 block">{c.name}</span>
                                    {isLocked && (
                                        <span className="text-xs text-yellow-400 font-mono">
                                            {formatNumber(myBet.amount)} 💎 : {myBet.direction === 'up' ? '▲' : '▼'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {gameState?.status === 'result' && resultDirection ? (
                                <div className="flex flex-col items-end">
                                    <span className={`font-black text-xl ${resultDirection === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                                        {resultDirection === 'up' ? '▲ صعود' : '▼ هبوط'}
                                    </span>
                                    {isLocked && (
                                        <span className={`text-xs font-bold ${myBet.direction === resultDirection ? 'text-green-400 bg-green-900/30 px-2 rounded' : 'text-red-400 bg-red-900/30 px-2 rounded'}`}>
                                            {myBet.direction === resultDirection ? '✓ ربحت' : '✕ خسرت'}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleBet(c.id, 'up')} 
                                        disabled={isLocked || gameState?.status !== 'betting'} 
                                        className={`w-12 h-10 rounded-lg font-bold flex items-center justify-center transition-all
                                            ${myBet?.direction === 'up' ? 'bg-green-500 text-white ring-2 ring-white shadow-lg' : 'bg-green-900/40 text-green-500 border border-green-800 hover:bg-green-800'} 
                                            disabled:opacity-50
                                        `}
                                    >
                                        ▲
                                    </button>
                                    <button 
                                        onClick={() => handleBet(c.id, 'down')} 
                                        disabled={isLocked || gameState?.status !== 'betting'} 
                                        className={`w-12 h-10 rounded-lg font-bold flex items-center justify-center transition-all
                                            ${myBet?.direction === 'down' ? 'bg-red-500 text-white ring-2 ring-white shadow-lg' : 'bg-red-900/40 text-red-500 border border-red-800 hover:bg-red-800'} 
                                            disabled:opacity-50
                                        `}
                                    >
                                        ▼
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4 z-20">
                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={gameState?.status !== 'betting'} />
            </div>
        </div>
    );
};
export default XboomStockMarketGame;
