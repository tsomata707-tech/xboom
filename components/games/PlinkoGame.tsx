
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, PlinkoGameState } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import BetControls from '../BetControls';
import { convertTimestamps } from '../utils/convertTimestamps';

interface UserProfile extends AppUser {
    balance: number;
}

interface PlinkoGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// Physics Constants
const BALL_RADIUS = 6; // Slightly bigger ball
const GRAVITY = 0.3; // Gravity
const BAR_WIDTH = 30;
const BAR_HEIGHT = 8;
const BAR_GAP = 60; // Increased gap to reduce clutter
const ROW_HEIGHT = 50; // Vertical space
const BAR_SPEED = 1.5; // Speed of horizontal movement

// Color Config for Results
const RESULT_COLORS: Record<number, string> = {
    0: '#374151', // Gray
    1: '#3b82f6', // Blue
    1.5: '#a855f7', // Purple
    10: '#facc15', // Yellow
    45: '#ef4444', // Red
};

const PlinkoGame: React.FC<PlinkoGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<PlinkoGameState | null>(null);
    const [bet, setBet] = useState(100);
    const [ballCount, setBallCount] = useState<1 | 2 | 3>(1);
    const [hasBet, setHasBet] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [winMessage, setWinMessage] = useState<string | null>(null);
    
    // Canvas Physics Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();
    
    // Local Physics State
    // Balls: Array of objects { x, y, vx, vy, active, settled }
    const ballsRef = useRef<any[]>([]);
    const showMultipliersRef = useRef(false); // Flag to reveal numbers
    const roundMultipliersRef = useRef<number[]>(Array(9).fill(0)); // Current round values

    // 1. Sync State
    useEffect(() => {
        const docRef = doc(db, 'public', 'plinko');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as PlinkoGameState;
                setGameState(data);

                if (data.status === 'betting') {
                    setHasBet(false);
                    setWinMessage(null);
                    setShowConfetti(false);
                    ballsRef.current = [];
                    showMultipliersRef.current = false;
                    roundMultipliersRef.current = Array(9).fill(0); // Reset visually
                } else if (data.status === 'dropping') {
                    // Set the multipliers for this round
                    if (data.currentMultipliers && data.currentMultipliers.length > 0) {
                        roundMultipliersRef.current = data.currentMultipliers;
                    }
                    
                    // Spawn balls if we bet and haven't spawned yet
                    if (hasBet && ballsRef.current.length === 0) {
                        spawnBalls(ballCount);
                    }
                } else if (data.status === 'result') {
                    // End of round: Show result
                    if (hasBet) {
                        const myWin = data.lastRoundWinners?.find(w => w.nickname === userProfile?.displayName);
                        if (myWin) {
                            if (myWin.amount > 0) {
                                setWinMessage(`+${formatNumber(myWin.amount)}`);
                                setShowConfetti(true);
                            } else {
                                setWinMessage("حظ أوفر");
                            }
                        } else {
                            setWinMessage("حظ أوفر");
                        }
                    }
                }
            }
        });

        // Timer
        const timer = setInterval(() => {
            if (gameState?.endTime) {
                const diff = Math.ceil((gameState.endTime - Date.now()) / 1000);
                setTimeLeft(Math.max(0, diff));
            }
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(timer);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gameState?.status, gameState?.endTime, hasBet, ballCount, userProfile]);

    const spawnBalls = (count: number) => {
        if (!canvasRef.current) return;
        const width = canvasRef.current.width;
        
        const newBalls = [];
        for (let i = 0; i < count; i++) {
            newBalls.push({
                x: width / 2 + (Math.random() - 0.5) * 40, // Start near center with slight randomness
                y: -20 - (i * 100), // Stagger drop height
                vx: (Math.random() - 0.5) * 1.5, // Slight random initial velocity
                vy: 0,
                active: true,
                settled: false
            });
        }
        ballsRef.current = newBalls;
    };

    const handleBet = async () => {
        if (!userProfile || !gameState) return;
        if (gameState.status !== 'betting') {
            addToast('انتظر الجولة القادمة', 'info');
            return;
        }
        
        const totalCost = bet * ballCount;
        
        if (totalCost > userProfile.balance) {
            addToast(`رصيد غير كاف (${formatNumber(totalCost)})`, 'error');
            return;
        }

        // Deduct immediately
        const success = await onBalanceUpdate(-totalCost, 'plinko');
        if (success) {
            setHasBet(true);
            try {
                await runTransaction(db, async (t) => {
                    const ref = doc(db, 'public', 'plinko');
                    const s = await t.get(ref);
                    const d = s.data() as PlinkoGameState;
                    if (d.status !== 'betting') throw "closed";
                    
                    const bets = d.bets || {};
                    bets[userProfile.uid] = {
                        userId: userProfile.uid,
                        nickname: userProfile.displayName || 'Player',
                        amount: bet, // Base bet per ball
                        ballCount: ballCount
                    };
                    t.update(ref, { bets });
                });
                addToast('تم الرهان', 'success');
            } catch (e) {
                // Refund if failed
                await onBalanceUpdate(totalCost, 'plinko');
                setHasBet(false);
                addToast('فشل الرهان (انتهى الوقت)', 'error');
            }
        }
    };

    // --- Physics Loop ---
    const updatePhysics = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const width = canvas.width;
        const height = canvas.height;
        
        const now = Date.now();

        ballsRef.current.forEach(b => {
            if (!b.active || b.settled) return;

            // Gravity application
            b.vy += GRAVITY;
            b.x += b.vx;
            b.y += b.vy;

            // Wall Bounce
            if (b.x < BALL_RADIUS) { b.x = BALL_RADIUS; b.vx *= -0.5; }
            if (b.x > width - BALL_RADIUS) { b.x = width - BALL_RADIUS; b.vx *= -0.5; }

            // Obstacle Interaction
            // Generate obstacle positions on the fly based on current time
            const rows = 8;
            for (let r = 0; r < rows; r++) {
                const rowY = 80 + r * ROW_HEIGHT;
                
                // Simple optimization: Only check collision if ball is near this row's Y
                if (Math.abs(b.y - rowY) > 20) continue;

                const direction = r % 2 === 0 ? 1 : -1;
                // Oscillation logic
                const shift = Math.sin(now / 1000 * BAR_SPEED) * 30 * direction; 
                const rowOffsetX = (width / 2) + shift; 
                
                // Check obstacles in this row
                const totalSpace = BAR_WIDTH + BAR_GAP;
                // Determine start index to cover visible area
                const startIdx = -Math.floor(width / totalSpace);
                const endIdx = Math.ceil(width / totalSpace);

                for (let i = startIdx; i <= endIdx; i++) {
                    const barX = rowOffsetX + (i * totalSpace);
                    
                    // AABB Collision
                    if (b.y + BALL_RADIUS > rowY && b.y - BALL_RADIUS < rowY + BAR_HEIGHT &&
                        b.x + BALL_RADIUS > barX && b.x - BALL_RADIUS < barX + BAR_WIDTH) {
                        
                        // Hit! Bounce
                        // Determine if hitting top/bottom or sides
                        if (b.y < rowY + (BAR_HEIGHT / 2)) {
                            // Top hit
                            b.y = rowY - BALL_RADIUS;
                            b.vy *= -0.4; // Dampen bounce
                            b.vx += (Math.random() - 0.5) * 2; // Add chaos
                        } else {
                            // Side hit logic simplified: push away
                            if (b.x < barX + BAR_WIDTH/2) {
                                b.x = barX - BALL_RADIUS;
                                b.vx = -Math.abs(b.vx) - 0.5;
                            } else {
                                b.x = barX + BAR_WIDTH + BALL_RADIUS;
                                b.vx = Math.abs(b.vx) + 0.5;
                            }
                        }
                    }
                }
            }

            // Check Reveal Trigger (Halfway down)
            if (b.y > height / 2 && !showMultipliersRef.current) {
                showMultipliersRef.current = true;
            }

            // Floor Logic
            if (b.y > height - 50) {
                b.settled = true;
                b.y = height - 30; 
                b.vy = 0;
                b.vx = 0;
                // Snap to bucket center roughly
                const bucketCount = 9;
                const bucketW = width / bucketCount;
                const idx = Math.floor(b.x / bucketW);
                b.x = (idx * bucketW) + (bucketW / 2);
            }
        });

    }, []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const now = Date.now();

        // Clear
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Buckets (Bottom)
        const bucketCount = 9;
        const bucketWidth = width / bucketCount;
        const bucketY = height - 40;
        const bucketHeight = 40;
        const multipliers = roundMultipliersRef.current;

        for (let i = 0; i < bucketCount; i++) {
            const x = i * bucketWidth;
            const val = multipliers[i];
            
            // Bucket Style
            const color = showMultipliersRef.current ? (RESULT_COLORS[val] || '#374151') : '#374151';
            ctx.fillStyle = color;
            ctx.fillRect(x + 2, bucketY, bucketWidth - 4, bucketHeight);
            
            // Text
            if (showMultipliersRef.current) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${val}x`, x + bucketWidth/2, bucketY + bucketHeight/2);
            } else {
                ctx.fillStyle = '#6b7280';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("?", x + bucketWidth/2, bucketY + bucketHeight/2);
            }
        }

        // 2. Draw Moving Obstacles (Neon Lines)
        ctx.shadowBlur = 10;
        
        const rows = 8;
        for (let r = 0; r < rows; r++) {
            const y = 80 + r * ROW_HEIGHT;
            const direction = r % 2 === 0 ? 1 : -1;
            const shift = Math.sin(now / 1000 * BAR_SPEED) * 30 * direction;
            const rowOffsetX = (width / 2) + shift;
            
            const totalSpace = BAR_WIDTH + BAR_GAP;
            const startIdx = -Math.floor(width / totalSpace) - 1;
            const endIdx = Math.ceil(width / totalSpace) + 1;

            // Color alternates
            ctx.fillStyle = r % 2 === 0 ? '#06b6d4' : '#8b5cf6'; // Cyan / Purple
            ctx.shadowColor = r % 2 === 0 ? '#06b6d4' : '#8b5cf6';

            for (let i = startIdx; i <= endIdx; i++) {
                const x = rowOffsetX + (i * totalSpace);
                ctx.beginPath();
                ctx.roundRect(x, y, BAR_WIDTH, BAR_HEIGHT, 4);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0; // Reset

        // 3. Draw Balls (Bright White/Gold)
        for (const b of ballsRef.current) {
            if (!b.active) continue;
            
            ctx.beginPath();
            ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffffff';
            ctx.fill();
            
            // Inner Core
            ctx.beginPath();
            ctx.arc(b.x, b.y, BALL_RADIUS * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24'; // Gold center
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }

    }, []);

    const loop = useCallback(() => {
        updatePhysics();
        draw();
        requestRef.current = requestAnimationFrame(loop);
    }, [draw, updatePhysics]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(loop);
        return () => { if(requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [loop]);

    useEffect(() => {
        if (canvasRef.current && canvasRef.current.parentElement) {
            canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
            canvasRef.current.height = 500; // Fixed height
        }
    }, []);

    return (
        <div className="flex flex-col h-full w-full bg-[#0f172a] relative">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Header */}
            <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-gray-800/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <div>
                        <h2 className="font-black text-white tracking-wide">BLANCO</h2>
                        <p className="text-[10px] text-gray-400">Classic Physics</p>
                    </div>
                </div>
                <div className={`px-4 py-1 rounded-full font-mono font-bold border ${gameState?.status === 'betting' ? 'bg-green-900/50 text-green-400 border-green-500' : 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                    {gameState?.status === 'betting' ? `راهن ${timeLeft}s` : 'جاري اللعب'}
                </div>
            </div>

            {/* Canvas Container */}
            <div className="flex-grow w-full relative overflow-hidden bg-gradient-to-b from-[#0f172a] to-[#1e1b4b]">
                <canvas ref={canvasRef} className="w-full h-full block" />
                
                {/* Win Popup Overlay */}
                {winMessage && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 animate-bounce-in">
                        <div className="bg-black/80 backdrop-blur-sm px-8 py-4 rounded-2xl border-2 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)] text-center">
                            <p className="text-sm text-gray-300 font-bold uppercase mb-1">Result</p>
                            <p className={`text-4xl font-black ${winMessage.includes('+') ? 'text-green-400' : 'text-white'}`}>{winMessage}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="p-4 bg-gray-800 border-t border-gray-700 z-10">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Balls</span>
                    <div className="flex gap-2 bg-gray-900 p-1 rounded-lg">
                        {[1, 2, 3].map(num => (
                            <button
                                key={num}
                                onClick={() => setBallCount(num as 1|2|3)}
                                disabled={hasBet || gameState?.status !== 'betting'}
                                className={`w-10 h-8 rounded-md font-bold text-sm transition-all ${ballCount === num ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                </div>

                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={gameState?.status !== 'betting' || hasBet} />
                
                <button 
                    onClick={handleBet}
                    disabled={gameState?.status !== 'betting' || hasBet}
                    className={`w-full mt-3 py-4 rounded-xl text-xl font-black transition-all transform active:scale-95 ${hasBet ? 'bg-gray-600 text-gray-400 cursor-default' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)]'}`}
                >
                    {hasBet ? 'تم الرهان ✅' : `إسقاط (${formatNumber(bet * ballCount)})`}
                </button>
            </div>
        </div>
    );
};

export default PlinkoGame;
