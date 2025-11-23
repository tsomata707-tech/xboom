
import React, { useState, useCallback, useMemo } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import { useGameLoop } from '../hooks/useGameLoop';
import GameTimerDisplay from '../GameTimerDisplay';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface CardDrawGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const SUITS = { '♥': 'red', '♦': 'red', '♣': 'black', '♠': 'black' };
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const BET_TYPES = {
    color: { multiplier: 2, options: ['red', 'black'] },
    suit: { multiplier: 4, options: ['♥', '♦', '♣', '♠'] }
};

type BetType = 'red' | 'black' | '♥' | '♦' | '♣' | '♠';
type Bets = { [key in BetType]?: number };

const CardDrawGame: React.FC<CardDrawGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bets, setBets] = useState<Bets>({});
    const [betAmount, setBetAmount] = useState(100);
    const [drawnCard, setDrawnCard] = useState<{ value: string, suit: keyof typeof SUITS } | null>(null);
    const [winnings, setWinnings] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    // FIX: The type of `val` was being inferred as `unknown`. Using `Number(val)` ensures it is treated as a number for the addition.
    const totalBet = useMemo(() => Object.values(bets).reduce((sum: number, val) => sum + (Number(val) || 0), 0), [bets]);

    const handleRoundStart = async () => {
        if (totalBet === 0) return;
        if (!userProfile || totalBet > userProfile.balance) {
            addToast("رصيدك غير كافٍ.", "error");
            return;
        }

        const success = await onBalanceUpdate(-totalBet, 'cardDraw');
        if (!success) return;

        const randomSuit = Object.keys(SUITS)[Math.floor(Math.random() * 4)] as keyof typeof SUITS;
        const randomValue = VALUES[Math.floor(Math.random() * VALUES.length)];
        const card = { value: randomValue, suit: randomSuit };
        setDrawnCard(card);

        const cardColor = SUITS[card.suit];
        let winAmount = 0;
        if (bets[cardColor]) {
            winAmount += bets[cardColor]! * BET_TYPES.color.multiplier;
        }
        if (bets[card.suit]) {
            winAmount += bets[card.suit]! * BET_TYPES.suit.multiplier;
        }
        
        setWinnings(winAmount);

        if (winAmount > 0) {
            onBalanceUpdate(winAmount, 'cardDraw');
            addToast(`لقد ربحت ${formatNumber(winAmount)} 💎!`, 'success');
            if (winAmount > 10000 && userProfile.displayName) {
                onAnnounceWin(userProfile.displayName, winAmount, 'cardDraw');
            }
             if (winAmount > totalBet * 5) {
                setShowConfetti(true);
            }
        }
    };

    const resetGame = useCallback(() => {
        setBets({});
        setDrawnCard(null);
        setWinnings(0);
        setShowConfetti(false);
    }, []);

    const { phase, timeRemaining, totalTime } = useGameLoop({
        onRoundStart: handleRoundStart,
        onRoundEnd: resetGame,
    }, { preparationTime: 12, gameTime: 3, resultsTime: 5 });

    const placeBet = (type: BetType) => {
        setBets(prev => ({
            ...prev,
            [type]: (prev[type] || 0) + betAmount
        }));
    };
    
    const controlsDisabled = phase !== 'preparing';
    
    return (
        <div className="flex flex-col items-center justify-between h-full p-4 relative">
            {showConfetti && <Confetti onComplete={() => {}} />}
            
            <HowToPlay>
                 <p>1. حدد قيمة الرهان في الأسفل.</p>
                 <p>2. اضغط على الخيارات للمراهنة عليها:</p>
                 <ul className="list-disc list-inside pr-4">
                     <li><strong>اللون:</strong> (أحمر أو أسود) يضاعف رهانك مرتين (x2).</li>
                     <li><strong>الشكل:</strong> (قلب، بستوني، ديناري، سباتي) يضاعف رهانك 4 مرات (x4).</li>
                 </ul>
                 <p>3. يمكنك وضع رهانات متعددة في نفس الجولة.</p>
                 <p>4. انتظر سحب البطاقة لترى النتيجة!</p>
            </HowToPlay>

            <GameTimerDisplay phase={phase} timeRemaining={timeRemaining} totalTime={totalTime} />

            <div className="flex-grow w-full flex items-center justify-center my-4">
                <div className={`w-40 h-60 sm:w-48 sm:h-72 rounded-xl transition-all duration-500 transform
                    ${drawnCard ? 'rotate-y-180' : 'rotate-y-0'} transform-style-3d`}>
                    <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-purple-700 to-indigo-900 rounded-xl border-2 border-purple-400 flex items-center justify-center">
                        <span className="text-6xl text-purple-200">🎴</span>
                    </div>
                    {drawnCard && (
                         <div className={`absolute w-full h-full backface-hidden bg-white rounded-xl border border-gray-300 rotate-y-180 p-2 flex flex-col justify-between ${SUITS[drawnCard.suit] === 'red' ? 'text-red-500' : 'text-black'}`}>
                             <div className="text-left text-3xl font-bold">{drawnCard.value}{drawnCard.suit}</div>
                             <div className="text-center text-7xl">{drawnCard.suit}</div>
                             <div className="text-right text-3xl font-bold transform rotate-180">{drawnCard.value}{drawnCard.suit}</div>
                         </div>
                    )}
                </div>
            </div>

            <div className="h-8 text-xl font-bold text-center mt-2 game-container-animation">
                {phase === 'results' && winnings > 0 && <span className="text-green-400">🎉 لقد ربحت ${formatNumber(winnings)} 💎!</span>}
                {phase === 'results' && winnings === 0 && <span className="text-red-500">حظ أفضل في المرة القادمة!</span>}
            </div>

            <div className="w-full max-w-2xl bg-gray-900/50 p-3 rounded-2xl border border-gray-700 mt-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <button onClick={() => placeBet('red')} disabled={controlsDisabled} className="py-4 font-bold text-xl bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-50 relative">أحمر (2x) {bets.red && <span className="absolute bottom-1 right-2 text-xs bg-black/50 px-2 rounded-full">{formatNumber(bets.red)}</span>}</button>
                    <button onClick={() => placeBet('black')} disabled={controlsDisabled} className="py-4 font-bold text-xl bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 relative">أسود (2x) {bets.black && <span className="absolute bottom-1 right-2 text-xs bg-black/50 px-2 rounded-full">{formatNumber(bets.black)}</span>}</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                     <button onClick={() => placeBet('♥')} disabled={controlsDisabled} className="py-3 font-bold text-2xl text-red-500 bg-white rounded-lg hover:bg-gray-200 disabled:opacity-50 relative">♥ {bets['♥'] && <span className="absolute bottom-1 right-1 text-xs bg-black/50 text-white px-1 rounded-full">{formatNumber(bets['♥'])}</span>}</button>
                     <button onClick={() => placeBet('♦')} disabled={controlsDisabled} className="py-3 font-bold text-2xl text-red-500 bg-white rounded-lg hover:bg-gray-200 disabled:opacity-50 relative">♦ {bets['♦'] && <span className="absolute bottom-1 right-1 text-xs bg-black/50 text-white px-1 rounded-full">{formatNumber(bets['♦'])}</span>}</button>
                     <button onClick={() => placeBet('♣')} disabled={controlsDisabled} className="py-3 font-bold text-2xl text-black bg-white rounded-lg hover:bg-gray-200 disabled:opacity-50 relative">♣ {bets['♣'] && <span className="absolute bottom-1 right-1 text-xs bg-black/50 text-white px-1 rounded-full">{formatNumber(bets['♣'])}</span>}</button>
                     <button onClick={() => placeBet('♠')} disabled={controlsDisabled} className="py-3 font-bold text-2xl text-black bg-white rounded-lg hover:bg-gray-200 disabled:opacity-50 relative">♠ {bets['♠'] && <span className="absolute bottom-1 right-1 text-xs bg-black/50 text-white px-1 rounded-full">{formatNumber(bets['♠'])}</span>}</button>
                </div>
                 <div className="flex gap-2 mt-3">
                    <input type="number" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} min="1" disabled={controlsDisabled} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-center"/>
                    <button onClick={() => setBets({})} disabled={controlsDisabled || totalBet === 0} className="px-4 bg-red-800 rounded hover:bg-red-700 disabled:opacity-50">مسح</button>
                 </div>
            </div>
        </div>
    );
};

export default CardDrawGame;
