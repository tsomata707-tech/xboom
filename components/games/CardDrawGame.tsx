
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, CardDrawGameState } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { convertTimestamps } from '../utils/convertTimestamps';
import { formatNumber } from '../utils/formatNumber';

interface UserProfile extends AppUser { balance: number; }
interface Props { userProfile: UserProfile | null; onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>; onAnnounceWin: any; }

const SUITS_CONFIG = {
    '♥': { color: 'text-red-600', name: 'hearts' },
    '♦': { color: 'text-red-600', name: 'diamonds' },
    '♣': { color: 'text-gray-900', name: 'clubs' },
    '♠': { color: 'text-gray-900', name: 'spades' }
};

const CardDrawGame: React.FC<Props> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<CardDrawGameState | null>(null);
    const [bet, setBet] = useState(100);
    const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
    const [hasBet, setHasBet] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [resultStatus, setResultStatus] = useState<'win' | 'loss' | null>(null);
    const [isFlipped, setIsFlipped] = useState(false);
    const [payoutProcessed, setPayoutProcessed] = useState(false);
    
    // Critical: Track the last processed round ID to force resets
    const lastRoundIdRef = useRef<number | string>('');

    // Sync with Server
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'public', 'cardDraw'), (s) => {
            if (s.exists()) {
                const data = convertTimestamps(s.data()) as CardDrawGameState;
                setGameState(data);
            }
        });
        return () => unsub();
    }, []);

    // Main Game Loop & State Reset Logic
    useEffect(() => {
        if (!gameState) return;

        // CHECK FOR NEW ROUND: Force reset if round ID has changed
        if (gameState.roundId !== lastRoundIdRef.current) {
            lastRoundIdRef.current = gameState.roundId;
            
            // --- HARD RESET LOCAL STATE ---
            setHasBet(false);           // Re-enable betting buttons
            setSelectedChoice(null);    // Clear previous selection mark
            setResultStatus(null);      // Clear Win/Loss stamp
            setIsFlipped(false);        // Flip card back to face down
            setPayoutProcessed(false);  // Reset payout flag
            setShowConfetti(false);     // Stop confetti
            // Note: We do NOT reset 'bet' (amount), purely for UX convenience
            
            return; // Exit effect to prevent processing result logic on the same render
        }

        // HANDLE RESULT PHASE
        if (gameState.status === 'result' && gameState.result && !payoutProcessed) {
            // 1. Trigger Animation
            setIsFlipped(true);

            // 2. Process Result (Only if user bet in this round)
            if (hasBet && selectedChoice) {
                const actualSuit = gameState.result.suit;
                const actualColor = (actualSuit === '♥' || actualSuit === '♦') ? 'red' : 'black';
                
                let won = false;
                let multiplier = 0;

                if (selectedChoice === 'red' || selectedChoice === 'black') {
                    if (selectedChoice === actualColor) {
                        won = true;
                        multiplier = 2;
                    }
                } else {
                    if (selectedChoice === actualSuit) {
                        won = true;
                        multiplier = 4;
                    }
                }

                setPayoutProcessed(true); // Lock processing

                // Delay showing result stamp to match flip animation
                setTimeout(() => {
                    if (won) {
                        const winnings = bet * multiplier;
                        onBalanceUpdate(winnings, 'cardDraw');
                        setResultStatus('win');
                        setShowConfetti(true);
                        addToast(`مبروك! ربحت ${formatNumber(winnings)} 💎`, 'success');
                        if (winnings > 10000 && userProfile?.displayName) {
                            onAnnounceWin(userProfile.displayName, winnings, 'cardDraw');
                        }
                    } else {
                        setResultStatus('loss');
                        addToast('حظ أوفر في المرة القادمة', 'error');
                    }
                }, 600);
            }
        }
    }, [gameState, hasBet, selectedChoice, bet, payoutProcessed, userProfile, onBalanceUpdate, onAnnounceWin]);

    const handleBet = async (choice: string) => {
        if (!userProfile || !gameState || gameState.status !== 'betting') return;
        
        if (hasBet) {
            addToast('لقد قمت بالرهان بالفعل', 'info');
            return;
        }

        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }

        // Optimistic UI update
        const success = await onBalanceUpdate(-bet, 'cardDraw');
        if (success) {
            setSelectedChoice(choice);
            setHasBet(true); // This disables the controls
            addToast('تم تسجيل الرهان', 'success');

            try {
                // Sync with Server
                await runTransaction(db, async (transaction) => {
                    const gameRef = doc(db, 'public', 'cardDraw');
                    const sfDoc = await transaction.get(gameRef);
                    if (!sfDoc.exists()) return;

                    const currentData = sfDoc.data() as CardDrawGameState;
                    if (currentData.status !== 'betting') throw "Game Closed";

                    const bets = currentData.bets || {};
                    bets[userProfile.uid] = {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        bets: { [choice]: bet }
                    };
                    
                    transaction.update(gameRef, { bets: bets });
                });
            } catch (e) {
                console.error("Bet sync error:", e);
            }
        }
    };

    const resultCard = gameState?.result || { suit: '♠', value: 'A' };
    const cardConfig = SUITS_CONFIG[resultCard.suit as keyof typeof SUITS_CONFIG] || SUITS_CONFIG['♠'];
    const participantsCount = gameState?.bets ? Object.keys(gameState.bets).length : 0;

    // Helper to determine if controls should be interactive
    const isControlsDisabled = hasBet || gameState?.status !== 'betting';

    return (
        <div className="flex flex-col items-center justify-between h-full p-4 relative overflow-hidden">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Header Status */}
            <div className="w-full flex justify-between items-center mb-4 z-10 px-2">
                <div className="bg-black/40 px-3 py-1 rounded-full text-xs text-gray-300">
                    👥 {participantsCount} لاعبين
                </div>
                <div className={`px-6 py-2 rounded-full font-bold text-lg shadow-lg border-2 transition-colors duration-300
                    ${gameState?.status === 'betting' ? 'bg-green-900/80 border-green-500 text-green-300' : 
                      gameState?.status === 'drawing' ? 'bg-yellow-900/80 border-yellow-500 text-yellow-300' : 
                      'bg-gray-800 border-gray-500 text-white'}
                `}>
                    {gameState?.status === 'betting' ? 'اختر وتوقع ⏱️' : 
                     gameState?.status === 'drawing' ? 'جاري السحب... 🃏' : 'النتيجة ✨'}
                </div>
                <div className="w-16"></div>
            </div>

            {/* 3D Card Area */}
            <div className="flex-grow flex items-center justify-center perspective-1000 w-full mb-4">
                <div className={`relative w-56 h-80 transition-transform duration-1000 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* Back of Card (Face Down) */}
                    <div className="absolute inset-0 w-full h-full backface-hidden rounded-2xl border-4 border-white shadow-2xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center overflow-hidden">
                        {/* Pattern */}
                        <div className="absolute inset-0 opacity-20" style={{
                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #ffffff 10px, #ffffff 12px)',
                        }}></div>
                        <div className="w-24 h-24 rounded-full border-4 border-yellow-500 flex items-center justify-center bg-blue-950 shadow-inner z-10">
                            <span className="text-5xl">🃏</span>
                        </div>
                    </div>

                    {/* Front of Card (Face Up) */}
                    <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl bg-white border-4 border-gray-300 shadow-2xl flex flex-col p-4 justify-between">
                        <div className={`flex flex-col items-center self-start ${cardConfig.color}`}>
                            <span className="text-4xl font-black leading-none">{resultCard.value}</span>
                            <span className="text-3xl leading-none">{resultCard.suit}</span>
                        </div>

                        <div className={`absolute inset-0 flex items-center justify-center ${cardConfig.color} opacity-20`}>
                            <span className="text-[10rem]">{resultCard.suit}</span>
                        </div>

                        <div className={`flex flex-col items-center self-end transform rotate-180 ${cardConfig.color}`}>
                            <span className="text-4xl font-black leading-none">{resultCard.value}</span>
                            <span className="text-3xl leading-none">{resultCard.suit}</span>
                        </div>

                        {/* STAMP OVERLAY */}
                        {resultStatus && isFlipped && (
                            <div className="absolute inset-0 flex items-center justify-center z-50 animate-stamp-in pointer-events-none">
                                <div className={`
                                    border-[6px] border-double rounded-xl px-8 py-4 transform -rotate-12 
                                    text-5xl font-black tracking-widest uppercase backdrop-blur-sm shadow-2xl
                                    ${resultStatus === 'win' 
                                        ? 'border-green-600 text-green-600 bg-green-100/90' 
                                        : 'border-red-600 text-red-600 bg-red-100/90'}
                                `}>
                                    {resultStatus === 'win' ? 'WIN' : 'LOSS'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="w-full max-w-md z-20 bg-gray-900/90 p-4 rounded-xl border-t border-gray-700 backdrop-blur-md shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {Object.keys(SUITS_CONFIG).map((suit) => (
                        <button
                            key={suit}
                            onClick={() => handleBet(suit)}
                            disabled={isControlsDisabled}
                            className={`aspect-square rounded-xl text-3xl flex items-center justify-center border-2 transition-all duration-200
                                ${SUITS_CONFIG[suit as keyof typeof SUITS_CONFIG].color === 'text-red-600' ? 'bg-red-50' : 'bg-gray-100'}
                                ${selectedChoice === suit 
                                    ? 'ring-4 ring-yellow-400 scale-105 shadow-lg border-yellow-500 z-10' 
                                    : 'border-gray-400 hover:scale-105'}
                                ${isControlsDisabled && selectedChoice !== suit ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                            `}
                        >
                            <span className={SUITS_CONFIG[suit as keyof typeof SUITS_CONFIG].color}>{suit}</span>
                        </button>
                    ))}
                </div>
                
                <div className="flex gap-3 mb-4">
                    <button 
                        onClick={() => handleBet('red')}
                        disabled={isControlsDisabled}
                        className={`flex-1 py-3 rounded-xl font-bold text-white bg-red-600 border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all
                            ${selectedChoice === 'red' ? 'ring-4 ring-yellow-400 scale-105' : ''} 
                            ${isControlsDisabled && selectedChoice !== 'red' ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        أحمر (x2)
                    </button>
                    <button 
                        onClick={() => handleBet('black')}
                        disabled={isControlsDisabled}
                        className={`flex-1 py-3 rounded-xl font-bold text-white bg-gray-900 border-b-4 border-black active:border-b-0 active:translate-y-1 transition-all
                            ${selectedChoice === 'black' ? 'ring-4 ring-yellow-400 scale-105' : ''} 
                            ${isControlsDisabled && selectedChoice !== 'black' ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        أسود (x2)
                    </button>
                </div>

                <BetControls 
                    bet={bet} 
                    setBet={setBet} 
                    balance={userProfile?.balance ?? 0} 
                    disabled={isControlsDisabled} 
                />
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
                
                @keyframes stamp-in {
                    0% { transform: scale(3) rotate(-30deg); opacity: 0; }
                    100% { transform: scale(1) rotate(-12deg); opacity: 1; }
                }
                .animate-stamp-in {
                    animation: stamp-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
            `}</style>
        </div>
    );
};

export default CardDrawGame;
