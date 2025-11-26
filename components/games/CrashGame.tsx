
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, CrashGameState } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import { convertTimestamps } from '../utils/convertTimestamps';
import DiamondIcon from '../icons/DiamondIcon';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

interface Parachute {
    id: number;
    x: number;
    y: number;
    startTime: number;
    nickname?: string;
}

const CrashGame: React.FC<Props> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<CrashGameState | null>(null);
    
    // Double Bet State - Default 200
    const [bet1, setBet1] = useState(200);
    const [bet2, setBet2] = useState(200);
    
    const [hasBet1, setHasBet1] = useState(false);
    const [hasBet2, setHasBet2] = useState(false);
    
    const [cashedOut1, setCashedOut1] = useState(false);
    const [cashedOut2, setCashedOut2] = useState(false);

    // Queued Bets for Next Round
    const [queuedBet1, setQueuedBet1] = useState(false);
    const [queuedBet2, setQueuedBet2] = useState(false);
    
    const [currentMultiplier, setCurrentMultiplier] = useState(1.00);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();
    
    // Visual State Refs
    const scrollYRef = useRef(0);
    const lastFrameTimeRef = useRef(Date.now());
    const parachutesRef = useRef<Parachute[]>([]);
    const planeYRef = useRef(0);

    // Actions
    const handleBet = useCallback(async (slot: 1 | 2) => {
        if (!userProfile || !gameState) return;
        
        const amount = slot === 1 ? bet1 : bet2;
        if (amount <= 0 || amount > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            // If it was a queued bet, uncheck it so user can fix amount
            if (slot === 1) setQueuedBet1(false);
            if (slot === 2) setQueuedBet2(false);
            return;
        }

        const success = await onBalanceUpdate(-amount, 'crashGame');
        if (success) {
            if (slot === 1) setHasBet1(true);
            else setHasBet2(true);

            try {
                await runTransaction(db, async (t) => {
                    const ref = doc(db, 'public', 'crashGame');
                    const s = await t.get(ref);
                    if (!s.exists()) throw "Doc missing";
                    
                    const d = s.data() as CrashGameState;
                    // Verify waiting status again inside transaction for safety
                    if (d.status !== 'waiting') {
                        throw "Round Started";
                    }
                    const bets = d.bets || {};
                    
                    // Key structure: UID_SLOT
                    bets[`${userProfile.uid}_${slot}`] = {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        amount: amount,
                        cashedOut: false
                    };
                    t.update(ref, { bets });
                });
                addToast('تم الرهان بنجاح', 'success');
            } catch (e) {
                // Refund if round started or transaction failed
                await onBalanceUpdate(amount, 'crashGame');
                if (slot === 1) setHasBet1(false);
                else setHasBet2(false);
                addToast('انطلقت الطائرة قبل الرهان!', 'error');
            }
        }
    }, [userProfile, gameState, bet1, bet2, onBalanceUpdate, addToast]);

    // Sync with Firestore
    useEffect(() => {
        const docRef = doc(db, 'public', 'crashGame');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as CrashGameState;
                setGameState(data);
                
                // Reset logic on new round
                if (data.status === 'waiting') {
                    if (gameState?.status !== 'waiting') {
                        setHasBet1(false);
                        setHasBet2(false);
                        setCashedOut1(false);
                        setCashedOut2(false);
                        setCurrentMultiplier(1.00);
                        scrollYRef.current = 0;
                        parachutesRef.current = [];
                        
                        // Handle Queued Bets Trigger
                        // We use timeouts to allow state reset to settle
                        if (queuedBet1) {
                            setTimeout(() => { handleBet(1); setQueuedBet1(false); }, 200);
                        }
                        if (queuedBet2) {
                            setTimeout(() => { handleBet(2); setQueuedBet2(false); }, 200);
                        }
                    }
                }
                
                // Restore state if joining mid-game
                if (userProfile && data.bets) {
                    const b1 = data.bets[`${userProfile.uid}_1`];
                    const b2 = data.bets[`${userProfile.uid}_2`];
                    
                    if (b1) {
                        setHasBet1(true);
                        if (b1.cashedOut) setCashedOut1(true);
                    }
                    if (b2) {
                        setHasBet2(true);
                        if (b2.cashedOut) setCashedOut2(true);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [userProfile, gameState?.status, queuedBet1, queuedBet2, handleBet]);

    // Canvas Drawing
    const drawPassengerPlane = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
        ctx.save();
        ctx.translate(x, y);
        
        // Rotate -90 degrees to point Up
        ctx.rotate(-Math.PI / 2);
        
        // Plane Body
        ctx.scale(0.8, 0.8); 

        // Fuselage
        ctx.fillStyle = '#f1f5f9'; // White/Slate-100
        ctx.beginPath();
        ctx.moveTo(-70, 0); // Tail
        ctx.quadraticCurveTo(-40, -15, 40, -15); // Top side
        ctx.quadraticCurveTo(80, 0, 40, 15); // Nose
        ctx.quadraticCurveTo(-40, 15, -70, 0); // Bottom side
        ctx.fill();

        // Tail Fin
        ctx.fillStyle = '#3b82f6'; // Blue
        ctx.beginPath();
        ctx.moveTo(-50, -10);
        ctx.lineTo(-70, -40);
        ctx.lineTo(-80, -10);
        ctx.fill();

        // Main Wing
        ctx.fillStyle = '#94a3b8'; // Slate-400
        ctx.beginPath();
        ctx.moveTo(10, 5);
        ctx.lineTo(-20, 40);
        ctx.lineTo(0, 40);
        ctx.lineTo(40, 5);
        ctx.fill();

        // Cockpit Window
        ctx.fillStyle = '#0ea5e9'; // Sky-500
        ctx.beginPath();
        ctx.moveTo(40, -10);
        ctx.quadraticCurveTo(60, -5, 40, 0);
        ctx.lineTo(40, -10);
        ctx.fill();

        // Windows
        ctx.fillStyle = '#0ea5e9';
        for(let i=0; i<5; i++) {
            ctx.beginPath();
            ctx.arc(-30 + (i*15), -2, 3, 0, Math.PI*2);
            ctx.fill();
        }

        // Engine/Thruster Fire
        if (gameState?.status === 'flying') {
            ctx.fillStyle = `rgba(255, 165, 0, ${0.6 + Math.random() * 0.4})`;
            ctx.beginPath();
            ctx.moveTo(-75, 0);
            ctx.lineTo(-90 - Math.random() * 20, -5);
            ctx.lineTo(-90 - Math.random() * 20, 5);
            ctx.fill();
        }

        ctx.restore();
    };

    const drawParachute = (ctx: CanvasRenderingContext2D, p: Parachute) => {
        ctx.save();
        const elapsed = (Date.now() - p.startTime) / 1000;
        const y = p.y + (elapsed * 80); // Fall down
        const x = p.x - (elapsed * 50); // Drift left/back

        ctx.translate(x, y);
        ctx.scale(0.6, 0.6);

        // Strings
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0); // Person top
        ctx.lineTo(-20, -40);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -45);
        ctx.moveTo(0, 0);
        ctx.lineTo(20, -40);
        ctx.stroke();

        // Canopy
        ctx.fillStyle = '#ef4444'; // Red
        ctx.beginPath();
        ctx.arc(0, -45, 30, Math.PI, 0);
        ctx.lineTo(0, -45);
        ctx.fill();

        // Person
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 10, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    };

    const animate = useCallback(() => {
        if (!canvasRef.current || !gameState) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        const now = Date.now();
        const dt = (now - lastFrameTimeRef.current) / 1000;
        lastFrameTimeRef.current = now;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Physics & Scroll
        let multiplier = 1.00;
        let speed = 0;

        if (gameState.status === 'flying') {
            const elapsed = now - gameState.startTime;
            multiplier = Math.max(1, Math.exp(0.00006 * elapsed));
            setCurrentMultiplier(multiplier);
            speed = 100 + (multiplier * 50); // Speed increases
            scrollYRef.current += speed * dt;
        } else if (gameState.status === 'crashed') {
            multiplier = gameState.crashPoint;
            setCurrentMultiplier(multiplier);
            speed = 0; // Stop scrolling
        } else {
            setCurrentMultiplier(1.00);
            scrollYRef.current = 0;
        }

        // --- Background Ruler ---
        ctx.save();
        const rulerSpacing = 100; // Pixels between numbers
        const scrollOffset = scrollYRef.current % rulerSpacing;
        const totalDistance = scrollYRef.current;

        // Draw grid/ruler
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '12px monospace';
        ctx.lineWidth = 1;

        for (let i = -1; i < height / 20; i++) {
            const y = (i * 20) + (scrollOffset % 20);
            // Horizontal grid lines (faint)
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Major Ruler Numbers
        for (let y = -rulerSpacing; y < height + rulerSpacing; y += rulerSpacing) {
            const drawY = y + scrollOffset;
            const absoluteY = totalDistance + (height - drawY); // Virtual height
            const value = Math.floor(absoluteY / 10); // Scale down

            if (value >= 0) {
                ctx.fillText(`${value}m`, width - 40, drawY);
                ctx.beginPath();
                ctx.moveTo(width - 50, drawY);
                ctx.lineTo(width, drawY);
                ctx.stroke();
            }
        }
        ctx.restore();

        // --- Plane ---
        const planeX = width / 2;
        const targetY = height / 2;
        const startY = height - 100;
        let planeY = startY;
        
        if (gameState.status === 'flying' || gameState.status === 'crashed') {
            const ascentProgress = Math.min(1, scrollYRef.current / 500); 
            planeY = startY - (startY - targetY) * ascentProgress;
            planeY += Math.sin(now / 300) * 5; // Hover
        }
        planeYRef.current = planeY;

        if (gameState.status !== 'crashed') {
            drawPassengerPlane(ctx, planeX, planeY);
        } else {
            // CRASH Text
            ctx.save();
            ctx.translate(planeX, planeY);
            ctx.fillStyle = '#ef4444';
            ctx.font = '900 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 15;
            ctx.fillText("CRASH", 0, 0);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.strokeText("CRASH", 0, 0);
            ctx.restore();
        }

        // --- Parachutes ---
        parachutesRef.current = parachutesRef.current.filter(p => (Date.now() - p.startTime) < 3000); 
        parachutesRef.current.forEach(p => drawParachute(ctx, p));

        // --- Multiplier HUD ---
        ctx.save();
        ctx.translate(width / 2, height / 4);
        ctx.fillStyle = gameState.status === 'crashed' ? '#ef4444' : '#fff';
        ctx.font = 'bold 56px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.fillText(`${multiplier.toFixed(2)}x`, 0, 0);
        
        if (gameState.status === 'waiting') {
            const timeLeft = Math.max(0, Math.ceil((gameState.endTime - now) / 1000));
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(`إقلاع خلال ${timeLeft}ث`, 0, 40);
            
            // Progress bar for waiting
            const totalWait = 10000; // 10s
            const remaining = Math.max(0, gameState.endTime - now);
            const barWidth = 200;
            const progress = (remaining / totalWait) * barWidth;
            
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(-barWidth/2, 60, barWidth, 4);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-barWidth/2, 60, progress, 4);
        }
        ctx.restore();

        requestRef.current = requestAnimationFrame(animate);
    }, [gameState]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => { if(requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [animate]);

    useEffect(() => {
        if (canvasRef.current && canvasRef.current.parentElement) {
            const parent = canvasRef.current.parentElement;
            canvasRef.current.width = parent.clientWidth;
            canvasRef.current.height = 400; 
        }
    }, []);

    const handleCashOut = async (slot: 1 | 2) => {
        if (!gameState || gameState.status !== 'flying') return;
        const hasBet = slot === 1 ? hasBet1 : hasBet2;
        const isCashed = slot === 1 ? cashedOut1 : cashedOut2;
        const amount = slot === 1 ? bet1 : bet2;

        if (!hasBet || isCashed) return;

        const multiplier = currentMultiplier;
        const winnings = Math.floor(amount * multiplier);

        // Add parachute visual
        if (canvasRef.current) {
            parachutesRef.current.push({
                id: Date.now(),
                x: canvasRef.current.width / 2,
                y: planeYRef.current,
                startTime: Date.now()
            });
        }

        if (slot === 1) setCashedOut1(true);
        else setCashedOut2(true);

        const success = await onBalanceUpdate(winnings, 'crashGame');
        if (success) {
            addToast(`سحب ناجح! ربحت ${formatNumber(winnings)}`, 'success');
            if (winnings > 10000 && userProfile.displayName) {
                onAnnounceWin(userProfile.displayName, winnings, 'crashGame');
            }

            // Sync DB
            await runTransaction(db, async (t) => {
                const ref = doc(db, 'public', 'crashGame');
                const s = await t.get(ref);
                const d = s.data() as CrashGameState;
                const bets = d.bets || {};
                const key = `${userProfile.uid}_${slot}`;
                if (bets[key]) {
                    bets[key].cashedOut = true;
                    bets[key].cashOutPoint = multiplier;
                    bets[key].winAmount = winnings;
                    t.update(ref, { bets });
                }
            });
        }
    };

    const toggleQueue = (slot: 1 | 2) => {
        if (slot === 1) setQueuedBet1(!queuedBet1);
        else setQueuedBet2(!queuedBet2);
    }

    const updateBetAmount = (slot: 1 | 2, addAmount: number) => {
        if (slot === 1) setBet1(prev => prev + addAmount);
        else setBet2(prev => prev + addAmount);
    }

    return (
        <div className="flex flex-col h-full bg-[#0f172a] relative overflow-hidden">
            
            {/* Canvas */}
            <div className="flex-grow relative w-full">
                <canvas ref={canvasRef} className="w-full h-full block" />
            </div>

            {/* Controls Container - Dual Bet System */}
            <div className="p-2 bg-[#1e293b] border-t border-gray-700 z-20">
                <div className="flex gap-2 w-full max-w-3xl mx-auto">
                    
                    {/* Bet Control 1 */}
                    <div className="flex-1 bg-[#0f172a] rounded-xl p-2 border border-gray-700 flex flex-col gap-2">
                        {!hasBet1 || gameState?.status === 'waiting' || cashedOut1 || (gameState?.status === 'crashed' && hasBet1) ? (
                            <>
                                <div className="flex items-center bg-[#1e293b] rounded-lg px-2 py-1 border border-gray-600">
                                    <input 
                                        type="number" 
                                        value={bet1} 
                                        onChange={(e) => setBet1(Number(e.target.value))} 
                                        className="w-full bg-transparent text-white font-bold outline-none text-center"
                                        disabled={queuedBet1}
                                    />
                                    <DiamondIcon className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => updateBetAmount(1, 200)} disabled={queuedBet1} className="flex-1 bg-gray-700 text-xs rounded py-1 text-gray-300 hover:bg-gray-600 font-bold">+200</button>
                                    <button onClick={() => updateBetAmount(1, 500)} disabled={queuedBet1} className="flex-1 bg-gray-700 text-xs rounded py-1 text-gray-300 hover:bg-gray-600 font-bold">+500</button>
                                    <button onClick={() => updateBetAmount(1, 1000)} disabled={queuedBet1} className="flex-1 bg-gray-700 text-xs rounded py-1 text-gray-300 hover:bg-gray-600 font-bold">+1000</button>
                                </div>
                                {gameState?.status === 'waiting' ? (
                                    <button 
                                        onClick={() => handleBet(1)}
                                        disabled={hasBet1}
                                        className={`w-full py-2 rounded-lg font-bold text-white transition shadow-lg ${hasBet1 ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'}`}
                                    >
                                        {hasBet1 ? 'تم الرهان' : 'رهان'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => toggleQueue(1)}
                                        className={`w-full py-2 rounded-lg font-bold text-white transition shadow-lg ${queuedBet1 ? 'bg-red-600 hover:bg-red-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}
                                    >
                                        {queuedBet1 ? 'إلغاء الرهان التالي' : 'رهان للجولة القادمة'}
                                    </button>
                                )}
                            </>
                        ) : (
                            <button 
                                onClick={() => handleCashOut(1)}
                                disabled={cashedOut1 || gameState?.status !== 'flying'}
                                className={`w-full h-full flex flex-col items-center justify-center rounded-xl font-bold transition shadow-lg py-2
                                    ${cashedOut1 
                                        ? 'bg-gray-700 text-gray-400 cursor-default' 
                                        : gameState?.status === 'crashed' 
                                            ? 'bg-red-900 text-red-300'
                                            : 'bg-yellow-500 hover:bg-yellow-400 text-black animate-pulse'}
                                `}
                            >
                                {cashedOut1 ? <span>تم السحب ✅</span> : 
                                 gameState?.status === 'crashed' ? <span>💥</span> : 
                                 <>
                                    <span className="text-lg">سحب</span>
                                    <span className="text-sm font-mono">{formatNumber(Math.floor(bet1 * currentMultiplier))}</span>
                                 </>}
                            </button>
                        )}
                    </div>

                    {/* Bet Control 2 */}
                    <div className="flex-1 bg-[#0f172a] rounded-xl p-2 border border-gray-700 flex flex-col gap-2">
                        {!hasBet2 || gameState?.status === 'waiting' || cashedOut2 || (gameState?.status === 'crashed' && hasBet2) ? (
                            <>
                                <div className="flex items-center bg-[#1e293b] rounded-lg px-2 py-1 border border-gray-600">
                                    <input 
                                        type="number" 
                                        value={bet2} 
                                        onChange={(e) => setBet2(Number(e.target.value))} 
                                        className="w-full bg-transparent text-white font-bold outline-none text-center"
                                        disabled={queuedBet2}
                                    />
                                    <DiamondIcon className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => updateBetAmount(2, 200)} disabled={queuedBet2} className="flex-1 bg-gray-700 text-xs rounded py-1 text-gray-300 hover:bg-gray-600 font-bold">+200</button>
                                    <button onClick={() => updateBetAmount(2, 500)} disabled={queuedBet2} className="flex-1 bg-gray-700 text-xs rounded py-1 text-gray-300 hover:bg-gray-600 font-bold">+500</button>
                                    <button onClick={() => updateBetAmount(2, 1000)} disabled={queuedBet2} className="flex-1 bg-gray-700 text-xs rounded py-1 text-gray-300 hover:bg-gray-600 font-bold">+1000</button>
                                </div>
                                {gameState?.status === 'waiting' ? (
                                    <button 
                                        onClick={() => handleBet(2)}
                                        disabled={hasBet2}
                                        className={`w-full py-2 rounded-lg font-bold text-white transition shadow-lg ${hasBet2 ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'}`}
                                    >
                                        {hasBet2 ? 'تم الرهان' : 'رهان'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => toggleQueue(2)}
                                        className={`w-full py-2 rounded-lg font-bold text-white transition shadow-lg ${queuedBet2 ? 'bg-red-600 hover:bg-red-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}
                                    >
                                        {queuedBet2 ? 'إلغاء الرهان التالي' : 'رهان للجولة القادمة'}
                                    </button>
                                )}
                            </>
                        ) : (
                            <button 
                                onClick={() => handleCashOut(2)}
                                disabled={cashedOut2 || gameState?.status !== 'flying'}
                                className={`w-full h-full flex flex-col items-center justify-center rounded-xl font-bold transition shadow-lg py-2
                                    ${cashedOut2 
                                        ? 'bg-gray-700 text-gray-400 cursor-default' 
                                        : gameState?.status === 'crashed' 
                                            ? 'bg-red-900 text-red-300'
                                            : 'bg-yellow-500 hover:bg-yellow-400 text-black animate-pulse'}
                                `}
                            >
                                {cashedOut2 ? <span>تم السحب ✅</span> : 
                                 gameState?.status === 'crashed' ? <span>💥</span> : 
                                 <>
                                    <span className="text-lg">سحب</span>
                                    <span className="text-sm font-mono">{formatNumber(Math.floor(bet2 * currentMultiplier))}</span>
                                 </>}
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CrashGame;
