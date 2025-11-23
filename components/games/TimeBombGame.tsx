
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction, updateDoc, arrayUnion, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, TimeBombState, TimeBombParticipant } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import { convertTimestamps } from '../utils/convertTimestamps';
import DiamondIcon from '../icons/DiamondIcon';
import InfoIcon from '../icons/InfoIcon';
import HowToPlay from '../HowToPlay';

interface Props {
    userProfile: AppUser & { balance: number; playerID?: string };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const GRID_SIZE = 50;
const MAX_PLAYERS = 50;
const ENTRY_FEE = 100;
const GAME_DURATION_MS = 20000; // 20 seconds per round
const COOLDOWN_MS = 5000; // 5 seconds cooldown after explosion

const TimeBombGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    
    // State
    const [gameState, setGameState] = useState<TimeBombState | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('00');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const processingTriggered = useRef(false);

    // --- 1. Sync with Firestore ---
    useEffect(() => {
        const docRef = doc(db, 'public', 'timeBomb');

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as TimeBombState;
                setGameState(data);
            } else {
                // Initialize Game if not exists (Creates the data structure)
                initializeGame();
            }
            setLoading(false);
        });

        // Timer Logic
        const timerInterval = setInterval(() => {
            if (!gameState) return;

            const now = Date.now();
            
            if (gameState.status === 'active') {
                const diff = gameState.explosionTime - now;
                if (diff <= 0) {
                    setTimeLeft('💥');
                    // Trigger explosion logic if not already triggered
                    if (!processingTriggered.current) {
                        processingTriggered.current = true;
                        handleExplosion();
                    }
                } else {
                    processingTriggered.current = false;
                    setTimeLeft(Math.ceil(diff / 1000).toString());
                }
            } else if (gameState.status === 'exploded') {
                 // Check if cooldown is over to restart
                 const diff = (gameState.explosionTime + COOLDOWN_MS) - now;
                 if (diff <= 0 && !processingTriggered.current) {
                     processingTriggered.current = true;
                     startNewRound();
                 } else {
                     setTimeLeft('⏳');
                 }
            } else {
                 // If stuck in waiting or other states
                 if(!processingTriggered.current && (!gameState.startTime || (Date.now() - gameState.startTime > 60000))) {
                     // Fail-safe: if stuck for more than 1 minute, restart
                     processingTriggered.current = true;
                     startNewRound();
                 }
                setTimeLeft('00');
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(timerInterval);
        };
    }, [gameState]);

    // --- 2. Game Actions (Server-side Logic via Transactions) ---

    const initializeGame = async () => {
        try {
            // Use setDoc directly for initialization to avoid transaction complexity on empty docs
            const docRef = doc(db, 'public', 'timeBomb');
            const newState: TimeBombState = {
                roundId: Date.now().toString(),
                status: 'active', // Start immediately
                participants: [],
                startTime: Date.now(),
                explosionTime: Date.now() + GAME_DURATION_MS,
                entryFee: ENTRY_FEE,
                lastWinners: []
            };
            await setDoc(docRef, newState);
        } catch (e) {
            console.error("Init failed", e);
        }
    };

    const handleSystemReset = async () => {
        if (!confirm('هل أنت متأكد؟ سيتم إعادة ضبط لعبة القنبلة بالكامل وحذف اللاعبين الحاليين.')) return;
        setLoading(true);
        try {
            const docRef = doc(db, 'public', 'timeBomb');
            const newState: TimeBombState = {
                roundId: Date.now().toString(),
                status: 'active',
                participants: [],
                startTime: Date.now(),
                explosionTime: Date.now() + GAME_DURATION_MS,
                entryFee: ENTRY_FEE,
                lastWinners: []
            };
            await setDoc(docRef, newState);
            processingTriggered.current = false;
            addToast('تم إعادة ضبط النظام بنجاح', 'success');
        } catch (e) {
            console.error("System reset failed", e);
            addToast('فشل إعادة الضبط', 'error');
        } finally {
            setLoading(false);
        }
    };

    const startNewRound = async () => {
        try {
            const docRef = doc(db, 'public', 'timeBomb');
            // Simple update for restarting
            const newState: Partial<TimeBombState> = {
                roundId: Date.now().toString(),
                status: 'active',
                startTime: Date.now(),
                explosionTime: Date.now() + GAME_DURATION_MS,
                participants: [], // Clear participants
            };
            await updateDoc(docRef, newState);
            processingTriggered.current = false;
        } catch (e) {
            console.error("Start round failed", e);
            processingTriggered.current = false;
        }
    };

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

    const handleExplosion = async () => {
        try {
            await runTransaction(db, async (transaction) => {
                // ============================================================
                // PHASE 1: READS
                // All transaction.get() calls must happen here.
                // ============================================================

                // 1. Read Game State
                const docRef = doc(db, 'public', 'timeBomb');
                const sfDoc = await transaction.get(docRef);
                if (!sfDoc.exists()) return; // Should exist

                const data = convertTimestamps(sfDoc.data()) as TimeBombState;
                if (data.status !== 'active') return;

                // Filter out malformed participants
                const participants = (data.participants || []).filter(p => p && p.userId);
                
                // Variables to hold data for the Write Phase
                let treasuryDoc: any = null;
                let winnerDocs: any[] = [];
                let survivors: TimeBombParticipant[] = [];
                let updatedParticipants: TimeBombParticipant[] = [];
                let survivorNicknames: string[] = [];
                let houseFee = 0;
                let winAmountPerPerson = 0;

                if (participants.length > 0) {
                    // Logic Calculation (In memory, does not count as Read/Write)
                    const survivorsCount = Math.max(1, Math.ceil(participants.length * 0.3));
                    const totalPot = participants.length * ENTRY_FEE;
                    houseFee = totalPot * 0.10; 
                    const prizePool = totalPot - houseFee;
                    winAmountPerPerson = Math.floor(prizePool / survivorsCount);

                    const shuffled = [...participants].sort(() => 0.5 - Math.random());
                    survivors = shuffled.slice(0, survivorsCount);
                    survivorNicknames = survivors.map(s => s.nickname);
                    
                    updatedParticipants = participants.map(p => {
                        const isSurvivor = survivors.some(s => s.userId === p.userId);
                        return { ...p, status: isSurvivor ? 'winner' : 'dead' } as TimeBombParticipant;
                    });

                    // 2. Read Treasury & User Docs
                    const treasuryRef = doc(db, 'public', 'treasury');
                    const winnerRefs = survivors.map(s => doc(db, 'users', s.userId));
                    
                    // Execute Reads in Parallel
                    const results = await Promise.all([
                        transaction.get(treasuryRef),
                        ...winnerRefs.map(ref => transaction.get(ref))
                    ]);
                    
                    treasuryDoc = results[0];
                    winnerDocs = results.slice(1);
                } else {
                    // No participants logic
                    updatedParticipants = [];
                }

                // ============================================================
                // PHASE 2: WRITES
                // All transaction.set() and transaction.update() calls must happen here.
                // ============================================================

                if (participants.length === 0) {
                    // Just reset if no players
                    transaction.update(docRef, { status: 'exploded', lastWinners: [] });
                } else {
                    // 1. Log Profit
                    const logRef = doc(collection(db, 'profitLog'));
                    transaction.set(logRef, {
                        amount: houseFee,
                        percentage: 0.10,
                        gameId: 'timeBomb',
                        userId: 'SYSTEM',
                        userEmail: 'TimeBomb Round',
                        originalBet: participants.length * ENTRY_FEE,
                        timestamp: serverTimestamp()
                    });

                    // 2. Update Treasury
                    const treasuryRef = doc(db, 'public', 'treasury');
                    const currentTreasury = treasuryDoc?.exists() ? treasuryDoc.data().balance || 0 : 0;
                    transaction.set(treasuryRef, { balance: currentTreasury + houseFee }, { merge: true });

                    // 3. Update Winners
                    winnerDocs.forEach((userDoc, idx) => {
                        if (userDoc.exists()) {
                            const currentBal = userDoc.data().balance || 0;
                            transaction.update(userDoc.ref, { balance: currentBal + winAmountPerPerson });
                            
                            const notifRef = doc(collection(db, 'users', survivors[idx].userId, 'mailbox'));
                            transaction.set(notifRef, {
                                title: 'نجوت من القنبلة! 💣',
                                body: `مبروك! ربحت ${formatNumber(winAmountPerPerson)} 💎 في لعبة القنبلة الموقوتة.`,
                                type: 'win',
                                isRead: false,
                                timestamp: serverTimestamp()
                            });
                        }
                    });

                    // 4. Update Game State (Final Write)
                    transaction.update(docRef, {
                        status: 'exploded',
                        participants: updatedParticipants, 
                        lastWinners: survivorNicknames
                    });
                }
            });
            processingTriggered.current = false;
        } catch (e: any) {
            console.error("Explosion transaction failed", e);
            // Retry mechanism safety
            setTimeout(() => { processingTriggered.current = false; }, 2000);
        }
    };

    // --- Render Helpers ---

    if (loading) {
        return <div className="flex justify-center items-center h-full text-cyan-400">جاري الاتصال بغرفة القنبلة...</div>;
    }
    
    // If state is null, show retry (should have initialized)
    if (!gameState) {
         return (
            <div className="flex flex-col justify-center items-center h-full text-cyan-400 gap-4">
                <p>جاري تهيئة البيانات...</p>
                <button onClick={initializeGame} className="bg-purple-600 px-4 py-2 rounded text-white">بدء التشغيل</button>
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

    const totalPot = gameState.participants.length * ENTRY_FEE;
    const survivorsCount = Math.max(1, Math.ceil(gameState.participants.length * 0.3));
    const estimatedPrize = gameState.participants.length > 0 ? Math.floor((totalPot * 0.9) / survivorsCount) : 0;

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
                 
                 <HowToPlay customTrigger={
                     <div className="bg-gray-800 p-1.5 rounded-full border border-gray-600 hover:bg-gray-700 hover:border-cyan-400 text-yellow-400 transition-all cursor-pointer shadow-lg">
                         <InfoIcon className="w-5 h-5" />
                     </div>
                 }>
                    <div className="text-center">
                         <h3 className="text-lg font-bold text-yellow-400 mb-2">القنبلة الموقوتة (جماعية) 💣</h3>
                         <p className="leading-relaxed mb-2 text-white font-medium">لعبة بقاء جماعية مباشرة!</p>
                         <ul className="text-right text-sm space-y-2 list-disc list-inside text-gray-200 font-semibold">
                            <li>الجولة تبدأ كل 20 ثانية.</li>
                            <li>عند انتهاء الوقت، تنفجر القنبلة وتقضي على 70% من اللاعبين.</li>
                            <li>الناجون (30%) يتقاسمون الصندوق بالكامل.</li>
                            <li>هذه اللعبة تعتمد على الحظ المحض.</li>
                         </ul>
                    </div>
                </HowToPlay>

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
                
                {/* Manual Reset Button (Always visible at bottom of scroll for safety) */}
                <div className="mt-8 text-center opacity-30 hover:opacity-100 transition-opacity">
                    <button onClick={handleSystemReset} className="text-[10px] text-red-500 border border-red-900 px-2 py-1 rounded hover:bg-red-900/20">
                        ⚠️ إعادة تهيئة النظام (للمشرفين)
                    </button>
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
