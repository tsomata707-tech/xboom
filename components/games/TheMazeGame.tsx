
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, TheMazeGameState } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { convertTimestamps } from '../utils/convertTimestamps';
import MazeIcon from '../icons/MazeIcon';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const TheMazeGame: React.FC<Props> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<TheMazeGameState | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    
    // Local State
    const [bet, setBet] = useState(100);
    const [selectedDoor, setSelectedDoor] = useState<number | null>(null);
    const [hasBet, setHasBet] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [winMessage, setWinMessage] = useState<string | null>(null);
    
    // Visual Animation
    const [flowProgress, setFlowProgress] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- 1. Sync with Firestore ---
    useEffect(() => {
        const docRef = doc(db, 'public', 'theMaze');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as TheMazeGameState;
                setGameState(data);

                // Reset State on new round
                if (data.status === 'betting') {
                    if (gameState?.status !== 'betting') {
                        setHasBet(false);
                        setSelectedDoor(null);
                        setWinMessage(null);
                        setShowConfetti(false);
                        setFlowProgress(0);
                    }
                } 
                else if (data.status === 'running') {
                    // Start Animation
                    if (flowProgress === 0) {
                        let p = 0;
                        const interval = setInterval(() => {
                            p += 1.5; // Speed of flow
                            setFlowProgress(prev => Math.min(prev + 1.5, 100));
                            if (p >= 100) clearInterval(interval);
                        }, 30); 
                    }
                }
                else if (data.status === 'result') {
                    setFlowProgress(100);
                    if (hasBet && userProfile) {
                        const myWin = data.lastRoundWinners?.find(w => w.nickname === userProfile.displayName);
                        if (myWin) {
                            setWinMessage(`🎉 +${formatNumber(myWin.amount)}`);
                            setShowConfetti(true);
                            if (myWin.amount > 10000) {
                                onAnnounceWin(userProfile.displayName || '', myWin.amount, 'theMaze');
                            }
                        } else {
                            setWinMessage("حظ أوفر (X0)");
                        }
                    }
                }
            } else {
                // Fallback init
                setDoc(docRef, {
                    status: 'betting',
                    roundId: 1,
                    endTime: Date.now() + 15000,
                    pathMap: [],
                    outcomeValues: [],
                    bets: {},
                    lastRoundWinners: []
                });
            }
        });

        // Timer
        const timer = setInterval(() => {
            if (gameState?.endTime) {
                const diff = Math.max(0, Math.ceil((gameState.endTime - Date.now()) / 1000));
                setTimeLeft(diff);
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(timer);
        };
    }, [gameState?.status, gameState?.endTime, hasBet, userProfile]);

    // --- 2. Bet Handling ---
    const handleDoorSelect = async (doorIndex: number) => {
        if (!gameState || gameState.status !== 'betting') return;
        if (hasBet) {
            addToast('لقد اخترت باباً بالفعل.', 'info');
            return;
        }
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'theMaze');
        if (success) {
            setHasBet(true);
            setSelectedDoor(doorIndex);
            
            try {
                await runTransaction(db, async (t) => {
                    const ref = doc(db, 'public', 'theMaze');
                    const s = await t.get(ref);
                    const d = s.data() as TheMazeGameState;
                    if (d.status !== 'betting') throw "closed";
                    
                    const bets = d.bets || {};
                    bets[userProfile.uid] = {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        amount: bet,
                        doorIndex: doorIndex
                    };
                    t.update(ref, { bets });
                });
                addToast(`تم اختيار الباب ${doorIndex + 1}`, 'success');
            } catch (e) {
                await onBalanceUpdate(bet, 'theMaze');
                setHasBet(false);
                setSelectedDoor(null);
                addToast('فشل الرهان (انتهى الوقت)', 'error');
            }
        }
    };

    // --- 3. Visuals (SVG Paths) ---
    const getPaths = () => {
        // We need to map 10 inputs to 10 outputs based on gameState.pathMap
        // Use a default map if waiting or data incomplete
        const map = gameState?.pathMap && gameState.pathMap.length === 10 
            ? gameState.pathMap 
            : [0,1,2,3,4,5,6,7,8,9]; 

        return map.map((outputIdx, inputIdx) => {
            const isSelected = selectedDoor === inputIdx;
            const isResult = gameState?.status === 'result';
            
            // Colors & Styles
            let strokeColor = '#334155'; // Default Slate-700
            let opacity = 0.2;
            let width = 1.5;

            if (isSelected) {
                strokeColor = '#22d3ee'; // Cyan
                opacity = 0.8;
                width = 3;
            } else if (isResult) {
                // Fade out others significantly in result
                opacity = 0.05;
            }

            // Coordinate Calculation (Percentages)
            // Centers of 10 equal grid rows are at 5%, 15%, ..., 95%
            const startY = 5 + (inputIdx * 10); 
            const endY = 5 + (outputIdx * 10);

            // Tangled Path Logic:
            // All paths converge towards the center area (50, 50) but with control points
            // that create a "knot" effect behind the central card.
            
            // Control Points
            const cp1x = 35; // Pull towards center left
            const cp2x = 65; // Pull towards center right
            
            // Chaos Factor: Jitter the 'through' point so they don't all overlap perfectly
            // Deterministic pseudo-random based on index
            const midY = 30 + ((inputIdx * 13) % 40); 
            
            const d = `M 0 ${startY} C ${cp1x} ${startY}, 40 ${midY}, 50 50 S ${cp2x} ${endY}, 100 ${endY}`;

            return (
                <path
                    key={`path-${inputIdx}`}
                    d={d}
                    stroke={strokeColor}
                    strokeWidth={width}
                    fill="none"
                    opacity={opacity}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                />
            );
        });
    };

    // Flow Animation Path for Selected Door
    const getSelectedPathD = () => {
        if (selectedDoor === null) return '';
        const map = gameState?.pathMap && gameState.pathMap.length === 10 
            ? gameState.pathMap 
            : [0,1,2,3,4,5,6,7,8,9];
            
        const inputIdx = selectedDoor;
        const outputIdx = map[inputIdx];
        
        const startY = 5 + (inputIdx * 10);
        const endY = 5 + (outputIdx * 10);
        const cp1x = 35;
        const cp2x = 65;
        const midY = 30 + ((inputIdx * 13) % 40); 

        return `M 0 ${startY} C ${cp1x} ${startY}, 40 ${midY}, 50 50 S ${cp2x} ${endY}, 100 ${endY}`;
    };

    return (
        <div className="flex flex-col h-full bg-[#0f172a] relative overflow-hidden">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Top Header Status */}
            <div className="flex justify-between items-center p-2 bg-gray-800/80 backdrop-blur-sm z-20 border-b border-gray-700 shadow-md">
                <div className="flex items-center gap-2">
                    <MazeIcon className="w-5 h-5 text-cyan-400"/>
                    <div className="text-xs text-gray-300 font-bold">
                        المتاهة <span className="text-gray-500 text-[10px]">#{gameState?.roundId}</span>
                    </div>
                </div>
                <div className={`text-xs font-bold px-3 py-1 rounded-full ${gameState?.status === 'betting' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                    {gameState?.status === 'betting' ? 'مفتوح للرهان' : gameState?.status === 'running' ? 'جاري التشغيل...' : 'النتائج'}
                </div>
            </div>

            {/* Main Game Area */}
            <div className="flex-grow flex relative w-full h-full overflow-hidden" ref={containerRef}>
                
                {/* Left Column: Doors (Inputs) - Using GRID for even spacing */}
                <div className="w-16 sm:w-20 bg-[#1e293b] border-r border-gray-700 z-20 shadow-2xl grid grid-rows-10 h-full relative">
                    {/* Decorative Pipe Headers */}
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/20"></div>
                    
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-full h-full flex items-center justify-center p-1">
                            <button
                                onClick={() => handleDoorSelect(i)}
                                disabled={gameState?.status !== 'betting' || hasBet}
                                className={`
                                    w-full h-full max-h-[90%] rounded-lg flex flex-col items-center justify-center transition-all relative group border-2
                                    ${selectedDoor === i 
                                        ? 'bg-cyan-600 border-cyan-300 shadow-[0_0_15px_cyan] z-30 scale-105' 
                                        : 'bg-slate-800 border-slate-600 hover:border-slate-400'}
                                    disabled:opacity-90 disabled:cursor-not-allowed
                                `}
                            >
                                <span className="text-lg sm:text-xl">🚪</span>
                                <span className="text-[8px] text-gray-300 font-mono font-bold">{i+1}</span>
                                
                                {/* Connection Point */}
                                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2 h-3 bg-gray-500 rounded-r-sm"></div>
                                
                                {selectedDoor === i && (
                                    <div className="absolute inset-0 rounded-lg ring-2 ring-white/50 animate-pulse"></div>
                                )}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Center: Maze SVG Layer */}
                <div className="flex-grow relative bg-[#0f172a] overflow-hidden">
                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-10" 
                         style={{backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                    </div>

                    <svg 
                        className="w-full h-full absolute inset-0 pointer-events-none" 
                        viewBox="0 0 100 100" 
                        preserveAspectRatio="none"
                    >
                        {/* Base Paths */}
                        {getPaths()}

                        {/* Active Flow Path */}
                        {(gameState?.status === 'running' || gameState?.status === 'result') && selectedDoor !== null && (
                            <>
                                {/* Glow Path */}
                                <path 
                                    d={getSelectedPathD()} 
                                    stroke="#22d3ee"
                                    strokeWidth="6"
                                    fill="none"
                                    strokeOpacity="0.3"
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                    filter="blur(4px)"
                                />
                                {/* Animated Path */}
                                <path 
                                    d={getSelectedPathD()} 
                                    stroke="#fff"
                                    strokeWidth="3"
                                    fill="none"
                                    strokeDasharray="100"
                                    strokeDashoffset={100 - flowProgress}
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                />
                            </>
                        )}
                    </svg>

                    {/* Center Card (Mixing Chamber) */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                        <div className="w-40 h-40 rounded-full bg-gray-900/95 backdrop-blur-xl border-[3px] border-cyan-500/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center relative overflow-hidden">
                            
                            {/* Rotating Border Effect */}
                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/20 animate-[spin_10s_linear_infinite]"></div>
                            
                            {gameState?.status === 'betting' ? (
                                <>
                                    <div className="text-cyan-400 text-4xl font-black font-mono mb-1 animate-pulse">
                                        {timeLeft}<span className="text-sm">s</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">ضع رهانك</div>
                                </>
                            ) : gameState?.status === 'running' ? (
                                <>
                                    <div className="text-4xl animate-spin mb-2">🌀</div>
                                    <div className="text-xs text-cyan-400 font-bold animate-pulse">جاري الخلط...</div>
                                </>
                            ) : (
                                <>
                                    <div className="text-4xl mb-1">🏆</div>
                                    <div className="text-center px-2">
                                        {winMessage ? (
                                            <span className={`font-black text-lg ${winMessage.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{winMessage}</span>
                                        ) : (
                                            <span className="text-gray-400 text-xs font-bold">انتهت الجولة</span>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Outputs (Multipliers) - Using GRID for even spacing */}
                <div className="w-20 sm:w-24 bg-[#1e293b] border-l border-gray-700 z-20 shadow-2xl grid grid-rows-10 h-full relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/20"></div>

                    {Array.from({ length: 10 }).map((_, i) => {
                        const value = gameState?.outcomeValues?.[i] || 0;
                        const isRevealed = gameState?.status === 'result';
                        
                        // Check if this output is the destination of the selected door
                        // Note: pathMap[input] = output
                        const isMyDestination = gameState?.pathMap?.[selectedDoor ?? -1] === i;
                        
                        return (
                            <div key={i} className="w-full h-full flex items-center justify-center p-1">
                                <div 
                                    className={`
                                        w-full h-full max-h-[90%] rounded-lg flex items-center justify-center transition-all border-2 relative overflow-hidden
                                        ${isRevealed 
                                            ? (value > 0 
                                                ? (isMyDestination ? 'bg-green-600 border-green-300 scale-110 shadow-[0_0_20px_green] z-30' : 'bg-gray-800 border-green-800/50') 
                                                : (isMyDestination ? 'bg-red-600 border-red-300 scale-110 shadow-[0_0_20px_red] z-30' : 'bg-gray-800 border-gray-700')
                                              )
                                            : 'bg-slate-800 border-slate-600 text-gray-600'
                                        }
                                    `}
                                >
                                    {/* Connection Point */}
                                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2 h-3 bg-gray-500 rounded-l-sm"></div>

                                    {isRevealed ? (
                                        <span className={`font-black font-mono ${value > 0 ? 'text-white text-lg' : 'text-gray-500 text-sm'}`}>
                                            {value > 0 ? `x${value}` : 'x0'}
                                        </span>
                                    ) : (
                                        <span className="text-xl opacity-20">?</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Betting Controls (Fixed Bottom) */}
            <div className="bg-gray-900/95 p-3 border-t border-cyan-900/30 z-30 backdrop-blur-md shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
                <div className="max-w-lg mx-auto">
                    <BetControls 
                        bet={bet} 
                        setBet={setBet} 
                        balance={userProfile.balance} 
                        disabled={gameState?.status !== 'betting' || hasBet} 
                    />
                    {hasBet && (
                        <p className="text-center text-green-400 text-xs mt-2 font-bold animate-pulse">
                            تم تسجيل رهانك! انتظر النتيجة...
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TheMazeGame;
