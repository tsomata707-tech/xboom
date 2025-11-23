
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { formatNumber } from '../utils/formatNumber';
import { useGameLoop } from '../hooks/useGameLoop';
import GameTimerDisplay from '../GameTimerDisplay';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface DominoGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Domino Types
type DominoTile = [number, number]; // [top, bottom]
const DOUBLE_SIX_SET: DominoTile[] = [
    [0,0], [0,1], [0,2], [0,3], [0,4], [0,5], [0,6],
    [1,1], [1,2], [1,3], [1,4], [1,5], [1,6],
    [2,2], [2,3], [2,4], [2,5], [2,6],
    [3,3], [3,4], [3,5], [3,6],
    [4,4], [4,5], [4,6],
    [5,5], [5,6],
    [6,6]
];

const PREPARATION_TIME = 10;
const GAME_TIME = 15; 
const RESULTS_TIME = 5;

// --- Sub-Components Optimized with React.memo for Performance ---

const TileHalf: React.FC<{ num: number }> = React.memo(({ num }) => {
    const getDotPositions = (n: number) => {
        const positions: React.CSSProperties[] = [];
        const center = { top: '50%', left: '50%' };
        const tl = { top: '20%', left: '20%' };
        const tr = { top: '20%', left: '80%' };
        const ml = { top: '50%', left: '20%' };
        const mr = { top: '50%', left: '80%' };
        const bl = { top: '80%', left: '20%' };
        const br = { top: '80%', left: '80%' };

        if (n === 1) positions.push(center);
        if (n === 2) positions.push(tl, br);
        if (n === 3) positions.push(tl, center, br);
        if (n === 4) positions.push(tl, tr, bl, br);
        if (n === 5) positions.push(tl, tr, center, bl, br);
        if (n === 6) positions.push(tl, tr, ml, mr, bl, br);
        return positions;
    };

    return (
        <div className="w-full h-full relative">
            {getDotPositions(num).map((pos, i) => (
                <div
                    key={i}
                    className="absolute w-[22%] h-[22%] bg-black rounded-full transform -translate-x-1/2 -translate-y-1/2"
                    style={pos}
                />
            ))}
        </div>
    );
});

const DominoPiece: React.FC<{ 
    tile?: DominoTile; 
    faceDown?: boolean; 
    onClick?: () => void;
    selected?: boolean;
    disabled?: boolean;
    isWinning?: boolean;
    isLosing?: boolean;
}> = React.memo(({ tile, faceDown, onClick, selected, disabled, isWinning, isLosing }) => {
    
    const totalPoints = tile ? tile[0] + tile[1] : 0;

    return (
        <div 
            onClick={!disabled ? onClick : undefined}
            className={`
                relative 
                w-[12vw] max-w-[55px] aspect-[1/2] 
                rounded-[4px] sm:rounded-md 
                transition-transform duration-300 transform-style-3d cursor-pointer select-none will-change-transform
                ${selected ? '-translate-y-4 scale-110 z-30' : 'hover:-translate-y-1'}
                ${isWinning ? 'scale-110 z-30' : ''}
                ${isLosing ? 'opacity-60 grayscale' : ''}
                ${!selected && !isWinning && !isLosing ? 'shadow-md' : ''}
            `}
            style={{ perspective: '800px' }}
        >
            {/* Points Indicator Bubble - Only Show When Selected or Winning */}
            {(selected || (isWinning && !faceDown)) && tile && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-40 animate-bounce">
                    {totalPoints}
                </div>
            )}

            {/* Glow Effect for Winning */}
            {(isWinning) && (
                <div className="absolute -inset-[2px] bg-yellow-400/50 rounded-[6px] blur-sm animate-pulse -z-10"></div>
            )}

            {/* Inner Container for Flip */}
            <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d z-10 ${faceDown ? 'rotate-y-180' : ''}`}>
                
                {/* Front Face (Ivory + Gold Border) */}
                <div className="absolute inset-0 w-full h-full bg-[#FFFFF0] rounded-[4px] sm:rounded-md flex flex-col overflow-hidden backface-hidden border-[1px] border-[#B8860B]">
                    {tile && (
                        <>
                            <div className="flex-1 relative p-[1px]">
                                <TileHalf num={tile[0]} />
                            </div>
                            {/* Divider */}
                            <div className="w-[80%] h-[1px] bg-[#B8860B] mx-auto"></div>
                            <div className="flex-1 relative p-[1px]">
                                <TileHalf num={tile[1]} />
                            </div>
                        </>
                    )}
                </div>

                {/* Back Face (Gold Patterned) */}
                <div className="absolute inset-0 w-full h-full bg-[#222] rounded-[4px] sm:rounded-md backface-hidden rotate-y-180 border-[1px] border-[#B8860B] flex items-center justify-center">
                   {/* Center Logo */}
                   <div className="w-4 h-4 rounded-full border border-[#FFD700] flex items-center justify-center">
                       <div className="text-[#FFD700] text-[8px]">★</div>
                   </div>
                </div>
            </div>
        </div>
    );
});


const DominoGame: React.FC<DominoGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [playerHand, setPlayerHand] = useState<DominoTile[]>([]);
    const [computerHand, setComputerHand] = useState<DominoTile[]>([]);
    const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
    const [computerTileIndex, setComputerTileIndex] = useState<number | null>(null);
    const [result, setResult] = useState<'win' | 'loss' | 'draw' | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    const shuffleDeck = () => {
        const deck = [...DOUBLE_SIX_SET];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    };

    const startNewRound = useCallback(() => {
        const deck = shuffleDeck();
        const computer = deck.slice(0, 7);
        const player = deck.slice(7, 14);
        setComputerHand(computer);
        setPlayerHand(player);
        setSelectedTileIndex(null);
        setComputerTileIndex(null);
        setResult(null);
        setShowConfetti(false);
    }, []);

    const { phase, timeRemaining, totalTime } = useGameLoop({
        onRoundStart: startNewRound,
        onRoundEnd: () => {
             setPlayerHand([]);
             setComputerHand([]);
        },
    }, {
        preparationTime: PREPARATION_TIME,
        gameTime: GAME_TIME,
        resultsTime: RESULTS_TIME,
    });

    const handleTileClick = async (index: number) => {
        if (phase !== 'running' || selectedTileIndex !== null) return;
        
        // Immediate visual feedback to prevent "lag feeling"
        setSelectedTileIndex(index);

        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
             addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
             setSelectedTileIndex(null); // Revert on error
             return;
        }

        const success = await onBalanceUpdate(-bet, 'domino');
        if (!success) {
            setSelectedTileIndex(null);
            return;
        }

        // --- Game Logic with 70% Win Rate for Player ---
        const playerTile = playerHand[index];
        const playerTotal = playerTile[0] + playerTile[1];

        // Determine desired outcome (70% Player Win / 30% House Win)
        const randomSeed = Math.random();
        const playerShouldWin = randomSeed < 0.70;

        let compIndex = -1;
        
        if (playerShouldWin) {
            // Try to find a computer card smaller than player's card
            const losingOptions = computerHand
                .map((t, i) => ({ total: t[0] + t[1], index: i }))
                .filter(item => item.total < playerTotal);
            
            if (losingOptions.length > 0) {
                // Pick a random loser card
                compIndex = losingOptions[Math.floor(Math.random() * losingOptions.length)].index;
            } else {
                // Computer has only larger cards, player must lose (bad luck despite odds)
                // Pick the smallest possible computer card to minimize the beating
                let minTotal = 13;
                computerHand.forEach((t, i) => {
                    if (t[0] + t[1] < minTotal) {
                        minTotal = t[0] + t[1];
                        compIndex = i;
                    }
                });
            }
        } else {
            // House (Treasury) Should Win (30%)
            // Try to find a computer card larger than player's
            const winningOptions = computerHand
                .map((t, i) => ({ total: t[0] + t[1], index: i }))
                .filter(item => item.total > playerTotal);
                
            if (winningOptions.length > 0) {
                 compIndex = winningOptions[Math.floor(Math.random() * winningOptions.length)].index;
            } else {
                // Computer has only smaller cards, player wins
                let maxTotal = -1;
                computerHand.forEach((t, i) => {
                    if (t[0] + t[1] > maxTotal) {
                        maxTotal = t[0] + t[1];
                        compIndex = i;
                    }
                });
            }
        }

        // Fallback if logic fails (rare)
        if (compIndex === -1) compIndex = Math.floor(Math.random() * 7);

        // Delay specifically for the "Opponent Move" animation, not the selection
        setTimeout(() => {
            setComputerTileIndex(compIndex);

            const computerTile = computerHand[compIndex];
            const computerTotal = computerTile[0] + computerTile[1];

            if (playerTotal > computerTotal) {
                const winnings = bet * 2;
                onBalanceUpdate(winnings, 'domino');
                setResult('win');
                addToast(`فزت! ورقتك ${playerTotal} ضد ${computerTotal}`, 'success');
                if (winnings > 10000 && userProfile.displayName) {
                    onAnnounceWin(userProfile.displayName, winnings, 'domino');
                }
                setShowConfetti(true);
            } else if (playerTotal < computerTotal) {
                setResult('loss');
                addToast(`خسرت! ورقتك ${playerTotal} ضد ${computerTotal}`, 'error');
            } else {
                setResult('draw');
                onBalanceUpdate(bet, 'domino'); // Return bet
                addToast('تعادل! تم استرجاع الرهان.', 'info');
            }

        }, 800); // Slightly faster response
    };

    // Reset hands visually when preparing
    useEffect(() => {
        if (phase === 'preparing') {
            setPlayerHand([]);
            setComputerHand([]);
            setSelectedTileIndex(null);
            setComputerTileIndex(null);
            setResult(null);
        }
    }, [phase]);

    const dummyHand = useMemo(() => Array(7).fill([0,0]), []);
    const displayPlayerHand = playerHand.length > 0 ? playerHand : dummyHand;
    const displayComputerHand = computerHand.length > 0 ? computerHand : dummyHand;

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <HowToPlay>
                <p>1. حدد مبلغ الرهان.</p>
                <p>2. انتظر توزيع أوراق الدومينو (7 لك و 7 للخصم).</p>
                <p>3. اختر ورقة من يدك (يفضل ذات المجموع العالي).</p>
                <p>4. سيختار الخصم ورقة من يده.</p>
                <p>5. صاحب المجموع الأعلى يربح الجولة (x2).</p>
            </HowToPlay>

            {/* Game Area */}
            <div className="flex-grow flex flex-col justify-between items-center py-2 relative z-10 w-full max-w-2xl mx-auto">
                
                {/* Wood Table Texture */}
                 <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] pointer-events-none"></div>
                 <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80 pointer-events-none"></div>

                {/* Computer Hand (Top) */}
                <div className="w-full px-1 flex justify-center">
                    <div className="flex justify-center gap-[1vw] sm:gap-2 perspective-1000">
                        {displayComputerHand.map((tile, i) => (
                            <DominoPiece 
                                key={`comp-${i}`} 
                                tile={computerTileIndex === i ? tile : undefined} 
                                faceDown={computerTileIndex !== i}
                                isWinning={result === 'loss' && computerTileIndex === i} 
                                disabled={true}
                            />
                        ))}
                    </div>
                </div>

                {/* Center Info Area */}
                <div className="flex flex-col items-center justify-center text-center my-2 z-20 min-h-[120px]">
                     <GameTimerDisplay phase={phase} timeRemaining={timeRemaining} totalTime={totalTime} />
                     
                     {result ? (
                        <div className={`mt-2 px-6 py-2 rounded-xl border backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] game-container-animation transform scale-110
                            ${result === 'win' ? 'bg-green-900/90 border-green-400 text-green-300' : 
                              result === 'loss' ? 'bg-red-900/90 border-red-400 text-red-300' : 
                              'bg-gray-800/90 border-gray-400 text-gray-300'}
                        `}>
                            <h2 className="text-xl sm:text-3xl font-black">
                                {result === 'win' ? '🎉 مبروك!' : result === 'loss' ? '☠️ هارد لك' : '🤝 تعادل'}
                            </h2>
                            <p className="text-xs sm:text-sm font-bold opacity-90">
                                {result === 'win' ? 'أنت الرابح!' : result === 'loss' ? 'الخصم أعلى!' : 'نفس المجموع'}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-2 bg-black/40 px-6 py-1 rounded-full border border-yellow-500/30 backdrop-blur-sm transition-all">
                            <p className="text-yellow-300 font-bold text-xs sm:text-sm animate-pulse">
                                {phase === 'running' ? '👇 اختر الورقة الأعلى 👇' : '⏳ جاري التوزيع...'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Player Hand (Bottom) */}
                <div className="w-full px-1 pb-2 flex justify-center">
                    <div className="flex justify-center gap-[1vw] sm:gap-2 perspective-1000">
                         {displayPlayerHand.map((tile, i) => (
                            <DominoPiece 
                                key={`player-${i}`} 
                                tile={tile} 
                                faceDown={selectedTileIndex !== i} 
                                onClick={() => handleTileClick(i)}
                                selected={selectedTileIndex === i}
                                isWinning={result === 'win' && selectedTileIndex === i}
                                disabled={phase !== 'running' || selectedTileIndex !== null}
                            />
                        ))}
                    </div>
                </div>

            </div>

            {/* Controls */}
            <div className="p-3 bg-gray-900/90 border-t border-yellow-600/30 relative z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                 <BetControls
                    bet={bet}
                    setBet={setBet}
                    balance={userProfile?.balance ?? 0}
                    disabled={phase !== 'preparing'}
                />
            </div>
        </div>
    );
};

export default DominoGame;
