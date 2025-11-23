
import React, { useState, useCallback, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import { useGameLoop } from '../hooks/useGameLoop';
import GameTimerDisplay from '../GameTimerDisplay';
import GenieIcon from '../icons/GenieIcon';
import KingIcon from '../icons/KingIcon';
import HowToPlay from '../HowToPlay';

// Prop types
interface UserProfile extends AppUser {
    balance: number;
}

interface DragonKingGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Game configuration
type Choice = 'genie' | 'king';
type BoxContent = Choice | 'empty';
const BOX_CONTENTS: BoxContent[] = ['genie', 'king', 'empty', 'empty'];
const MULTIPLIER = 3.5;
const PREPARATION_TIME = 10;
const GAME_TIME = 10;
const RESULTS_TIME = 5;

// Helper function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const DragonKingGame: React.FC<DragonKingGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    
    // Game State
    const [bet, setBet] = useState(25);
    const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
    const [selectedBox, setSelectedBox] = useState<number | null>(null);
    const [boxContents, setBoxContents] = useState<BoxContent[]>([]);
    const [isRevealed, setIsRevealed] = useState(false);
    const [result, setResult] = useState<'win' | 'loss' | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [animationState, setAnimationState] = useState<'idle' | 'showing' | 'shuffling' | 'revealed'>('idle');

    // Game Loop
    const { phase, timeRemaining, totalTime } = useGameLoop({
        onRoundStart: () => handlePlay(),
        onRoundEnd: () => resetGame(),
    }, {
        preparationTime: PREPARATION_TIME,
        gameTime: GAME_TIME,
        resultsTime: RESULTS_TIME,
    });
    
    const handlePlay = useCallback(async () => {
        if (!playerChoice || selectedBox === null) {
            addToast('اختر جني أو ملك، ثم اختر صندوقًا لبدء اللعبة.', 'info');
            return;
        }
        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'dragonKing');
        if (!success) return;
        
        setAnimationState('showing'); // Briefly show all contents
        setTimeout(() => {
            setAnimationState('shuffling'); // Flip cards back and shuffle
        }, 2000);

        setTimeout(() => {
            setAnimationState('revealed');
            setIsRevealed(true);
            const finalContent = boxContents[selectedBox];
            if (finalContent === playerChoice) {
                const winnings = bet * MULTIPLIER;
                onBalanceUpdate(winnings, 'dragonKing');
                setResult('win');
                addToast(`لقد فزت بـ ${formatNumber(winnings)} 💎!`, 'success');
                if (winnings > 10000 && userProfile.displayName) {
                    onAnnounceWin(userProfile.displayName, winnings, 'dragonKing');
                }
                if (winnings > bet * 5) {
                    setShowConfetti(true);
                }
            } else {
                setResult('loss');
                addToast('حظ أفضل في المرة القادمة!', 'info');
            }
        }, 5000); // 2s show + 3s for shuffle animation

    }, [playerChoice, selectedBox, bet, userProfile, onBalanceUpdate, addToast, boxContents, onAnnounceWin]);

    const resetGame = useCallback(() => {
        setPlayerChoice(null);
        setSelectedBox(null);
        setResult(null);
        setIsRevealed(false);
        setBoxContents(shuffleArray(BOX_CONTENTS));
        setAnimationState('idle');
    }, []);
    
    useEffect(() => {
        if (phase === 'preparing') {
            resetGame();
        }
    }, [phase, resetGame]);

    const controlsDisabled = phase !== 'preparing';

    const getResultMessage = () => {
        if (phase !== 'results' || !result) return null;
        if (result === 'win') {
            return <div className="game-text font-bold text-green-400 game-container-animation">🎉 لقد فزت بـ {formatNumber(bet * MULTIPLIER)} 💎!</div>;
        } else {
            return <div className="game-text font-bold text-red-400 game-container-animation">لقد خسرت رهانك.</div>;
        }
    };
    
    return (
        <div className="flex flex-col items-center p-2 sm:p-4 h-full justify-start gap-2 relative">
            <HowToPlay>
                <p>1. اختر إما "الجني 🧞" أو "الملك 👑".</p>
                <p>2. حدد قيمة رهانك.</p>
                <p>3. اختر أحد الصناديق الأربعة.</p>
                <p>4. انتظر حتى يتم خلط الصناديق.</p>
                <p>5. إذا وجدت الشخصية التي اخترتها في الصندوق، تربح 3.5 أضعاف رهانك!</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <GameTimerDisplay phase={phase} timeRemaining={timeRemaining} totalTime={totalTime} />
            
            <div className="flex-grow w-full flex items-center justify-center min-h-[250px] game-container">
                <div className="grid grid-cols-2 grid-rows-2 gap-4 sm:gap-6 perspective-1000 w-full max-w-lg">
                    {BOX_CONTENTS.map((_, index) => {
                        const content = boxContents[index];
                        const isSelected = selectedBox === index;
                        const showContent = animationState === 'showing' || (animationState === 'revealed');

                        return (
                             <div 
                                key={index}
                                onClick={() => !controlsDisabled && setSelectedBox(index)}
                                className={`relative game-item aspect-[4/5] rounded-lg cursor-pointer transform-style-3d transition-transform duration-700
                                    ${!controlsDisabled && isSelected ? 'scale-110' : ''}
                                    ${!controlsDisabled ? 'hover:scale-105' : ''}
                                `}
                             >
                                <div className={`absolute w-full h-full transition-transform duration-700 ${showContent ? 'rotate-y-180' : ''}`}>
                                    {/* Front of Card */}
                                    <div className={`absolute w-full h-full backface-hidden rounded-lg border-4 flex items-center justify-center
                                        ${isSelected ? 'border-yellow-400' : 'border-gray-600'}
                                        bg-gradient-to-br from-purple-800 to-indigo-900`}>
                                        <span className="text-5xl text-yellow-300 opacity-80">?</span>
                                    </div>
                                    {/* Back of Card */}
                                    <div className={`absolute w-full h-full backface-hidden rounded-lg border-2 flex items-center justify-center rotate-y-180 p-2
                                        ${result === 'win' && isSelected ? 'bg-green-500/80 border-green-300 shadow-lg shadow-green-500/50' : ''}
                                        ${result === 'loss' && isSelected ? 'bg-red-500/80 border-red-300' : ''}
                                        ${!isSelected || !result ? 'bg-gray-700 border-gray-500' : ''}`}>
                                            {content === 'genie' && <GenieIcon className="w-24 h-24 sm:w-32 sm:h-32" />}
                                            {content === 'king' && <KingIcon className="w-24 h-24 sm:w-32 sm:h-32" />}
                                    </div>
                                 </div>
                             </div>
                        );
                    })}
                </div>
            </div>

            <div className="h-8 my-1 flex items-center justify-center">
                {getResultMessage()}
            </div>

            <div className="w-full max-w-lg flex flex-col items-center gap-4">
                 <div className="flex gap-4">
                    <button 
                        onClick={() => setPlayerChoice('genie')}
                        disabled={controlsDisabled}
                        className={`game-item py-2 text-2xl font-bold rounded-lg border-4 transition-all duration-300 flex items-center justify-center gap-2 ${playerChoice === 'genie' && !controlsDisabled ? 'border-cyan-500 bg-cyan-500/20 scale-110' : 'border-gray-600 bg-gray-700'} disabled:opacity-50`}
                    >
                        <GenieIcon className="w-10 h-10"/> جني
                    </button>
                    <button 
                        onClick={() => setPlayerChoice('king')}
                        disabled={controlsDisabled}
                        className={`game-item py-2 text-2xl font-bold rounded-lg border-4 transition-all duration-300 flex items-center justify-center gap-2 ${playerChoice === 'king' && !controlsDisabled ? 'border-yellow-400 bg-yellow-400/20 scale-110' : 'border-gray-600 bg-gray-700'} disabled:opacity-50`}
                    >
                        <KingIcon className="w-10 h-10"/> ملك
                    </button>
                 </div>
            </div>

            <BetControls
                bet={bet}
                setBet={setBet}
                balance={userProfile?.balance ?? 0}
                disabled={controlsDisabled}
            />
        </div>
    );
};

export default DragonKingGame;
