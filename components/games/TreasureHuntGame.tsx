
import React, { useState, useCallback } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import BetControls from '../BetControls';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface TreasureHuntGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Difficulty Configuration
// Easy: 1 mine in 4 tiles (3 safe)
// Medium: 1 mine in 3 tiles (2 safe) -> simplified for UI to always be 4 cols but logically distinct? 
// Actually, standard Tower uses fixed width but varies Mines count.
// Let's stick to the image: 4 Columns.
// We can vary the number of mines.
type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG: Record<Difficulty, { mines: number, multipliers: number[] }> = {
    easy: { 
        mines: 1, 
        // Approx multipliers for 3/4 win chance
        multipliers: [1.23, 1.54, 1.93, 2.41, 3.02, 3.78, 4.73, 5.91, 7.39, 9.24] 
    },
    medium: { 
        mines: 2, 
        // Approx multipliers for 2/4 win chance
        multipliers: [1.92, 3.84, 7.68, 15.36, 30.72, 61.44, 122.88, 245.76, 491.52, 983.04] 
    },
    hard: { 
        mines: 3, 
        // Approx multipliers for 1/4 win chance
        multipliers: [3.84, 14.75, 56.62, 217.44, 834.96, 3206.26, 12312.05, 47278.27, 181548.5, 697146.4] 
    }
};

const ROWS = 10;
const COLS = 4;

const TreasureHuntGame: React.FC<TreasureHuntGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    
    // State
    const [bet, setBet] = useState(100);
    const [difficulty, setDifficulty] = useState<Difficulty>('easy');
    const [gameState, setGameState] = useState<'betting' | 'playing' | 'cashed_out' | 'lost'>('betting');
    const [currentRow, setCurrentRow] = useState(0); // 0 is bottom
    const [history, setHistory] = useState<boolean[][]>([]); // Map of clicked tiles: [row][col] = isSafe
    const [minesMap, setMinesMap] = useState<boolean[][]>([]); // Map of mines: [row][col] = true if mine
    const [showConfetti, setShowConfetti] = useState(false);
    const [revealedRow, setRevealedRow] = useState<number | null>(null); // To show mines after game end

    const currentConfig = DIFFICULTY_CONFIG[difficulty];
    
    // Calculate current winnings based on completed rows
    const currentMultiplier = currentRow > 0 ? currentConfig.multipliers[currentRow - 1] : 1;
    const currentWinnings = currentRow > 0 ? bet * currentMultiplier : bet;

    const initializeGame = useCallback(async () => {
        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'treasureHunt');
        if (!success) return;

        // Generate Mines
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
        setHistory(Array(ROWS).fill(Array(COLS).fill(null))); // Reset history
        setCurrentRow(0);
        setRevealedRow(null);
        setGameState('playing');
        setShowConfetti(false);
    }, [bet, userProfile, onBalanceUpdate, currentConfig, addToast]);

    const handleTileClick = (row: number, col: number) => {
        if (gameState !== 'playing' || row !== currentRow) return;

        const isMine = minesMap[row][col];
        
        // Update visual history
        const newHistory = [...history];
        const rowHistory = Array(COLS).fill(null); // Reset row just in case, mostly UI logic
        rowHistory[col] = !isMine; // Store result
        newHistory[row] = rowHistory;
        setHistory(newHistory);

        if (isMine) {
            // Game Over
            setGameState('lost');
            setRevealedRow(row); // Reveal mines in this row
            addToast('للأسف! التفاحة كانت فاسدة.', 'error');
        } else {
            // Success
            const nextRow = currentRow + 1;
            if (nextRow >= ROWS) {
                // Reached Top - Auto Cashout
                cashOut(true);
            } else {
                setCurrentRow(nextRow);
            }
        }
    };

    const cashOut = async (reachedTop = false) => {
        if (gameState !== 'playing') return;

        // Ensure at least one step taken if user clicks button manually (though logic allows 0 usually in these games, let's enforce 1 step for "Treasure Hunt" feel)
        if (currentRow === 0 && !reachedTop) {
             // Refund? Usually you can't cash out at start 0x profit.
             // Logic: Current Winnings = Bet. So just return bet.
        }

        const finalWin = currentWinnings;
        
        await onBalanceUpdate(finalWin, 'treasureHunt');
        setGameState('cashed_out');
        
        if (finalWin > bet) {
            addToast(`تم السحب بنجاح! ربحت ${formatNumber(finalWin)} 💎`, 'success');
            setShowConfetti(true);
            if (finalWin > 10000 && userProfile?.displayName) {
                onAnnounceWin(userProfile.displayName, finalWin, 'treasureHunt');
            }
        } else {
            // Refund
             addToast('تم استرجاع الرهان.', 'info');
        }
    };

    const getTileContent = (row: number, col: number) => {
        // 1. Playing state or historical click
        const rowData = history[row];
        
        if (gameState === 'playing') {
            if (row === currentRow) return <span className="text-2xl opacity-50">❓</span>; // Active row placeholders
            if (row > currentRow) return null; // Future rows hidden
            // Past rows
            if (rowData && rowData[col] === true) return <span className="text-2xl drop-shadow-md">🍎</span>; // Safe
            if (rowData && rowData[col] === false) return <span className="text-2xl">🐛</span>; // Mine (shouldn't happen if playing)
            return null; // Unclicked in past row
        }

        // 2. Game Over / Cashed Out
        if (gameState === 'lost' || gameState === 'cashed_out') {
             // Show clicked result
             if (rowData && rowData[col] === true) return <span className="text-2xl drop-shadow-md">🍎</span>;
             if (rowData && rowData[col] === false) return <span className="text-2xl animate-bounce">🐛</span>;
             
             // Reveal mines if lost in this row or just show map
             if (minesMap[row][col]) return <span className="text-xl opacity-70 grayscale">🐛</span>;
             return <span className="text-xl opacity-30">🍎</span>;
        }
        
        return null;
    };

    return (
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-2 relative">
             <HowToPlay>
                <p>1. حدد الرهان ومستوى الصعوبة (سهل، متوسط، صعب).</p>
                <p>2. ابدأ اللعبة بالضغط على زر <strong>"لعب"</strong>.</p>
                <p>3. اختر مربعاً في الصف السفلي. إذا وجدت تفاحة (🍎) تنتقل للصف التالي وتتضاعف أرباحك.</p>
                <p>4. إذا وجدت دودة (🐛) تخسر الرهان.</p>
                <p>5. يمكنك الضغط على <strong>"سحب الأرباح"</strong> في أي وقت قبل أن تخسر.</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Header Info */}
            <div className="flex justify-between items-center mb-2 bg-gray-900/50 p-2 rounded-lg border border-stone-700 mt-8">
                <div className="text-sm text-gray-400">
                    الصعوبة: <span className={`font-bold ${difficulty === 'easy' ? 'text-green-400' : difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {difficulty === 'easy' ? 'سهل (لغم واحد)' : difficulty === 'medium' ? 'متوسط (لغمين)' : 'صعب (3 ألغام)'}
                    </span>
                </div>
                <div className="text-yellow-300 font-bold flex items-center gap-1">
                    <span>الربح الحالي:</span>
                    <span className="font-mono text-xl">{gameState === 'playing' || gameState === 'cashed_out' ? formatNumber(currentWinnings) : formatNumber(0)}</span>
                </div>
            </div>

            {/* Main Game Area */}
            <div className="flex-grow flex gap-2 min-h-[400px] bg-[#1c1917] rounded-xl border-4 border-[#44403c] p-2 relative overflow-hidden shadow-2xl">
                 {/* Background Texture */}
                 <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>

                 {/* Multipliers Ladder (Left Side) */}
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

                 {/* The Grid */}
                 <div className="flex-grow flex flex-col-reverse justify-evenly gap-1 z-10">
                     {Array.from({ length: ROWS }).map((_, rowIdx) => {
                         const isActiveRow = rowIdx === currentRow && gameState === 'playing';
                         const isPastRow = rowIdx < currentRow;
                         
                         return (
                             <div key={rowIdx} className={`flex gap-2 h-full transition-all duration-300 ${isActiveRow ? 'opacity-100' : 'opacity-60'}`}>
                                 {Array.from({ length: COLS }).map((_, colIdx) => {
                                     const content = getTileContent(rowIdx, colIdx);
                                     const isClicked = history[rowIdx] && history[rowIdx][colIdx] !== undefined && history[rowIdx][colIdx] !== null;
                                     
                                     return (
                                         <button
                                            key={colIdx}
                                            onClick={() => handleTileClick(rowIdx, colIdx)}
                                            disabled={!isActiveRow}
                                            className={`flex-1 rounded-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center relative overflow-hidden
                                                ${isActiveRow 
                                                    ? 'bg-amber-700 border-amber-900 hover:bg-amber-600 cursor-pointer shadow-lg' 
                                                    : isPastRow 
                                                        ? 'bg-stone-800 border-stone-950 cursor-default' 
                                                        : 'bg-stone-700 border-stone-900 cursor-default'}
                                                ${isClicked && history[rowIdx][colIdx] ? 'bg-green-900/80 border-green-950' : ''}
                                                ${isClicked && history[rowIdx][colIdx] === false ? 'bg-red-900/80 border-red-950' : ''}
                                            `}
                                         >
                                             {/* Tile Texture overlay */}
                                             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-30 pointer-events-none"></div>
                                             
                                             <span className="relative z-10 transform transition-transform duration-300 hover:scale-110">
                                                 {content}
                                             </span>
                                         </button>
                                     )
                                 })}
                             </div>
                         )
                     })}
                 </div>
            </div>

            {/* Controls */}
            <div className="mt-2 bg-gray-800 p-3 rounded-xl border border-gray-700">
                {gameState === 'playing' ? (
                    <button 
                        onClick={() => cashOut(false)} 
                        disabled={currentRow === 0}
                        className="w-full py-4 text-2xl font-black bg-gradient-to-r from-green-500 to-emerald-700 rounded-xl text-white shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center leading-none"
                    >
                        <span>سحب الأرباح</span>
                        <span className="text-sm mt-1 opacity-90">{formatNumber(currentWinnings)} 💎</span>
                    </button>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2 bg-gray-900/50 p-1 rounded-lg">
                            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDifficulty(d)}
                                    className={`flex-1 py-2 rounded font-bold text-sm transition-all ${difficulty === d ? 'bg-amber-600 text-white shadow' : 'text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {d === 'easy' ? 'سهل' : d === 'medium' ? 'متوسط' : 'صعب'}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex items-center gap-2">
                             <div className="flex-grow">
                                 <BetControls
                                    bet={bet}
                                    setBet={setBet}
                                    balance={userProfile?.balance ?? 0}
                                    disabled={false}
                                />
                             </div>
                             <button 
                                onClick={initializeGame}
                                className="w-1/3 h-[116px] text-2xl font-black bg-gradient-to-b from-amber-500 to-amber-700 rounded-xl text-white shadow-[0_4px_0_rgb(146,64,14)] active:translate-y-1 active:shadow-none transition-all flex flex-col items-center justify-center"
                             >
                                 <span>لعب</span>
                                 <span className="text-3xl mt-1">▶</span>
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TreasureHuntGame;
