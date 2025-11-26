
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, TimeBombState, TimeBombParticipant } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import { convertTimestamps } from '../utils/convertTimestamps';

interface Props {
    userProfile: AppUser & { balance: number; playerID?: string };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const GRID_SIZE = 50;
const MAX_PLAYERS = 50;
const ENTRY_FEE = 100;

const TimeBombGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    
    // State
    const [gameState, setGameState] = useState<TimeBombState | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('00');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // --- 1. Sync with Firestore ---
    useEffect(() => {
        const docRef = doc(db, 'public', 'timeBomb');

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as TimeBombState;
                setGameState(data);
            } else {
                // Initialize Game if not exists (Creates the data structure)
                // Just a fallback; engine usually does this.
                setDoc(docRef, {
                    status: 'active',
                    participants: [],
                    startTime: Date.now(),
                    explosionTime: Date.now() + 10000,
                    roundId: Date.now().toString(),
                    entryFee: ENTRY_FEE,
                    lastWinners: []
                });
            }
            setLoading(false);
        });

        // Timer Logic (Display Only)
        const timerInterval = setInterval(() => {
            if (!gameState) return;

            const now = Date.now();
            
            if (gameState.status === 'active') {
                const diff = gameState.explosionTime - now;
                if (diff <= 0) {
                    setTimeLeft('💥');
                } else {
                    setTimeLeft(Math.ceil(diff / 1000).toString());
                }
            } else if (gameState.status === 'exploded') {
                 setTimeLeft('⏳');
            } else {
                setTimeLeft('00');
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(timerInterval);
        };
    }, [gameState]);

    // --- 2. Game Actions ---

    const handleJoin = async () => {
        if (!userProfile || !gameState) return;
        if (gameState.participants.length >= MAX_PLAYERS) {
            addToast('الغرفة ممتلئة!', 'error');
            return;
        }
        if (gameState.status !== 'active') {
            addToast('انتظر بداية الجولة القادمة.', 'info');
            return;
        }
        // Check if already joined
        if (gameState.participants.some(p => p.userId === userProfile.uid)) {
            addToast('أنت مشترك بالفعل.', 'info');
            return;
        }
        
        if (userProfile.balance < ENTRY_FEE) {
             addToast('رصيد غير كاف للانضمام.', 'error');
             return;
        }

        setProcessing(true);
        const success = await onBalanceUpdate(-ENTRY_FEE, 'timeBomb');
        
        if (success) {
            try {
                const docRef = doc(db, 'public', 'timeBomb');
                // Random unused index
                const usedIndices = new Set(gameState.participants.map(p => p.gridIndex));
                let gridIndex = Math.floor(Math.random() * GRID_SIZE);
                let attempts = 0;
                while (usedIndices.has(gridIndex) && attempts < 100) {
                    gridIndex = Math.floor(Math.random() * GRID_SIZE);
                    attempts++;
                }

                const participant: TimeBombParticipant = {
                    userId: userProfile.uid,
                    nickname: userProfile.displayName || 'Unknown',
                    avatar: userProfile.photoURL || '👤',
                    status: 'alive',
                    gridIndex: gridIndex
                };

                await updateDoc(docRef, {
                    participants: arrayUnion(participant)
                });
                addToast('تم الانضمام بنجاح! 💣', 'success');
            } catch (e) {
                console.error("Join failed", e);
                addToast('فشل الانضمام.', 'error');
                // Consider refunding if firestore update fails (omitted for brevity)
            }
        }
        setProcessing(false);
    };

    // --- Render Helpers ---

    if (loading) {
        return <div className="flex justify-center items-center h-full text-cyan-400">جاري الاتصال بغرفة القنبلة...</div>;
    }
    
    if (!gameState) {
         return (
            <div className="flex flex-col justify-center items-center h-full text-cyan-400 gap-4">
                <p>جاري تهيئة البيانات...</p>
            </div>
        );
    }

    const myParticipant = gameState.participants.find(p => p.userId === userProfile.uid);
    const isJoined = !!myParticipant;
    
    const getCellContent = (index: number) => {
        const player = gameState.participants.find(p => p.gridIndex === index);
        
        if (!player) return null;

        let bgClass = 'bg-gray-800/60 border-gray-700';
        let icon = player.avatar;
        let animClass = 'scale-0 animate-pop-in';

        if (player.userId === userProfile.uid) {
             bgClass = 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_10px_cyan]';
        }

        if (player.status === 'dead') {
            bgClass = 'bg-red-900/90 border-red-500';
            icon = '💥';
            animClass = 'animate-shake';
        } else if (player.status === 'winner') {
            bgClass = 'bg-green-600/80 border-green-400 shadow-[0_0_15px_#4ade80]';
            icon = '💎';
            animClass = 'animate-bounce';
        } else {
            // Alive
            animClass = ''; 
        }

        return (
            <div className={`relative w-full h-full flex flex-col items-center justify-center transition-all duration-300 rounded-md overflow-hidden border-2 ${bgClass}`}>
                {player.userId === userProfile.uid && (
                    <div className="absolute top-0 right-0 bg-cyan-500 text-[6px] px-1 text-white font-bold rounded-bl">أنت</div>
                )}

                <div className={`text-lg sm:text-2xl filter drop-shadow-md ${animClass}`} style={{animationFillMode: 'forwards'}}>
                    {icon.startsWith('http') ? <img src={icon} alt="av" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover"/> : icon}
                </div>

                {(player.status === 'alive' || player.status === 'winner') && (
                    <div className="text-[7px] sm:text-[9px] text-gray-300 mt-0.5 bg-black/30 px-1 rounded-full max-w-full truncate">
                        {player.nickname}
                    </div>
                )}
            </div>
        );
    };

    const estimatedPrize = gameState.participants.length > 1 
        ? Math.floor((gameState.participants.length * ENTRY_FEE * 0.7) / Math.ceil(gameState.participants.length * 0.3)) 
        : 0;

    return (
        <div className="flex flex-col h-full bg-[#0f172a] relative overflow-hidden">
             <style>{`
                @keyframes pop-in { 0% { transform: scale(0); } 80% { transform: scale(1.1); } 100% { transform: scale(1); } }
                .animate-pop-in { animation: pop-in 0.3s ease-out forwards; }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
                .animate-shake { animation: shake 0.5s ease-in-out; }
            `}</style>

            {/* Top Bar */}
            <div className="bg-gray-900 p-2 shadow-md z-10 flex justify-between items-center border-b border-gray-800">
                 <div className="flex items-center gap-2">
                     <div className="text-center">
                        <p className="text-[10px] text-gray-400">اللاعبون</p>
                        <p className="text-white font-bold">{gameState.participants.length}<span className="text-gray-500 text-xs">/{MAX_PLAYERS}</span></p>
                     </div>
                     <div className="h-6 w-px bg-gray-700"></div>
                     <div>
                        <p className="text-[10px] text-gray-400">الجائزة المتوقعة</p>
                        <p className="text-yellow-400 font-bold text-xs">~{formatNumber(estimatedPrize)}</p>
                     </div>
                 </div>
                 
                 <div className={`px-4 py-1 rounded-full font-bold text-lg font-mono shadow-inner ${gameState.status === 'exploded' ? 'bg-red-900/50 text-red-500 border border-red-500/50' : 'bg-blue-900/50 text-cyan-400 border border-cyan-500/50'}`}>
                     {timeLeft}
                 </div>
            </div>

            {/* Game Grid */}
            <div className="flex-grow p-2 overflow-y-auto custom-scrollbar z-10">
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1 w-full content-start auto-rows-fr aspect-square sm:aspect-auto pb-20">
                    {Array.from({ length: GRID_SIZE }).map((_, i) => (
                        <div key={i} className="aspect-square bg-gray-900/30 rounded-md border border-gray-800/30 flex items-center justify-center relative">
                            {!gameState.participants.find(p => p.gridIndex === i) && (
                                <span className="text-[8px] text-gray-700 select-none absolute bottom-1 right-1">{i+1}</span>
                            )}
                            {getCellContent(i)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Control Panel */}
            <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-purple-500/30 backdrop-blur-md shadow-[0_-5px_20px_rgba(0,0,0,0.5)] z-50">
                <div className="flex flex-col p-3 gap-3">
                    
                    {/* Last Winners Ticker */}
                    {gameState.lastWinners && gameState.lastWinners.length > 0 && (
                        <div className="bg-black/40 p-1 px-2 rounded text-xs text-gray-400 overflow-hidden whitespace-nowrap flex items-center">
                            <span className="text-yellow-500 font-bold ml-2 whitespace-nowrap">🏆 الفائزون السابقون:</span>
                            <div className="marquee-content flex gap-4">
                                {gameState.lastWinners.map((w, i) => <span key={i} className="text-white">{w}</span>)}
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <div className="w-full">
                        {!isJoined ? (
                            <button 
                                onClick={handleJoin}
                                disabled={processing || gameState.status !== 'active'}
                                className={`w-full py-3 text-white font-bold text-xl rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all
                                    ${gameState.status === 'active' ? 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500' : 'bg-gray-600 cursor-not-allowed'}
                                `}
                            >
                                {processing ? 'جاري الانضمام...' : 
                                 gameState.status === 'exploded' ? 'انتظر الجولة التالية...' : 
                                 <>
                                    <span>دخول الجولة</span>
                                    <span className="bg-black/20 px-2 py-0.5 rounded text-sm">{ENTRY_FEE}💎</span>
                                 </>
                                }
                            </button>
                        ) : (
                             <div className={`w-full py-3 font-bold rounded-xl text-center flex items-center justify-center gap-2 
                                ${myParticipant?.status === 'dead' ? 'bg-red-900/50 text-red-300 border border-red-500/50' : 
                                  myParticipant?.status === 'winner' ? 'bg-green-900/50 text-green-300 border border-green-500/50' : 
                                  'bg-cyan-900/30 text-cyan-300 border border-cyan-500/30'}`}
                             >
                                {myParticipant?.status === 'dead' ? <span>💀 لقد قُتلت... حظاً أوفر</span> :
                                 myParticipant?.status === 'winner' ? <span>🎉 مبروك! لقد نجوت</span> :
                                 <span className="animate-pulse">✅ أنت في منطقة الخطر...</span>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeBombGame;
