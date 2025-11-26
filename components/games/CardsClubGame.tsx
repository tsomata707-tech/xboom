
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, runTransaction, updateDoc, arrayUnion } from 'firebase/firestore';
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

const MAX_PLAYERS = 24;

const CardsClubGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<CardsClubState | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('00:00');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

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
                } else if (data.status === 'open') {
                    setShowConfetti(false);
                }
            }
            setLoading(false);
        });

        const interval = setInterval(() => {
            if (!gameState) return;
            
            const now = Date.now();
            const diff = gameState.endTime - now;

            if (diff <= 0) {
                setTimeLeft('00:00');
            } else {
                const seconds = Math.floor((diff / 1000) % 60);
                setTimeLeft(`00:${seconds.toString().padStart(2, '0')}`);
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [gameState, userProfile]);

    // --- 2. Logic ---

    const generateDeck = () => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck: CardData[] = [];
        for (const suit of suits) {
            for (let i = 0; i < ranks.length; i++) {
                deck.push({ suit, rank: ranks[i], value: i + 2 });
            }
        }
        return deck;
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
                    
                    if (availableCards.length === 0) throw "No cards left";

                    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
                    
                    const participant: CardsParticipant = {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        avatar: userProfile.photoURL || '👤',
                        card: randomCard,
                        slotIndex: data.participants.length
                    };

                    transaction.update(docRef, {
                        participants: arrayUnion(participant)
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

    // --- 3. UI Components ---

    if (loading || !gameState) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px] text-cyan-400">
                <div className="animate-spin text-4xl mr-2">♠️</div>
                جاري تحميل طاولة اللعب...
            </div>
        );
    }

    const myParticipant = userProfile ? gameState.participants.find(p => p.userId === userProfile.uid) : null;

    const CardView: React.FC<{ card?: CardData; faceDown?: boolean; highlight?: boolean; scale?: number }> = ({ card, faceDown, highlight, scale = 1 }) => {
        if (faceDown || !card) {
            return (
                <div 
                    className="bg-red-900 rounded-lg border border-yellow-600/50 flex items-center justify-center shadow-xl relative overflow-hidden backface-hidden transform transition-all duration-500"
                    style={{ width: `${60 * scale}px`, height: `${84 * scale}px` }}
                >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-30"></div>
                    <div className="w-[90%] h-[90%] border border-yellow-500/20 rounded-md"></div>
                    <div className="text-yellow-500/20 text-2xl">♠️</div>
                </div>
            );
        }

        const isRed = (card.suit === 'hearts' || card.suit === 'diamonds');
        const colorClass = isRed ? 'text-red-600' : 'text-black';
        const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit];

        return (
            <div 
                className={`bg-white rounded-lg flex flex-col items-center justify-between p-1 shadow-xl select-none border border-gray-300 transform transition-all duration-500
                    ${highlight ? 'ring-4 ring-yellow-400 scale-110 z-20 shadow-[0_0_20px_gold]' : ''}
                `}
                style={{ width: `${60 * scale}px`, height: `${84 * scale}px` }}
            >
                <div className={`text-[10px] font-bold ${colorClass} self-start leading-none`}>{card.rank}</div>
                <div className={`text-2xl ${colorClass} flex-grow flex items-center`}>{suitIcon}</div>
                <div className={`text-[10px] font-bold ${colorClass} self-end transform rotate-180 leading-none`}>{card.rank}</div>
            </div>
        );
    };

    // Filter other participants to show in the circle
    const otherParticipants = gameState.participants.filter(p => p.userId !== userProfile?.uid);

    return (
        <div className="flex flex-col w-full min-h-[85vh] bg-[#1b4d3e] relative overflow-hidden font-sans">
             {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
             
             <HowToPlay>
                <p>1. اشترك في الجولة بسحب ورقة عشوائية (500 💎).</p>
                <p>2. الحد الأقصى 24 لاعباً في الجولة.</p>
                <p>3. عند انتهاء الوقت، يسحب النظام "ورقة رابحة" عشوائية.</p>
                <p>4. إذا كان رقم ورقتك (Rank) يطابق رقم الورقة الرابحة، تفوز!</p>
                <p>5. الجوائز توزع بالتساوي على جميع الفائزين.</p>
            </HowToPlay>

             {/* Top Stats Bar */}
             <div className="w-full p-3 flex justify-between items-start z-30 bg-gradient-to-b from-black/60 to-transparent">
                 <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-1 border border-green-500/30 flex items-center gap-2">
                     <span className="text-xs text-green-300 uppercase font-bold">اللاعبين</span>
                     <span className="text-white font-bold">{gameState.participants.length}/24</span>
                 </div>
                 
                 <div className="flex flex-col items-center">
                     <div className={`px-4 py-1 rounded-full border backdrop-blur-md font-mono font-bold text-lg shadow-lg
                        ${gameState.status === 'revealing' ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 animate-pulse' : 
                          gameState.status === 'completed' ? 'bg-red-500/20 border-red-400 text-red-300' :
                          'bg-black/40 border-green-500/30 text-white'}
                     `}>
                         {gameState.status === 'revealing' ? 'كشف النتائج' : gameState.status === 'completed' ? 'انتهى' : timeLeft}
                     </div>
                     <p className="text-[10px] text-gray-300 mt-1 uppercase tracking-wider">
                        {gameState.status === 'open' ? 'وقت الرهان' : gameState.status === 'revealing' ? 'جاري السحب' : 'توزيع الجوائز'}
                     </p>
                 </div>

                 <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-1 border border-green-500/30 flex items-center gap-2">
                     <span className="text-xs text-green-300 uppercase font-bold">الجائزة</span>
                     <div className="flex items-center gap-1">
                         <span className="text-white font-bold">{formatNumber(gameState.participants.length * gameState.entryFee)}</span>
                         <DiamondIcon className="w-3 h-3 text-yellow-400"/>
                     </div>
                 </div>
             </div>

             {/* Main Game Area (Table) */}
             <div className="flex-grow relative flex items-center justify-center perspective-1000 overflow-visible my-4">
                 
                 {/* Table Surface */}
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-[600px] aspect-square sm:aspect-video rounded-full bg-gradient-to-br from-[#235c4b] to-[#0f2b20] shadow-[0_0_50px_rgba(0,0,0,0.8)] border-[12px] border-[#3d2b1f] z-0">
                    <div className="absolute inset-0 rounded-full border-4 border-black/20"></div>
                    {/* Center Logo/Decor */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-white/5 flex items-center justify-center opacity-30">
                        <span className="text-4xl">♣️</span>
                    </div>
                 </div>

                 {/* Winning Card Area (Center) */}
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center">
                     <div className={`transition-all duration-700 transform ${gameState.status === 'revealing' ? 'scale-125' : 'scale-100'}`}>
                         <CardView 
                            card={gameState.winningCard || undefined} 
                            faceDown={gameState.status === 'open'} 
                            highlight={gameState.status === 'completed'}
                            scale={1.8}
                         />
                     </div>
                     {gameState.status === 'open' && (
                         <p className="mt-4 text-green-200/50 text-xs font-bold tracking-widest uppercase animate-pulse">Deck</p>
                     )}
                 </div>

                 {/* Other Participants (Circle) */}
                 {otherParticipants.map((p, i) => {
                     const total = otherParticipants.length;
                     const angle = (i / total) * 2 * Math.PI - Math.PI / 2; // Start from top
                     const radius = 42; // Percentage
                     const x = 50 + radius * Math.cos(angle);
                     const y = 50 + radius * Math.sin(angle);
                     
                     const isWinner = gameState.status === 'completed' && gameState.winningCard && p.card.rank === gameState.winningCard.rank;

                     return (
                         <div 
                            key={p.userId}
                            className="absolute z-10 transition-all duration-500"
                            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                         >
                             <div className="flex flex-col items-center gap-1">
                                 <div className={`relative transition-transform ${isWinner ? 'scale-125 z-30' : 'scale-75'}`}>
                                     <CardView 
                                        card={p.card} 
                                        faceDown={gameState.status === 'open'} 
                                        highlight={!!isWinner}
                                        scale={0.6}
                                     />
                                     {isWinner && <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl animate-bounce">👑</div>}
                                 </div>
                                 <div className="bg-black/50 text-white text-[8px] px-1 rounded-full truncate max-w-[50px]">
                                     {p.nickname}
                                 </div>
                             </div>
                         </div>
                     );
                 })}
             </div>

             {/* Bottom User Area */}
             <div className="w-full bg-black/80 p-4 z-40 border-t border-white/10 backdrop-blur-lg flex flex-col items-center justify-center min-h-[120px]">
                 {gameState.status === 'completed' && (
                     <div className="absolute -top-10 bg-yellow-500 text-black font-bold px-4 py-1 rounded-full shadow-lg animate-bounce">
                         {gameState.lastWinners.length > 0 
                            ? `الفائزون: ${gameState.lastWinners.length}` 
                            : 'لم يفز أحد هذه الجولة'}
                     </div>
                 )}

                 {!myParticipant ? (
                     <button
                        onClick={handleJoin}
                        disabled={processing || gameState.status !== 'open'}
                        className={`w-full max-w-sm py-3 rounded-xl font-black text-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-all transform active:scale-95 flex items-center justify-center gap-3
                            ${gameState.status === 'open' 
                                ? 'bg-gradient-to-r from-yellow-600 to-yellow-400 text-black hover:brightness-110' 
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
                        `}
                     >
                         {processing ? 'جاري الانضمام...' : 
                          gameState.status === 'open' ? 
                          <>
                            <span>سحب ورقة</span>
                            <span className="bg-black/20 px-3 py-0.5 rounded-lg text-sm text-white font-mono">{gameState.entryFee} 💎</span>
                          </> : 
                          'الجولة مغلقة - انتظر التالي'}
                     </button>
                 ) : (
                     <div className="flex items-center gap-6 animate-slide-up">
                         <div className="text-right">
                             <p className="text-green-400 text-xs font-bold uppercase mb-1">ورقتك</p>
                             <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden border border-white/20">
                                     {userProfile?.photoURL?.startsWith('http') 
                                        ? <img src={userProfile.photoURL} className="w-full h-full object-cover"/> 
                                        : <div className="w-full h-full flex items-center justify-center text-xs">{userProfile?.photoURL}</div>}
                                 </div>
                                 <span className="text-white font-bold text-sm">{userProfile?.displayName}</span>
                             </div>
                         </div>
                         
                         {/* My Card Big Display */}
                         <div className="transform scale-125 origin-bottom">
                             <CardView 
                                card={myParticipant.card} 
                                highlight={gameState.status === 'completed' && gameState.winningCard?.rank === myParticipant.card.rank}
                                scale={1.2}
                             />
                         </div>

                         <div className="text-left">
                             <p className="text-gray-400 text-xs font-bold uppercase mb-1">الحالة</p>
                             {gameState.status === 'completed' ? (
                                 gameState.winningCard?.rank === myParticipant.card.rank 
                                    ? <span className="text-green-400 font-black text-lg animate-pulse">فوز! 🏆</span>
                                    : <span className="text-red-400 font-bold">خسارة</span>
                             ) : (
                                 <span className="text-yellow-400 font-bold animate-pulse">في اللعب...</span>
                             )}
                         </div>
                     </div>
                 )}
             </div>
        </div>
    );
};

export default CardsClubGame;
