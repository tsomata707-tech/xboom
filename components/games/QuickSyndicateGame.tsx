
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp, collection, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, QuickSyndicateState, SyndicateParticipant } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import DiamondIcon from '../icons/DiamondIcon';
import GlobeNetworkIcon from '../icons/GlobeNetworkIcon';
import Confetti from '../Confetti';
import { convertTimestamps } from '../utils/convertTimestamps';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
    isAdmin?: boolean;
}

interface QuickSyndicateGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const ADMIN_FEE_PERCENTAGE = 0.20;

// Function to generate random fee for the hour (500 to 5000)
const generateHourlyFee = () => {
    // Generate a number between 1 and 10, multiply by 500.
    // Result: 500, 1000, 1500 ... 5000.
    return Math.floor(Math.random() * 10 + 1) * 500;
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
                // Use convertTimestamps to handle Firestore types and prevent circular ref errors in state
                const data = convertTimestamps(docSnap.data()) as QuickSyndicateState;
                setSyndicateState(data);

                // Check for new participants to show welcome message
                if (data.participants && data.participants.length > prevParticipantsLength.current) {
                    // Get the last added participant
                    const newJoiner = data.participants[data.participants.length - 1];
                    // Only show if it's recent (within last 10 seconds) to avoid flood on initial load
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
                    // The round is open but time is up. We need to process it.
                    if (!processingTriggered.current) {
                        
                        // 1. Normal Leader Election (Preferred)
                        // Only specific users try to process first to avoid write contention
                        const isParticipantIndex = userProfile ? syndicateState.participants.findIndex(p => p.userId === userProfile.uid) : -1;
                        const isAdmin = userProfile?.isAdmin;
                        const isStale = diff < -60000; // If stuck for more than 1 minute
                        
                        let delay = -1;

                        if (isStale) {
                            // Fail-safe: If round is stuck for > 60s, ANYONE connected triggers it with random delay
                            delay = Math.random() * 5000;
                        } else {
                            // Standard orderly closing
                            if (isAdmin) delay = 0;
                            else if (isParticipantIndex === 0) delay = 2000;
                            else if (isParticipantIndex === 1) delay = 4000;
                            else if (isParticipantIndex === 2) delay = 6000;
                        }

                        if (delay !== -1) {
                             processingTriggered.current = true;
                             setTimeout(() => {
                                 processRound();
                             }, delay);
                        }
                    }
                } else if (syndicateState.status === 'completed') {
                     // Round is completed, wait a bit then start new one
                     // Check if it's been completed for a while (e.g., 5 seconds)
                     // Or if the endTime was yesterday (stale completed round)
                     
                     // Reset trigger for the next cycle
                     if (syndicateState.status === 'open') processingTriggered.current = false;

                     if (!processingTriggered.current) {
                         const isStaleCompleted = diff < -60000; // Completed long ago
                         
                         // Only start new round if we are past the "buffer" time
                         if (diff < -5000 || isStaleCompleted) {
                             processingTriggered.current = true;
                             const delay = Math.random() * 3000;
                             setTimeout(() => {
                                 startNewRound();
                             }, delay);
                         }
                     }
                }
            } else {
                // Round is running normally
                processingTriggered.current = false;

                const minutes = Math.floor((diff / 1000 / 60) % 60);
                const seconds = Math.floor((diff / 1000) % 60);
                setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

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
                
                // Double check state inside transaction to prevent overwriting active rounds
                if (sfDoc.exists()) {
                    const data = convertTimestamps(sfDoc.data()) as QuickSyndicateState;
                    // If round is open and time hasn't passed, DO NOT restart
                    if (data.status === 'open' && Date.now() < data.endTime) return; 
                }

                const now = new Date();
                // Set end time to the next hour sharp
                const endTime = new Date(now);
                endTime.setHours(endTime.getHours() + 1, 0, 0, 0);
                
                // Correction: If we are currently at 15:00:01, setHours+1 makes it 16:00:00. 
                // If we are processing a stale round from yesterday, simply set it to 1 hour from NOW.
                if (endTime.getTime() <= Date.now()) {
                     endTime.setTime(Date.now() + 3600000); 
                }

                const newFee = generateHourlyFee();
                const roundId = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;

                const newState: QuickSyndicateState = {
                    roundId: roundId,
                    entryFee: newFee,
                    participants: [],
                    startTime: Date.now(),
                    endTime: endTime.getTime(),
                    status: 'open',
                    lastWinners: sfDoc.exists() ? (convertTimestamps(sfDoc.data()) as QuickSyndicateState).lastWinners : []
                };

                transaction.set(docRef, newState);
            });
            // Reset local trigger after successful transaction attempt
            processingTriggered.current = false;
        } catch (e: any) {
            // Reset local trigger on failure so we can try again
            processingTriggered.current = false;
            if (e.code !== 'failed-precondition' && e.code !== 'aborted') {
                console.error("Transaction failed (Start Round): ", e);
            }
        }
    };

    const processRound = async () => {
        try {
             await runTransaction(db, async (transaction) => {
                // --- READS ---
                const docRef = doc(db, 'public', 'quickSyndicate');
                const sfDoc = await transaction.get(docRef);
                if (!sfDoc.exists()) return;

                const data = convertTimestamps(sfDoc.data()) as QuickSyndicateState;
                
                // CRITICAL CHECK: Only process if status is open.
                if (data.status !== 'open') return; 

                const participants = data.participants;
                const totalCollected = participants.length * data.entryFee;
                
                if (participants.length === 0) {
                    // No one joined, just reset/complete
                    transaction.update(docRef, { status: 'completed' });
                    return;
                }

                // Calculate Logic
                const adminShare = totalCollected * ADMIN_FEE_PERCENTAGE;
                const prizePool = totalCollected - adminShare;
                
                const winnersCount = Math.max(1, Math.floor(participants.length / 2));
                const winAmountPerPerson = prizePool / winnersCount;

                // Shuffle participants for randomness
                const shuffled = [...participants].sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, winnersCount);

                // Prepare reads for winners and treasury
                const treasuryRef = doc(db, 'public', 'treasury');
                const winnerUserRefs = winners.map(w => doc(db, 'users', w.userId));

                // Execute reads for treasury and all winners
                const treasuryDoc = await transaction.get(treasuryRef);
                const userDocs = await Promise.all(winnerUserRefs.map(ref => transaction.get(ref)));

                // --- WRITES ---
                
                // 1. Update Winners Balance & Mailbox
                userDocs.forEach((userDoc, index) => {
                    if (userDoc.exists()) {
                        const userData = convertTimestamps(userDoc.data());
                        const winner = winners[index];
                        const newBalance = (userData.balance || 0) + winAmountPerPerson;
                        transaction.update(userDoc.ref, { balance: newBalance });
                        
                        const mailboxRef = doc(collection(db, 'users', winner.userId, 'mailbox'));
                        transaction.set(mailboxRef, {
                            title: 'مبروك! فوز في الجمعية السريعة',
                            body: `لقد ربحت ${formatNumber(winAmountPerPerson)} 💎 في جولة الساعة.`,
                            type: 'win',
                            isRead: false,
                            timestamp: serverTimestamp()
                        });
                    }
                });

                // 2. Update Treasury with Admin Share
                const treasuryData = treasuryDoc.exists() ? convertTimestamps(treasuryDoc.data()) : { balance: 0 };
                transaction.set(treasuryRef, { 
                    balance: (treasuryData.balance || 0) + adminShare 
                }, { merge: true });

                // 3. Log Profit
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
                
                // 4. Notify Admin (System Notification)
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

                // 5. Update Round State
                transaction.update(docRef, { 
                    status: 'completed',
                    lastWinners: winners.map(w => w.nickname),
                    totalPot: totalCollected
                });
            });
            
            processingTriggered.current = false; // Reset on success

        } catch (e: any) {
            // Suppress contention errors, but allow retry
            const msg = e.message || e.toString();
            if (
                e.code === 'failed-precondition' || 
                e.code === 'aborted' || 
                msg.includes('failed-precondition') ||
                msg.includes('aborted')
            ) {
                console.warn("Round processing handled by another client (contention ignored).");
            } else {
                console.error("Transaction failed (Process Round): ", e);
                // Allow retry in next interval tick
                processingTriggered.current = false; 
            }
        }
    };

    const handleJoin = async () => {
        if (!userProfile || !syndicateState) return;
        
        if (!userProfile.uid) {
            console.error("User Profile UID is missing:", userProfile);
            addToast('حدث خطأ في بيانات حسابك. يرجى إعادة تحميل الصفحة.', 'error');
            return;
        }

        const fee = syndicateState.entryFee;
        const isAlreadyJoined = syndicateState.participants.some(p => p.userId === userProfile.uid);

        if (isAlreadyJoined) {
            addToast('أنت مشترك بالفعل في هذه الجولة.', 'info');
            return;
        }

        if (userProfile.balance < fee) {
            addToast('رصيدك غير كافٍ للاشتراك.', 'error');
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
            
            addToast('تم الاشتراك بنجاح! بالتوفيق.', 'success');
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full text-cyan-400">جاري تحميل بيانات الجمعية...</div>;
    }
    
    // Fail-safe: If state is null for some reason after loading, show error or retry button
    if (!syndicateState) {
        return (
            <div className="flex flex-col justify-center items-center h-full text-cyan-400 gap-4">
                <p>جاري تهيئة الجولة...</p>
                <button onClick={() => startNewRound()} className="px-4 py-2 bg-purple-600 rounded text-white">
                    تحديث يدوي
                </button>
            </div>
        );
    }
    
    const isJoined = userProfile && userProfile.uid && syndicateState.participants.some(p => p.userId === userProfile.uid);
    
    const currentPot = syndicateState.participants.length * syndicateState.entryFee;

    return (
        <div className="flex flex-col h-full relative overflow-hidden">
             <HowToPlay>
                <p>1. هذا النظام هو جمعية تشاركية سريعة تتجدد كل ساعة.</p>
                <p>2. ادفع رسوم الدخول الموضحة للانضمام.</p>
                <p>3. يتم تجميع رسوم جميع المشتركين في "الصندوق الكلي".</p>
                <p>4. عند انتهاء الساعة، يختار النظام عشوائياً 50% من المشتركين ليكونوا الفائزين.</p>
                <p>5. يتم توزيع الصندوق الكلي بالتساوي على الفائزين.</p>
            </HowToPlay>

            {/* Welcome Overlay Message */}
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

            {/* Header */}
            <div className="bg-gray-800/50 p-4 rounded-xl border border-purple-500/30 mb-4 flex justify-between items-center shadow-lg relative overflow-hidden">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                 <div className="flex flex-col z-10">
                     <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">الجمعية السريعة</h2>
                     <span className="text-xs text-gray-400">تتجدد كل ساعة | فائزون 50%</span>
                 </div>
                 <div className="flex flex-col items-end z-10">
                     <span className="text-xs text-gray-400">الوقت المتبقي</span>
                     <span className={`text-2xl font-mono font-bold ${syndicateState.status === 'processing' ? 'text-yellow-400 animate-pulse' : 'text-cyan-400'}`}>
                         {syndicateState.status === 'processing' ? 'جاري الفرز...' : timeLeft}
                     </span>
                 </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-900/60 p-3 rounded-lg border border-gray-700 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-400 mb-1">رسوم الاشتراك (هذه الساعة)</span>
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

            {/* Main Action Area */}
            <div className="flex-grow flex flex-col items-center justify-center relative mb-4">
                <div className="w-48 h-48 rounded-full border-4 border-purple-500/30 flex items-center justify-center relative bg-gray-800/50 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
                    {/* Animated Rings */}
                    <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping"></div>
                    <div className="absolute inset-2 rounded-full border border-purple-500/20 animate-pulse"></div>
                    
                    <div className="text-center z-10">
                        <GlobeNetworkIcon className="w-16 h-16 mx-auto text-cyan-400 mb-2 opacity-80"/>
                        <p className="text-gray-300 font-bold">{syndicateState.participants.length} مشترك</p>
                    </div>
                </div>
            </div>

            {/* Participants Log */}
            <div className="bg-gray-900/80 rounded-t-2xl border-t border-gray-700 flex flex-col flex-grow max-h-[30vh]">
                <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">سجل الحضور</h3>
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">الشفافية 100%</span>
                </div>
                <div className="overflow-y-auto flex-grow p-2 space-y-2">
                    {syndicateState.participants.length === 0 ? (
                        <p className="text-center text-gray-500 py-4 text-sm">كن أول من يشترك في هذه الساعة!</p>
                    ) : (
                        syndicateState.participants.slice().reverse().map((p, i) => (
                            <div key={i} className="flex items-center justify-between bg-gray-800 p-2 rounded-lg animate-fade-in">
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

            {/* Join Button */}
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
                    {syndicateState.status === 'processing' ? 'جاري توزيع الأرباح...' : 
                     isJoined ? '✅ تم الاشتراك' : `دخول الجمعية (${formatNumber(syndicateState.entryFee)})`}
                </button>
                {syndicateState.lastWinners && syndicateState.lastWinners.length > 0 && (
                    <div className="text-center mt-2">
                        <span className="text-xs text-gray-500">آخر الفائزين: </span>
                        <marquee className="text-xs text-yellow-500 inline-block align-bottom max-w-[200px]">{syndicateState.lastWinners.join(' - ')}</marquee>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuickSyndicateGame;
