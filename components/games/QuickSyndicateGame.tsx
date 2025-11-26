
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp, collection, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, QuickSyndicateState, SyndicateParticipant } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import DiamondIcon from '../icons/DiamondIcon';
import GlobeNetworkIcon from '../icons/GlobeNetworkIcon';
import { convertTimestamps } from '../utils/convertTimestamps';

interface UserProfile extends AppUser {
    balance: number;
    isAdmin?: boolean;
}

interface QuickSyndicateGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const ADMIN_FEE_PERCENTAGE = 0.30; // 30% Fee
const CYCLE_DURATION_MS = 10000; // 10s game
const WAITING_DURATION_MS = 10000; // 10s prep

const generateFee = () => {
    // Random fee between 500 and 2500
    return Math.floor(Math.random() * 5 + 1) * 500;
};

const QuickSyndicateGame: React.FC<QuickSyndicateGameProps> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [syndicateState, setSyndicateState] = useState<QuickSyndicateState | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('00:00');
    const [loading, setLoading] = useState(true);
    const [welcomeMsg, setWelcomeMsg] = useState<{ nickname: string, id: number } | null>(null);
    
    const prevParticipantsLength = useRef(0);
    const processingTriggered = useRef(false);

    // --- 1. Sync with Firestore & Timer Logic ---
    useEffect(() => {
        const docRef = doc(db, 'public', 'quickSyndicate');
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as QuickSyndicateState;
                setSyndicateState(data);

                if (data.participants && data.participants.length > prevParticipantsLength.current) {
                    const newJoiner = data.participants[data.participants.length - 1];
                    if (newJoiner && Date.now() - newJoiner.joinedAt < 10000) {
                         setWelcomeMsg({ nickname: newJoiner.nickname, id: Date.now() });
                         setTimeout(() => setWelcomeMsg(null), 3000);
                    }
                }
                prevParticipantsLength.current = data.participants?.length || 0;
            } else {
                // Initialize if doesn't exist
                startNewRound();
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching syndicate:", error);
            setLoading(false); // Ensure loading stops even on error
        });

        // Timer Interval
        const interval = setInterval(() => {
            if (!syndicateState) return;
            
            const now = Date.now();
            const end = syndicateState.endTime;
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('00:00');
                
                if (syndicateState.status === 'open') {
                    if (!processingTriggered.current) {
                        // Logic to handle processing triggering
                        const isParticipantIndex = userProfile ? syndicateState.participants.findIndex(p => p.userId === userProfile.uid) : -1;
                        
                        // Allow a grace period before forcing close
                        const isStale = diff < -15000; 
                        
                        let delay = -1;

                        if (isStale) {
                            delay = Math.random() * 5000;
                        } else {
                            // Priority to participants to trigger processing
                            if (isParticipantIndex === 0) delay = 1000;
                            else if (isParticipantIndex === 1) delay = 2000;
                            else if (isParticipantIndex >= 0) delay = 3000;
                        }

                        if (delay !== -1) {
                             processingTriggered.current = true;
                             setTimeout(() => {
                                 processRound();
                             }, delay);
                        }
                    }
                } else if (syndicateState.status === 'completed') {
                     if (!processingTriggered.current) {
                         // Restart cycle after waiting period
                         // Check if waiting duration passed relative to old end time + waiting duration
                         // But simpler: check if status is completed for a while
                         // Let's assume 'completed' status holds until next start trigger
                         
                         // Only restart if explicitly completed and time passed
                         // Here we treat 'completed' state as the 'waiting' 10s
                         
                         // To ensure 10s wait, we check if we exceeded endTime + WAITING
                         // Actually, startNewRound sets up the NEW open phase.
                         // So we wait here.
                         if (diff < -WAITING_DURATION_MS) {
                             processingTriggered.current = true;
                             const delay = Math.random() * 2000;
                             setTimeout(() => {
                                 startNewRound();
                             }, delay);
                         } else {
                             setTimeLeft("انتظار...");
                         }
                     }
                }
            } else {
                processingTriggered.current = false;
                const seconds = Math.floor((diff / 1000) % 60);
                setTimeLeft(`00:${seconds.toString().padStart(2, '0')}`);
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [syndicateState, userProfile]);

    // --- 2. Game Logic Functions ---

    const startNewRound = async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const docRef = doc(db, 'public', 'quickSyndicate');
                const sfDoc = await transaction.get(docRef);
                
                if (sfDoc.exists()) {
                    const data = convertTimestamps(sfDoc.data()) as QuickSyndicateState;
                    // Stronger check: Don't restart if it's open and valid
                    if (data.status === 'open' && Date.now() < data.endTime) return; 
                }

                const now = Date.now();
                const endTime = now + CYCLE_DURATION_MS;
                
                const newFee = generateFee();
                const roundId = Date.now().toString();

                const newState: QuickSyndicateState = {
                    roundId: roundId,
                    entryFee: newFee,
                    participants: [],
                    startTime: now,
                    endTime: endTime,
                    status: 'open',
                    lastWinners: sfDoc.exists() ? (convertTimestamps(sfDoc.data()) as QuickSyndicateState).lastWinners : []
                };

                transaction.set(docRef, newState);
            });
            processingTriggered.current = false;
        } catch (e: any) {
            processingTriggered.current = false;
            console.error("Transaction failed (Start Round): ", e);
        }
    };

    const processRound = async () => {
        try {
             await runTransaction(db, async (transaction) => {
                const docRef = doc(db, 'public', 'quickSyndicate');
                const sfDoc = await transaction.get(docRef);
                if (!sfDoc.exists()) return;

                const data = convertTimestamps(sfDoc.data()) as QuickSyndicateState;
                
                if (data.status !== 'open') return; 

                const participants = data.participants;
                const totalCollected = participants.length * data.entryFee;
                
                if (participants.length === 0) {
                    transaction.update(docRef, { status: 'completed', lastWinners: [] });
                    return;
                }

                // Logic: If 1 player, he loses (House takes all). If > 1, 70% to winners.
                if (participants.length === 1) {
                    // Solo player loses
                    const treasuryRef = doc(db, 'public', 'treasury');
                    const treasuryDoc = await transaction.get(treasuryRef);
                    const currentTreasury = treasuryDoc.exists() ? treasuryDoc.data().balance || 0 : 0;
                    transaction.set(treasuryRef, { balance: currentTreasury + totalCollected }, { merge: true });

                    // Log
                    const logRef = doc(collection(db, 'profitLog'));
                    transaction.set(logRef, {
                        amount: totalCollected,
                        percentage: 1.0,
                        gameId: 'quickSyndicate',
                        userId: 'SYSTEM',
                        userEmail: 'QuickSyndicate Solo Loss',
                        originalBet: totalCollected,
                        timestamp: serverTimestamp()
                    });

                    transaction.update(docRef, { 
                        status: 'completed',
                        lastWinners: [],
                        totalPot: totalCollected
                    });

                } else {
                    // Multiplayer Logic
                    const adminShare = totalCollected * ADMIN_FEE_PERCENTAGE;
                    const prizePool = totalCollected - adminShare;
                    
                    const winnersCount = Math.max(1, Math.floor(participants.length / 2));
                    const winAmountPerPerson = prizePool / winnersCount;

                    const shuffled = [...participants].sort(() => 0.5 - Math.random());
                    const winners = shuffled.slice(0, winnersCount);

                    const treasuryRef = doc(db, 'public', 'treasury');
                    const winnerUserRefs = winners.map(w => doc(db, 'users', w.userId));

                    const treasuryDoc = await transaction.get(treasuryRef);
                    const userDocs = await Promise.all(winnerUserRefs.map(ref => transaction.get(ref)));

                    userDocs.forEach((userDoc, index) => {
                        if (userDoc.exists()) {
                            const userData = convertTimestamps(userDoc.data());
                            const winner = winners[index];
                            const newBalance = (userData.balance || 0) + winAmountPerPerson;
                            transaction.update(userDoc.ref, { balance: newBalance });
                            
                            const mailboxRef = doc(collection(db, 'users', winner.userId, 'mailbox'));
                            transaction.set(mailboxRef, {
                                title: 'مبروك! فوز في الجمعية السريعة',
                                body: `لقد ربحت ${formatNumber(winAmountPerPerson)} 💎 في الجمعية.`,
                                type: 'win',
                                isRead: false,
                                timestamp: serverTimestamp()
                            });
                        }
                    });

                    const treasuryData = treasuryDoc.exists() ? convertTimestamps(treasuryDoc.data()) : { balance: 0 };
                    transaction.set(treasuryRef, { 
                        balance: (treasuryData.balance || 0) + adminShare 
                    }, { merge: true });

                    const logRef = doc(collection(db, 'profitLog'));
                    transaction.set(logRef, {
                        amount: adminShare,
                        percentage: ADMIN_FEE_PERCENTAGE,
                        gameId: 'quickSyndicate',
                        userId: 'SYSTEM',
                        userEmail: 'Round ' + data.roundId,
                        originalBet: totalCollected,
                        timestamp: serverTimestamp()
                    });
                    
                    const notifRef = doc(collection(db, 'notifications'));
                    transaction.set(notifRef, {
                        recipientId: 'ADMIN',
                        recipientEmail: 'Admin Panel',
                        title: 'تقرير الجمعية السريعة',
                        body: `الجولة ${data.roundId} انتهت. المشتركون: ${participants.length}. الفائزون: ${winners.map(w => w.nickname).join(', ')}. ربح الإدارة: ${formatNumber(adminShare)}`,
                        type: 'info',
                        timestamp: serverTimestamp(),
                        isRead: false
                    });

                    transaction.update(docRef, { 
                        status: 'completed',
                        lastWinners: winners.map(w => w.nickname),
                        totalPot: totalCollected
                    });
                }
            });
            
            processingTriggered.current = false; 

        } catch (e: any) {
            console.error("Transaction failed (Process Round): ", e);
            processingTriggered.current = false; 
        }
    };

    const handleJoin = async () => {
        if (!userProfile || !syndicateState) return;
        
        if (!userProfile.uid) {
            addToast('حدث خطأ في بيانات حسابك.', 'error');
            return;
        }

        const fee = syndicateState.entryFee;
        const isAlreadyJoined = syndicateState.participants.some(p => p.userId === userProfile.uid);

        if (isAlreadyJoined) {
            addToast('أنت مشترك بالفعل.', 'info');
            return;
        }

        if (userProfile.balance < fee) {
            addToast('رصيدك غير كاف.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-fee, 'quickSyndicate');
        if (success) {
            const docRef = doc(db, 'public', 'quickSyndicate');
            const participant: SyndicateParticipant = {
                userId: userProfile.uid,
                nickname: userProfile.displayName || 'Unknown',
                avatar: userProfile.photoURL || '👤',
                joinedAt: Date.now()
            };
            
            await updateDoc(docRef, {
                participants: arrayUnion(participant)
            });
            
            addToast('تم الاشتراك بنجاح!', 'success');
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full text-cyan-400 animate-pulse">جاري تحميل الجمعية...</div>;
    }
    
    if (!syndicateState) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-cyan-400 gap-4">
                <p>جاري تهيئة الجولة...</p>
                <button onClick={() => startNewRound()} className="px-4 py-2 bg-purple-600 rounded text-white">
                    تحديث
                </button>
            </div>
        );
    }
    
    const isJoined = userProfile && userProfile.uid && syndicateState.participants.some(p => p.userId === userProfile.uid);
    const currentPot = syndicateState.participants.length * syndicateState.entryFee;

    return (
        <div className="flex flex-col h-full relative overflow-hidden">
            {welcomeMsg && (
                <div className="absolute top-1/3 right-0 z-50 animate-slide-in-right">
                    <div className="bg-gradient-to-l from-purple-600 to-cyan-600 text-white px-6 py-3 rounded-l-full shadow-2xl border-y border-l border-white/30 flex items-center gap-3">
                        <span className="text-2xl">👋</span>
                        <div>
                            <p className="text-xs text-gray-200">انضم للغرفة</p>
                            <p className="font-bold text-lg">{welcomeMsg.nickname}</p>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes slide-in-right {
                    0% { transform: translateX(100%); opacity: 0; }
                    10% { transform: translateX(0); opacity: 1; }
                    90% { transform: translateX(0); opacity: 1; }
                    100% { transform: translateX(100%); opacity: 0; }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 3s ease-in-out forwards;
                }
            `}</style>

            <div className="bg-gray-800/50 p-4 rounded-xl border border-purple-500/30 mb-4 flex justify-between items-center shadow-lg relative overflow-hidden">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                 <div className="flex flex-col z-10">
                     <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">الجمعية السريعة</h2>
                     <span className="text-xs text-gray-400">جولة كل 10 ثواني</span>
                 </div>
                 <div className="flex flex-col items-end z-10">
                     <span className="text-xs text-gray-400">الوقت المتبقي</span>
                     <span className={`text-2xl font-mono font-bold ${syndicateState.status === 'completed' ? 'text-yellow-400 animate-pulse' : 'text-cyan-400'}`}>
                         {syndicateState.status === 'completed' ? 'جاري التوزيع...' : timeLeft}
                     </span>
                 </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-400 mb-1">رسوم الاشتراك</span>
                    <div className="flex items-center gap-2">
                        <DiamondIcon className="w-6 h-6 text-yellow-400" />
                        <span className="text-2xl font-bold text-white">{formatNumber(syndicateState.entryFee)}</span>
                    </div>
                </div>
                <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-400 mb-1">إجمالي الصندوق</span>
                    <div className="flex items-center gap-2">
                        <DiamondIcon className="w-6 h-6 text-green-400" />
                        <span className="text-2xl font-bold text-green-300">{formatNumber(currentPot)}</span>
                    </div>
                </div>
            </div>

            <div className="flex-grow flex flex-col items-center justify-center relative mb-4">
                <div className="w-48 h-48 rounded-full border-4 border-purple-500/30 flex items-center justify-center relative bg-gray-800/50 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
                    <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping"></div>
                    <div className="absolute inset-2 rounded-full border border-purple-500/20 animate-pulse"></div>
                    <div className="text-center z-10">
                        <GlobeNetworkIcon className="w-16 h-16 mx-auto text-cyan-400 mb-2 opacity-80"/>
                        <p className="text-gray-300 font-bold">{syndicateState.participants.length} مشترك</p>
                    </div>
                </div>
            </div>

            <div className="bg-gray-900/80 rounded-t-2xl border-t border-gray-700 flex flex-col flex-grow max-h-[30vh]">
                <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">سجل الحضور</h3>
                </div>
                <div className="overflow-y-auto flex-grow p-2 space-y-2">
                    {syndicateState.participants.length === 0 ? (
                        <p className="text-center text-gray-500 py-4 text-sm">كن أول من يشترك!</p>
                    ) : (
                        syndicateState.participants.slice().reverse().map((p, i) => (
                            <div key={i} className="flex items-center justify-between bg-gray-800 p-2 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-lg">{p.avatar.includes('http') ? <img src={p.avatar} className="w-full h-full rounded-full"/> : p.avatar}</div>
                                    <span className="text-sm font-bold text-gray-200">{p.nickname}</span>
                                </div>
                                <span className="text-xs text-gray-500">{new Date(p.joinedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-auto pt-2">
                 <button
                    onClick={handleJoin}
                    disabled={!!isJoined || syndicateState.status !== 'open' || !userProfile}
                    className={`w-full py-4 text-2xl font-black rounded-xl shadow-lg transition-all transform active:scale-95
                        ${isJoined 
                            ? 'bg-green-600 text-white cursor-default' 
                            : syndicateState.status !== 'open' 
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-purple-900/50'
                        }
                    `}
                >
                    {syndicateState.status === 'completed' ? 'انتظر الجولة التالية...' : 
                     isJoined ? '✅ تم الاشتراك' : `دخول الجمعية (${formatNumber(syndicateState.entryFee)})`}
                </button>
            </div>
        </div>
    );
};

export default QuickSyndicateGame;
