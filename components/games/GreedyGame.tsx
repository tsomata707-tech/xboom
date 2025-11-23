
import React, { useState, useCallback, useMemo } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { useGameLoop } from '../hooks/useGameLoop';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import GameTimerDisplay from '../GameTimerDisplay';
import BetControls from '../BetControls';
import HowToPlay from '../HowToPlay';

// Prop types
interface UserProfile extends AppUser {
    balance: number;
}

interface GreedyGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Game Data
const ALL_ITEMS = [
    // Vegetables
    { id: 'tomato', name: 'طماطم', icon: '🍅', multiplier: 5 },
    { id: 'cucumber', name: 'خيار', icon: '🥒', multiplier: 5 },
    { id: 'carrot', name: 'جزر', icon: '🥕', multiplier: 5 },
    { id: 'pepper', name: 'فلفل', icon: '🌶️', multiplier: 5 },
    // Meats
    { id: 'beef', name: 'لحم بقري', icon: '🍖', multiplier: 15 },
    { id: 'chicken', name: 'دجاج', icon: '🍗', multiplier: 8 },
    { id: 'bacon', name: 'لحم مقدد', icon: '🥓', multiplier: 9 },
    { id: 'fish', name: 'سمك', icon: '🐟', multiplier: 45 },
];


// Game Config
const PREPARATION_TIME = 15;
const GAME_TIME = 5; // Animation time
const RESULTS_TIME = 5;
const MAX_SELECTION = 6;

const GreedyGame: React.FC<GreedyGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    
    // State
    const [bet, setBet] = useState(100); // Bet per item
    const [selectedItems, setSelectedItems] = useState<(typeof ALL_ITEMS[0])[]>([]);
    const [lockedBets, setLockedBets] = useState<(typeof ALL_ITEMS[0])[]>([]);
    const [lockedBetAmount, setLockedBetAmount] = useState<number>(0);
    const [winningItem, setWinningItem] = useState<typeof ALL_ITEMS[0] | null>(null);
    const [resultMessage, setResultMessage] = useState<React.ReactNode | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [history, setHistory] = useState<(typeof ALL_ITEMS[0])[]>([]);

    const totalBet = useMemo(() => bet * selectedItems.length, [bet, selectedItems]);
    
    // Game Loop
    const handleRoundStart = useCallback(async () => {
        const randomWinner = ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)];
        setWinningItem(randomWinner);
        setHistory(prev => [randomWinner, ...prev.slice(0, 9)]);

        if (lockedBets.length === 0) {
            return;
        }

        const winningBet = lockedBets.find(item => item.id === randomWinner.id);

        if (winningBet) {
            // Win
            const winnings = lockedBetAmount * randomWinner.multiplier;
            await onBalanceUpdate(winnings, 'greedyGame');
            setResultMessage(
                <div className="text-center text-green-400 game-container-animation">
                    <p className="text-2xl font-bold">🎉 فــــــوز 🎉</p>
                    <p className="text-lg mt-1">
                        رهانك <span className="font-mono text-yellow-300">{formatNumber(lockedBetAmount)}</span> على {winningBet.icon} (x{randomWinner.multiplier})
                        <br/>
                        ربح <span className="font-mono text-white text-xl">{formatNumber(winnings)} 💎</span>
                    </p>
                </div>
            );
            setShowConfetti(true);
            if (winnings > 10000 && userProfile?.displayName) {
                onAnnounceWin(userProfile.displayName, winnings, 'greedyGame');
            }
        } else {
            // Loss
            setResultMessage(<span className="text-red-400">حظ أفضل في المرة القادمة. الفائز كان {randomWinner.icon}.</span>);
        }
    }, [lockedBets, lockedBetAmount, onBalanceUpdate, userProfile?.displayName, onAnnounceWin]);

    const resetGame = useCallback(() => {
        setSelectedItems([]);
        setLockedBets([]);
        setLockedBetAmount(0);
        setWinningItem(null);
        setResultMessage(null);
        setShowConfetti(false);
    }, []);

    const { phase, timeRemaining, totalTime } = useGameLoop({
        onRoundStart: handleRoundStart,
        onRoundEnd: resetGame,
    }, {
        preparationTime: PREPARATION_TIME,
        gameTime: GAME_TIME,
        resultsTime: RESULTS_TIME,
    });
    
    const controlsDisabled = phase !== 'preparing' || lockedBets.length > 0;

    const handleSelectItem = (item: typeof ALL_ITEMS[0]) => {
        if (controlsDisabled) return;

        const isAlreadySelected = selectedItems.some(si => si.id === item.id);

        // Check balance before adding item
        if (!isAlreadySelected) {
            const currentBalance = userProfile?.balance || 0;
            const projectedTotal = (selectedItems.length + 1) * bet;
            
            if (projectedTotal > currentBalance) {
                 addToast('رصيدك غير كافٍ.', 'error');
                 return;
            }
        }

        setSelectedItems(prevItems => {
            if (isAlreadySelected) {
                return prevItems.filter(si => si.id !== item.id);
            } else {
                if (prevItems.length >= MAX_SELECTION) {
                    addToast(`يمكنك اختيار ${MAX_SELECTION} عناصر كحد أقصى.`, 'info');
                    return prevItems;
                }
                return [...prevItems, item];
            }
        });
    };
    
    const handlePlaceBet = async () => {
        if (selectedItems.length === 0) {
            addToast('الرجاء اختيار عنصر واحد على الأقل للمراهنة عليه.', 'info');
            return;
        }
        if (!userProfile || bet <= 0 || totalBet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }
        
        const success = await onBalanceUpdate(-totalBet, 'greedyGame');
        if (success) {
            setLockedBets(selectedItems);
            setLockedBetAmount(bet);
            addToast(`تم وضع رهان بقيمة ${formatNumber(totalBet)} 💎`, 'success');
        }
    };
    
    const ItemCard: React.FC<{item: typeof ALL_ITEMS[0]}> = ({ item }) => {
        const isSelected = selectedItems.some(si => si.id === item.id);
        const isLocked = lockedBets.length > 0;
        const isWinner = winningItem?.id === item.id;
        
        let cardClasses = 'bg-gray-800/50 border-gray-700';

        if (phase === 'results') {
            if (isWinner) {
                cardClasses = 'bg-yellow-500/30 border-yellow-400 scale-110 ring-4 ring-yellow-400';
            } else {
                cardClasses = 'bg-gray-900/50 border-gray-800 opacity-50 grayscale';
            }
        } else if (isLocked) {
             if (isSelected) {
                 cardClasses = 'bg-cyan-500/20 border-cyan-400 scale-105';
             } else {
                 cardClasses = 'bg-gray-900/50 border-gray-800 opacity-50 grayscale';
             }
        } else if (isSelected) {
            cardClasses = 'bg-cyan-500/20 border-cyan-400 scale-105';
        }
        
        return (
            <button
                onClick={() => handleSelectItem(item)}
                disabled={controlsDisabled}
                className={`p-2 sm:p-3 rounded-xl text-center border-2 transition-all duration-300 transform disabled:cursor-not-allowed flex flex-col justify-between ${cardClasses} ${!controlsDisabled ? 'hover:border-cyan-300 hover:-translate-y-1' : ''}`}
            >
                <div className="text-3xl sm:text-4xl">{item.icon}</div>
                <div className="mt-1 font-bold text-xs sm:text-sm">{item.name}</div>
                <div className="mt-1 text-yellow-300 font-bold bg-black/30 px-2 rounded-full text-xs">{item.multiplier}x</div>
            </button>
        )
    };

    return (
        <div className="flex flex-col h-full p-2 text-white game-container-animation justify-start relative">
            {showConfetti && <Confetti onComplete={() => {}} />}
            
            <HowToPlay>
                <p>1. حدد المبلغ الذي تريد المراهنة به لكل عنصر.</p>
                <p>2. اختر العناصر (طعام) التي تعتقد أنها ستظهر.</p>
                <p>3. يمكنك اختيار حتى 6 عناصر لزيادة فرصك.</p>
                <p>4. اضغط "ضع الرهان".</p>
                <p>5. إذا ظهر أحد العناصر التي اخترتها، تربح حسب المضاعف المكتوب عليه (مثلاً السمك x45).</p>
            </HowToPlay>

            <GameTimerDisplay phase={phase} timeRemaining={timeRemaining} totalTime={totalTime} />
            
            <div className="flex-grow my-2 bg-gray-900/30 p-2 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg sm:text-xl font-bold text-yellow-300">اختر العناصر للمراهنة عليها</h2>
                    <div className="text-sm font-bold bg-gray-800/50 px-3 py-1 rounded-lg">
                        {selectedItems.length} / {MAX_SELECTION}
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                    {ALL_ITEMS.map(item => <ItemCard key={item.id} item={item} />)}
                </div>
            </div>

            <div className="h-16 text-xl font-bold text-center my-1 flex items-center justify-center game-container-animation">
                {resultMessage}
            </div>
            
            <div className="bg-gray-900/30 p-2 rounded-lg flex flex-col md:flex-row gap-2 items-center">
                <div className="w-full md:flex-1">
                   <BetControls
                        bet={bet}
                        setBet={setBet}
                        balance={userProfile?.balance ?? 0}
                        disabled={controlsDisabled}
                    />
                    <p className="text-center text-xs text-gray-400 mt-1">المبلغ لكل عنصر</p>
                </div>
                <div className="w-full md:w-auto md:flex-1 flex flex-col items-center justify-center gap-2">
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">إجمالي الرهان</p>
                        <p className="text-xl font-bold text-yellow-300">{formatNumber(totalBet)} 💎</p>
                    </div>
                    <button 
                        onClick={handlePlaceBet} 
                        disabled={controlsDisabled || selectedItems.length === 0}
                        className="w-full h-14 text-xl font-bold bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg text-white hover:opacity-90 transition transform hover:scale-105 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
                    >
                        {lockedBets.length > 0 ? 'تم وضع الرهان' : 'ضع الرهان'}
                    </button>
                </div>
            </div>
            
            <div className="mt-2 w-full">
                <h3 className="text-center text-gray-400 text-xs mb-1">السجل الأخير</h3>
                <div className="flex justify-center gap-2 flex-wrap bg-gray-900/30 p-1 rounded-lg">
                    {history.length > 0 ? history.map((item, index) => (
                        <div key={index} className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xl" title={item.name}>{item.icon}</div>
                    )) : <p className="text-gray-500 text-xs py-1">لا يوجد سجل بعد.</p>}
                </div>
            </div>

        </div>
    );
};

export default GreedyGame;
