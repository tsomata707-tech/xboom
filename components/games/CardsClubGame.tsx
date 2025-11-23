
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp, collection, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, CardsClubState, CardData, CardsParticipant } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import { convertTimestamps } from '../utils/convertTimestamps';
import HowToPlay from '../HowToPlay';
import DiamondIcon from '../icons/DiamondIcon';
import Confetti from '../Confetti';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const MAX_PLAYERS = 24;
const GAME_DURATION_MS = 30000; // 30 seconds round
const ENTRY_FEE = 500;
const ADMIN_FEE_PERCENTAGE = 0.15; // 15% House edge

const CardsClubGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<CardsClubState | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('00:00');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    const processingTriggered = useRef(false);

    // --- 1. Initialize & Listen ---
    useEffect(() => {
        const docRef = doc(db, 'public', 'cardsClub');
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as CardsClubState;
                setGameState(data);

                // Check if current user is winner to show confetti
                if (data.status === 'completed' && userProfile) {
                    const isWinner = data.lastWinners.includes(userProfile.displayName || '');
                    if (isWinner) setShowConfetti(true);
                } else {
                    setShowConfetti(false);
                }

            } else {
                initializeGame();
            }
            setLoading(false);
        });

        const interval = setInterval(() => {
            if (!gameState) return;
            
            const now = Date.now();
            const diff = gameState.endTime - now;

            if (diff <= 0) {
                setTimeLeft('00:00');
                if (gameState.status === 'open' && !processingTriggered.current) {
                    processingTriggered.current = true;
                    // Adding random delay to prevent all clients from hitting write at exact same ms
                    setTimeout(() => processRound(), Math.random() * 3000);
                } else if (gameState.status === 'completed' && !processingTriggered.current) {
                     // Restart delay
                     if (diff < -8000) { // Wait 8 seconds after completion before restart
                         processingTriggered.current = true;
                         startNewRound();
                     }
                }
            } else {
                processingTriggered.current = false;
                const seconds = Math.floor((diff / 1000) % 60);
                setTimeLeft(`00:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [gameState, userProfile]);

    // --- 2. Logic ---

    const generateDeck = () => {
        const deck: CardData[] = [];
        for (const suit of SUITS) {
            for (let i = 0; i < RANKS.length; i++) {
                deck.push({ suit, rank: RANKS[i], value: i + 2 });
            }
        }
        return deck;
    };

    const initializeGame = async () => {
        try {
            const docRef = doc(db, 'public', 'cardsClub');
            const newState: CardsClubState = {
                roundId: Date.now().toString(),
                status: 'open',
                participants: [],
                winningCard: null,
                endTime: Date.now() + GAME_DURATION_MS,
                entryFee: ENTRY_FEE,
                lastWinners: []
            };
            await setDoc(docRef, newState);
        } catch (e) {
            console.error("Init failed", e);
        }
    };

    const startNewRound = async () => {
        try {
            const docRef = doc(db, 'public', 'cardsClub');
            await updateDoc(docRef, {
                roundId: Date.now().toString(),
                status: 'open',
                participants: [],
                winningCard: null,
                endTime: Date.now() + GAME_DURATION_MS,
                lastWinners: [] // Optional: Keep last winners or clear
            });
            processingTriggered.current = false;
        } catch (e) {
            console.error("Start round failed", e);
            processingTriggered.current = false;
        }
    };

    const handleJoin = async () => {
        if (!userProfile || !gameState) return;
        if (gameState.participants.length >= MAX_PLAYERS) {
            addToast('اكتمل العدد لهذه الجولة (24 لاعب).', 'error');
            return;
        }
        if (gameState.status !== 'open') {
            addToast('انتظر الجولة القادمة.', 'info');
            return;
        }
        if (gameState.participants.some(p => p.userId === userProfile.uid)) {
            addToast('أنت مشترك بالفعل.', 'info');
            return;
        }
        if (userProfile.balance < gameState.entryFee) {
            addToast('رصيد غير كاف.', 'error');
            return;
        }

        setProcessing(true);
        const success = await onBalanceUpdate(-gameState.entryFee, 'cardsClub');

        if (success) {
            try {
                await runTransaction(db, async (transaction) => {
                    const docRef = doc(db, 'public', 'cardsClub');
                    const sfDoc = await transaction.get(docRef);
                    if (!sfDoc.exists()) throw "Document does not exist!";

                    const data = convertTimestamps(sfDoc.data()) as CardsClubState;
                    if (data.status !== 'open') throw "Game closed";
                    if (data.participants.length >= MAX_PLAYERS) throw "Full";

                    // Assign unique card
                    const deck = generateDeck();
                    const takenCards = new Set(data.participants.map(p => `${p.card.rank}-${p.card.suit}`));
                    
                    // Filter out taken cards
                    const availableCards = deck.filter(c => !takenCards.has(`${c.rank}-${c.suit}`));
                    
                    if (availableCards.length === 0) throw "No cards left"; // Should not happen with 24 limit

                    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
                    
                    const participant: CardsParticipant = {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        avatar: userProfile.photoURL || '👤',
                        card: randomCard,
                        slotIndex: data.participants.length
                    };

                    transaction.update(docRef, {
                        participants: [...data.participants, participant]
                    });
                });
                addToast('تم سحب ورقتك بنجاح!', 'success');
            } catch (e) {
                console.error("Join Transaction failed: ", e);
                
                // Automatic Refund
                await onBalanceUpdate(gameState.entryFee, 'cardsClub');
                
                let errorMsg = 'فشل الانضمام. تم استرجاع الرصيد.';
                if (e === "Game closed") errorMsg = 'انتهت الجولة. تم استرجاع الرصيد.';
                else if (e === "Full") errorMsg = 'اكتمل العدد. تم استرجاع الرصيد.';
                
                addToast(errorMsg, 'error');
            }
        }
        setProcessing(false);
    };

    const processRound = async () => {
        try {
            await runTransaction(db, async (transaction) => {
                const docRef = doc(db, 'public', 'cardsClub');
                const sfDoc = await transaction.get(docRef);
                if (!sfDoc.exists()) return;

                const data = convertTimestamps(sfDoc.data()) as CardsClubState;
                if (data.status !== 'open') return;

                const participants = data.participants;
                if (participants.length === 0) {
                    transaction.update(docRef, { status: 'completed' });
                    return;
                }

                // Pick Winning Card from a fresh deck
                const deck = generateDeck();
                const winningCard = deck[Math.floor(Math.random() * deck.length)];

                // Determine Winners (Same Rank)
                const winners = participants.filter(p => p.card.rank === winningCard.rank);

                // Calculate Pot
                const totalPot = participants.length * data.entryFee;
                const adminShare = Math.floor(totalPot * ADMIN_FEE_PERCENTAGE);
                const prizePool = totalPot - adminShare;
                
                const treasuryRef = doc(db, 'public', 'treasury');
                const treasuryDoc = await transaction.get(treasuryRef);
                const currentTreasury = treasuryDoc.exists() ? treasuryDoc.data().balance || 0 : 0;
                transaction.set(treasuryRef, { balance: currentTreasury + adminShare }, { merge: true });

                if (winners.length > 0) {
                    const winAmount = Math.floor(prizePool / winners.length);
                    
                    // Distribute
                    for (const winner of winners) {
                        const userRef = doc(db, 'users', winner.userId);
                        const userDoc = await transaction.get(userRef);
                        if (userDoc.exists()) {
                            const newBal = (userDoc.data().balance || 0) + winAmount;
                            transaction.update(userRef, { balance: newBal });
                            
                            // Mailbox
                            const mailRef = doc(collection(db, 'users', winner.userId, 'mailbox'));
                            transaction.set(mailRef, {
                                title: 'فوز في الكوتشينة 🃏',
                                body: `ربحت ${formatNumber(winAmount)} 💎! الورقة الرابحة كانت ${winningCard.rank} من أي نوع.`,
                                type: 'win',
                                isRead: false,
                                timestamp: serverTimestamp()
                            });
                        }
                    }
                }

                // Log Profit
                const logRef = doc(collection(db, 'profitLog'));
                transaction.set(logRef, {
                    amount: adminShare,
                    percentage: ADMIN_FEE_PERCENTAGE,
                    gameId: 'cardsClub',
                    userId: 'SYSTEM',
                    userEmail: 'Cards Round ' + data.roundId,
                    originalBet: totalPot,
                    timestamp: serverTimestamp()
                });

                // Update State
                transaction.update(docRef, {
                    status: 'completed',
                    winningCard: winningCard,
                    lastWinners: winners.map(w => w.nickname)
                });
            });
            processingTriggered.current = false;
        } catch (e) {
            console.error("Process Round Failed", e);
            processingTriggered.current = false;
        }
    };

    // --- 3. UI Components ---

    if (loading || !gameState) {
        return <div className="flex justify-center items-center h-full text-cyan-400">جاري تحميل طاولة اللعب...</div>;
    }

    const myParticipant = userProfile ? gameState.participants.find(p => p.userId === userProfile.uid) : null;

    const CardView: React.FC<{ card?: CardData; faceDown?: boolean; highlight?: boolean }> = ({ card, faceDown, highlight }) => {
        if (faceDown || !card) {
            return (
                <div className="w-12 h-16 sm:w-16 sm:h-24 bg-red-800 rounded-lg border-2 border-white flex items-center justify-center shadow-md bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')]">
                    <div className="w-8 h-12 border border-red-600 rounded"></div>
                </div>
            );
        }

        const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'text-red-600' : 'text-black';
        const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit];

        return (
            <div className={`w-12 h-16 sm:w-16 sm:h-24 bg-white rounded-lg flex flex-col items-center justify-between p-1 shadow-md select-none ${highlight ? 'ring-4 ring-yellow-400 scale-110 z-10' : ''}`}>
                <div className={`text-xs sm:text-sm font-bold ${color} self-start`}>{card.rank}</div>
                <div className={`text-xl sm:text-3xl ${color}`}>{suitIcon}</div>
                <div className={`text-xs sm:text-sm font-bold ${color} self-end transform rotate-180`}>{card.rank}</div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#0f3c28] relative overflow-hidden">
             {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
             
             <HowToPlay>
                <p>1. اشترك في الجولة بسحب ورقة عشوائية (500 💎).</p>
                <p>2. الحد الأقصى 24 لاعباً في الجولة.</p>
                <p>3. عند انتهاء الوقت، يسحب النظام "ورقة رابحة" عشوائية من مجموعة جديدة.</p>
                <p>4. إذا كان رقم ورقتك (Rank) يطابق رقم الورقة الرابحة، تفوز!</p>
                <p>5. مثال: الورقة الرابحة "7 بستوني"، كل من يملك رقم "7" (بأي نوع) يربح حصة من الصندوق.</p>
            </HowToPlay>

             {/* Header */}
             <div className="bg-[#0a291b] p-3 border-b border-[#1f5c3f] flex justify-between items-center shadow-lg z-10">
                 <div className="flex flex-col">
                     <span className="text-xs text-green-300">المشاركون</span>
                     <span className="text-white font-bold">{gameState.participants.length}<span className="text-xs text-gray-400">/{MAX_PLAYERS}</span></span>
                 </div>
                 <div className="flex flex-col items-center">
                     <span className="text-xs text-green-300 mb-1">الصندوق الكلي</span>
                     <div className="flex items-center gap-1 bg-black/30 px-3 py-1 rounded-full border border-green-600">
                         <DiamondIcon className="w-4 h-4 text-yellow-400"/>
                         <span className="font-bold text-white">{formatNumber(gameState.participants.length * ENTRY_FEE)}</span>
                     </div>
                 </div>
                 <div className="flex flex-col items-end">
                     <span className="text-xs text-green-300">الوقت</span>
                     <span className={`font-mono font-bold text-lg ${gameState.status === 'completed' ? 'text-yellow-400' : 'text-white'}`}>
                         {gameState.status === 'completed' ? 'انتهى' : timeLeft}
                     </span>
                 </div>
             </div>

             {/* Main Table Area */}
             <div className="flex-grow relative p-4 overflow-y-auto">
                 {/* Table Felt Texture */}
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-50 pointer-events-none"></div>
                 
                 {/* Center: Winning Card Reveal Area */}
                 <div className="flex flex-col items-center justify-center mb-8 min-h-[120px] relative z-10">
                     <div className="mb-2 text-green-200 text-sm font-bold uppercase tracking-widest">
                         {gameState.status === 'completed' ? 'الورقة الرابحة' : 'سحب الورقة الرابحة...'}
                     </div>
                     {gameState.status === 'completed' && gameState.winningCard ? (
                         <div className="animate-bounce-in transform scale-125">
                            <CardView card={gameState.winningCard} highlight />
                         </div>
                     ) : (
                         <div className="w-16 h-24 border-2 border-dashed border-green-500/50 rounded-lg flex items-center justify-center">
                             <span className="text-2xl opacity-50">🃏</span>
                         </div>
                     )}
                     {gameState.status === 'completed' && (
                         <div className="mt-4 text-center">
                             <p className="text-yellow-300 font-bold">الفائزون: {gameState.lastWinners.length > 0 ? gameState.lastWinners.join(', ') : 'لا يوجد فائز'}</p>
                         </div>
                     )}
                 </div>

                 {/* Players Grid */}
                 <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 justify-items-center relative z-10">
                     {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
                         const participant = gameState.participants[i];
                         const isMe = participant?.userId === userProfile?.uid;
                         const isWinner = gameState.status === 'completed' && gameState.winningCard && participant?.card.rank === gameState.winningCard.rank;

                         return (
                             <div key={i} className="relative flex flex-col items-center group">
                                 <div className={`transition-all duration-500 ${isWinner ? 'transform -translate-y-2' : ''}`}>
                                     {participant ? (
                                         // Show card face only to owner OR everyone when round completed
                                         <CardView 
                                            card={participant.card} 
                                            faceDown={!isMe && gameState.status === 'open'} 
                                            highlight={!!isWinner}
                                         />
                                     ) : (
                                         <div className="w-12 h-16 sm:w-16 sm:h-24 rounded-lg border-2 border-green-800/30 bg-green-900/20 flex items-center justify-center">
                                             <span className="text-green-800/50 text-xs">{i+1}</span>
                                         </div>
                                     )}
                                 </div>
                                 
                                 {participant && (
                                     <div className={`mt-1 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold truncate max-w-[60px] text-center shadow-sm ${isMe ? 'bg-yellow-500 text-black' : 'bg-black/40 text-green-100'}`}>
                                         {isMe ? 'أنت' : participant.nickname}
                                     </div>
                                 )}
                             </div>
                         );
                     })}
                 </div>
             </div>

             {/* Controls */}
             <div className="p-4 bg-[#0a291b] border-t border-[#1f5c3f] relative z-20 shadow-lg">
                 {!myParticipant ? (
                     <button
                        onClick={handleJoin}
                        disabled={processing || gameState.status !== 'open'}
                        className={`w-full py-3 rounded-xl font-bold text-xl text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
                            ${gameState.status === 'open' 
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border-b-4 border-green-800' 
                                : 'bg-gray-600 border-b-4 border-gray-800 cursor-not-allowed opacity-70'}
                        `}
                     >
                         {processing ? 'جاري سحب الورقة...' : 
                          gameState.status === 'open' ? 
                          <><span>سحب ورقة</span> <span className="bg-black/20 px-2 rounded text-sm">{ENTRY_FEE} 💎</span></> : 
                          'الجولة مغلقة'}
                     </button>
                 ) : (
                     <div className="w-full py-3 rounded-xl bg-gray-800 border border-gray-600 text-center">
                         <p className="text-gray-400 text-sm">أنت مشارك بورقة:</p>
                         <div className="flex items-center justify-center gap-2 mt-1">
                             <span className={`font-bold text-lg ${(myParticipant.card.suit === 'hearts' || myParticipant.card.suit === 'diamonds') ? 'text-red-500' : 'text-white'}`}>
                                 {myParticipant.card.rank} 
                                 {{ hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[myParticipant.card.suit]}
                             </span>
                         </div>
                         <p className="text-xs text-green-400 mt-1 animate-pulse">حظاً موفقاً!</p>
                     </div>
                 )}
             </div>
        </div>
    );
};

export default CardsClubGame;
