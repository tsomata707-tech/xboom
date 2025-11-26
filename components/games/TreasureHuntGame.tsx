
import React, { useState, useCallback } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import BetControls from '../BetControls';

interface UserProfile extends AppUser {
    balance: number;
}

interface TreasureHuntGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Difficulty Configuration
type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<Difficulty, { mines: number, multipliers: number[] }> = {
    easy: { 
        mines: 1, 
        multipliers: [1.23, 1.54, 1.93, 2.41, 3.02, 3.78, 4.73, 5.91, 7.39, 9.24] 
    },
    medium: { 
        mines: 2, 
        multipliers: [1.92, 3.84, 7.68, 15.36, 30.72, 61.44, 122.88, 245.76, 491.52, 983.04] 
    },
    hard: { 
        mines: 3, 
        multipliers: [3.84, 14.75, 56.62, 217.44, 834.96, 3206.26, 12312.05, 47278.27, 181548.5, 697146.4] 
    }
};

const ROWS = 10;
const COLS = 4;

const TreasureHuntGame: React.FC<TreasureHuntGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    
    // State - Step-by-Step logic, NO TIMER
    const [bet, setBet] = useState(100);
    const [difficulty, setDifficulty] = useState<Difficulty>('easy');
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'cashed_out' | 'lost'>('idle');
    const [currentRow, setCurrentRow] = useState(0); // 0 is bottom
    const [history, setHistory] = useState<boolean[][]>([]); // Map of clicked tiles
    const [minesMap, setMinesMap] = useState<boolean[][]>([]); // Map of mines
    const [showConfetti, setShowConfetti] = useState(false);
    const [revealedRow, setRevealedRow] = useState<number | null>(null);

    const currentConfig = DIFFICULTY_CONFIG[difficulty];
    
    // Calculate winnings
    const currentMultiplier = currentRow > 0 ? currentConfig.multipliers[currentRow - 1] : 1;
    const currentWinnings = currentRow > 0 ? bet * currentMultiplier : bet;

    const startGame = async () => {
        if (!userProfile || bet <= 0) {
            addToast('الرجاء تحديد رهان صالح.', 'error');
            return;
        }
        if (bet > userProfile.balance) {
            addToast('رصيدك غير كافٍ.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'treasureHunt');
        if (!success) return;

        // Generate Mines (Client Side Logic for speed)
        const newMinesMap: boolean[][] = [];
        for (let r = 0; r < ROWS; r++) {
            const rowMines = Array(COLS).fill(false);
            let minesPlaced = 0;
            while (minesPlaced < currentConfig.mines) {
                const randCol = Math.floor(Math.random() * COLS);
                if (!rowMines[randCol]) {
                    rowMines[randCol] = true;
                    minesPlaced++;
                }
            }
            newMinesMap.push(rowMines);
        }

        setMinesMap(newMinesMap);
        const initHistory = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        setHistory(initHistory);
        setCurrentRow(0);
        setRevealedRow(null);
        setGameState('playing');
        setShowConfetti(false);
    };

    const handleTileClick = (row: number, col: number) => {
        if (gameState !== 'playing' || row !== currentRow) return;

        const isMine = minesMap[row][col];
        
        // Update history
        setHistory(prev => {
            const newHistory = [...prev];
            const newRow = [...newHistory[row]];
            newRow[col] = !isMine; // true if safe
            newHistory[row] = newRow;
            return newHistory;
        });

        if (isMine) {
            // Game Over
            setGameState('lost');
            setRevealedRow(row);
            addToast('للأسف! التفاحة كانت فاسدة.', 'error');
        } else {
            // Success
            const nextRow = currentRow + 1;
            if (nextRow >= ROWS) {
                // Auto cashout at top
                cashOut(true);
            } else {
                setCurrentRow(nextRow);
            }
        }
    };

    const cashOut = async (reachedTop = false) => {
        if (gameState !== 'playing') return;

        const finalWin = currentRow > 0 ? bet * currentConfig.multipliers[currentRow - 1] : bet;
        
        await onBalanceUpdate(finalWin, 'treasureHunt');
        setGameState('cashed_out');
        
        if (finalWin > bet) {
            addToast(`تم السحب بنجاح! ربحت ${formatNumber(finalWin)} 💎`, 'success');
            setShowConfetti(true);
            if (finalWin > 10000 && userProfile?.displayName) {
                onAnnounceWin(userProfile.displayName, finalWin, 'treasureHunt');
            }
        }
    };

    const resetGame = () => {
        setGameState('idle');
        setHistory([]);
        setMinesMap([]);
        setCurrentRow(0);
        setRevealedRow(null);
        setShowConfetti(false);
    };

    const getTileContent = (row: number, col: number) => {
        const rowData = history[row];
        const isClicked = rowData && rowData[col] !== null && rowData[col] !== undefined;
        
        if (gameState === 'playing') {
            if (row === currentRow) return <span className="text-2xl opacity-50">❓</span>; 
            if (isClicked) {
                if (rowData[col] === true) return <span className="text-2xl drop-shadow-md">🍎</span>;
                if (rowData[col] === false) return <span className="text-2xl">🐛</span>;
            }
            if (row < currentRow && !isClicked) return <span className="text-xl opacity-20">🍎</span>;
            return null;
        }

        if (gameState === 'lost' || gameState === 'cashed_out') {
             if (isClicked) {
                 if (rowData[col] === true) return <span className="text-2xl drop-shadow-md">🍎</span>;
                 if (rowData[col] === false) return <span className="text-2xl animate-bounce">🐛</span>;
             }
             if (minesMap[row] && minesMap[row][col]) return <span className="text-xl opacity-70 grayscale">🐛</span>;
             return <span className="text-xl opacity-30">🍎</span>;
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-2 relative">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="flex justify-between items-center mb-2 bg-gray-900/50 p-2 rounded-lg border border-stone-700 mt-8">
                <div className="text-sm text-gray-400">
                    الصعوبة: <span className={`font-bold ${difficulty === 'easy' ? 'text-green-400' : difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {difficulty === 'easy' ? 'سهل' : difficulty === 'medium' ? 'متوسط' : 'صعب'}
                    </span>
                </div>
                <div className="text-yellow-300 font-bold flex items-center gap-1">
                    <span>الربح الحالي:</span>
                    <span className="font-mono text-xl">{gameState === 'playing' || gameState === 'cashed_out' ? formatNumber(currentWinnings) : formatNumber(0)}</span>
                </div>
            </div>

            <div className="flex-grow flex gap-2 min-h-[400px] bg-[#1c1917] rounded-xl border-4 border-[#44403c] p-2 relative overflow-hidden shadow-2xl">
                 <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>

                 <div className="w-16 sm:w-20 flex flex-col-reverse justify-evenly gap-1 z-10">
                    {currentConfig.multipliers.map((multi, i) => {
                        const isCurrent = i === currentRow && gameState === 'playing';
                        const isPassed = i < currentRow;
                        return (
                            <div key={i} className={`h-full flex items-center justify-center rounded text-xs sm:text-sm font-bold transition-all duration-300
                                ${isCurrent ? 'bg-yellow-500 text-black scale-110 shadow-[0_0_10px_#eab308] border-2 border-white' : ''}
                                ${isPassed ? 'bg-green-900/50 text-green-400 border border-green-800' : ''}
                                ${!isCurrent && !isPassed ? 'bg-stone-800/50 text-stone-500' : ''}
                            `}>
                                x{multi}
                            </div>
                        )
                    })}
                 </div>

                 <div className="flex-grow flex flex-col-reverse justify-evenly gap-1 z-10">
                     {Array.from({ length: ROWS }).map((_, rowIdx) => {
                         const isActiveRow = rowIdx === currentRow && gameState === 'playing';
                         const isPastRow = rowIdx < currentRow;
                         
                         return (
                             <div key={rowIdx} className={`flex gap-2 h-full transition-all duration-300 ${isActiveRow ? 'opacity-100' : 'opacity-60'}`}>
                                 {Array.from({ length: COLS }).map((_, colIdx) => {
                                     return (
                                         <button
                                            key={colIdx}
                                            onClick={() => handleTileClick(rowIdx, colIdx)}
                                            disabled={!isActiveRow}
                                            className={`flex-1 rounded-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center relative overflow-hidden
                                                ${isActiveRow 
                                                    ? 'bg-amber-700 border-amber-900 hover:bg-amber-600 cursor-pointer' 
                                                    : isPastRow ? 'bg-stone-900 border-stone-950' : 'bg-stone-800 border-stone-900 cursor-default'}
                                                ${revealedRow === rowIdx ? 'shake-animation' : ''}
                                            `}
                                         >
                                             <div className="relative z-10 transition-all transform duration-300">
                                                 {getTileContent(rowIdx, colIdx)}
                                             </div>
                                         </button>
                                     )
                                 })}
                             </div>
                         )
                     })}
                 </div>
            </div>

            <div className="h-10 text-xl font-bold text-center mt-2 game-container-animation">
                {gameState === 'lost' && <span className="text-red-500">لقد خسرت!</span>}
                {gameState === 'cashed_out' && <span className="text-green-400">🎉 مبروك!</span>}
            </div>

            <div className="mt-2 p-3 bg-gray-900/80 rounded-xl border border-gray-700 backdrop-blur-sm">
                {gameState === 'playing' ? (
                    <button onClick={() => cashOut(false)} className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black text-2xl font-black rounded-lg shadow-[0_4px_0_rgb(161,98,7)] active:shadow-none active:translate-y-1 transition-all">
                        سحب {formatNumber(currentWinnings)}
                    </button>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2 bg-gray-800 p-1 rounded-lg">
                            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDifficulty(d)}
                                    className={`flex-1 py-2 rounded font-bold transition-all ${difficulty === d 
                                        ? (d === 'easy' ? 'bg-green-600 text-white' : d === 'medium' ? 'bg-yellow-600 text-black' : 'bg-red-600 text-white')
                                        : 'text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب'}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 items-center">
                            <div className="flex-grow">
                                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={false} />
                            </div>
                            <button onClick={gameState === 'idle' ? startGame : resetGame} className={`w-1/3 py-4 text-white text-lg font-black rounded-lg shadow-[0_4px_0_rgba(0,0,0,0.3)] active:shadow-none active:translate-y-1 transition-all h-full self-end mb-1 ${gameState === 'idle' ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                {gameState === 'idle' ? 'لعب' : 'جديد'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
                .shake-animation { animation: shake 0.4s ease-in-out; }
            `}</style>
        </div>
    );
};

export default TreasureHuntGame;
