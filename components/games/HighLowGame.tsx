
import React, { useState, useCallback, useMemo } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface HighLowGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CARD_VALUE_MAP: { [key: string]: number } = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

type Card = { suit: string; value: string; display: string; numericValue: number };

const createDeck = (): Card[] => {
    return SUITS.flatMap(suit =>
        VALUES.map(value => ({
            suit,
            value,
            display: `${value}${suit}`,
            numericValue: CARD_VALUE_MAP[value],
        }))
    );
};

const shuffleDeck = (deck: Card[]): Card[] => {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
};

const CardComponent: React.FC<{ card: Card | null; isFlipped: boolean }> = ({ card, isFlipped }) => {
    const suitColor = card && (card.suit === '♥' || card.suit === '♦') ? 'text-red-500' : 'text-black';
    return (
        <div className="w-32 h-48 sm:w-40 sm:h-60 perspective-1000">
            <div className={`relative w-full h-full transform-style-3d transition-transform duration-700 ${isFlipped ? 'rotate-y-180' : ''}`}>
                {/* Back */}
                <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-blue-700 to-blue-900 rounded-xl border-2 border-blue-400 flex items-center justify-center">
                    <span className="text-5xl text-blue-200">?</span>
                </div>
                {/* Front */}
                <div className={`absolute w-full h-full backface-hidden bg-white rounded-xl border border-gray-300 rotate-y-180 p-2 flex flex-col justify-between ${suitColor}`}>
                    <div className="text-left text-2xl font-bold">{card?.display}</div>
                    <div className="text-center text-6xl">{card?.suit}</div>
                    <div className="text-right text-2xl font-bold transform rotate-180">{card?.display}</div>
                </div>
            </div>
        </div>
    );
};

const HighLowGame: React.FC<HighLowGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [deck, setDeck] = useState<Card[]>([]);
    const [currentCard, setCurrentCard] = useState<Card | null>(null);
    const [nextCard, setNextCard] = useState<Card | null>(null);
    const [gameState, setGameState] = useState<'betting' | 'playing' | 'lost'>('betting');
    const [streak, setStreak] = useState(0);
    const [winnings, setWinnings] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    const potentialWinnings = useMemo(() => {
        if (gameState !== 'playing') return 0;
        // Simplified multiplier for demonstration
        return bet * (1 + streak * 0.5);
    }, [bet, streak, gameState]);

    const handleStart = async () => {
        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'highLow');
        if (!success) return;

        const newDeck = shuffleDeck(createDeck());
        setCurrentCard(newDeck.pop()!);
        setNextCard(null);
        setDeck(newDeck);
        setGameState('playing');
        setStreak(0);
        setWinnings(0);
    };

    const handleGuess = (guess: 'high' | 'low') => {
        if (gameState !== 'playing' || deck.length === 0) return;
        
        const nextDrawnCard = deck.pop()!;
        setNextCard(nextDrawnCard);

        setTimeout(() => {
            const currentVal = currentCard!.numericValue;
            const nextVal = nextDrawnCard.numericValue;

            if (nextVal === currentVal) { // Push
                addToast('تعادل! تستمر السلسلة.', 'info');
                setCurrentCard(nextDrawnCard);
                setNextCard(null);
                setStreak(prev => prev + 1);
                return;
            }

            const isCorrect = (guess === 'high' && nextVal > currentVal) || (guess === 'low' && nextVal < currentVal);

            if (isCorrect) {
                addToast('تخمين صحيح!', 'success');
                setCurrentCard(nextDrawnCard);
                setNextCard(null);
                setStreak(prev => prev + 1);
            } else {
                addToast('لقد خسرت! حظ أفضل في المرة القادمة.', 'error');
                setGameState('lost');
            }
        }, 1000); // Wait for card flip animation
    };

    const handleCashOut = async () => {
        if (gameState !== 'playing' || streak === 0) return;
        
        const finalWinnings = potentialWinnings;
        const success = await onBalanceUpdate(finalWinnings, 'highLow');
        if (success) {
            setWinnings(finalWinnings);
            addToast(`لقد ربحت ${formatNumber(finalWinnings)} 💎!`, 'success');
            if (finalWinnings > 10000 && userProfile?.displayName) {
                onAnnounceWin(userProfile.displayName, finalWinnings, 'highLow');
            }
            if (finalWinnings > bet * 5) {
                setShowConfetti(true);
            }
        }
        setGameState('betting');
    };

    const handleReset = () => {
        setGameState('betting');
        setCurrentCard(null);
        setNextCard(null);
    };

    return (
        <div className="flex flex-col items-center justify-around h-full p-4 relative">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <HowToPlay>
                <p>1. ضع رهانك واضغط على "بدء اللعبة".</p>
                <p>2. ستظهر لك بطاقة مكشوفة.</p>
                <p>3. خمن ما إذا كانت البطاقة التالية ستكون <strong>أعلى (▲)</strong> أو <strong>أدنى (▼)</strong> في القيمة.</p>
                <p>4. كلما زاد عدد التخمينات الصحيحة المتتالية، تضاعفت أرباحك.</p>
                <p>5. يمكنك الضغط على "سحب الأرباح" في أي وقت للاحتفاظ بما كسبته.</p>
                <p>6. إذا أخطأت في التخمين، تخسر كل شيء.</p>
            </HowToPlay>

            <div className="flex items-center justify-center gap-4 sm:gap-8 my-4">
                <CardComponent card={currentCard} isFlipped={!!currentCard} />
                <span className="text-4xl font-bold text-gray-400">vs</span>
                <CardComponent card={nextCard} isFlipped={!!nextCard} />
            </div>

            <div className="h-10 text-xl font-bold text-center">
                {gameState === 'playing' && `الأرباح المحتملة: ${formatNumber(potentialWinnings)} 💎 (x${(1 + streak * 0.5).toFixed(2)})`}
                {gameState === 'lost' && <span className="text-red-500">لقد خسرت رهانك!</span>}
                {gameState === 'betting' && winnings > 0 && <span className="text-green-400">لقد ربحت {formatNumber(winnings)} 💎!</span>}
            </div>

            {gameState === 'betting' && (
                <div className="flex flex-col items-center gap-4 game-container-animation">
                    <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} />
                    <button onClick={handleStart} className="w-full max-w-sm py-3 mt-4 text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105">
                        بدء اللعبة
                    </button>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="w-full max-w-md flex flex-col items-center gap-4 game-container-animation">
                    <div className="flex gap-4 w-full">
                        <button onClick={() => handleGuess('low')} disabled={!!nextCard} className="flex-1 py-4 text-2xl font-bold rounded-lg bg-red-600 hover:bg-red-500 transition disabled:opacity-50">
                            أدنى ▼
                        </button>
                        <button onClick={() => handleGuess('high')} disabled={!!nextCard} className="flex-1 py-4 text-2xl font-bold rounded-lg bg-green-600 hover:bg-green-500 transition disabled:opacity-50">
                            أعلى ▲
                        </button>
                    </div>
                    <button onClick={handleCashOut} disabled={streak === 0 || !!nextCard} className="w-full py-3 text-xl font-bold rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black transition disabled:opacity-50">
                        سحب الأرباح
                    </button>
                </div>
            )}

            {gameState === 'lost' && (
                <div className="game-container-animation">
                    <button onClick={handleReset} className="w-full max-w-sm py-3 mt-4 text-xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white hover:opacity-90 transition">
                        اللعب مرة أخرى
                    </button>
                </div>
            )}
        </div>
    );
};

export default HighLowGame;
