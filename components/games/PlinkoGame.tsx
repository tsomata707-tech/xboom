
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface PlinkoGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

// --- Physics Configuration ---
const GRAVITY = 0.25;
const FRICTION = 0.99;
const ELASTICITY = 0.6; // Reduced slightly for less erratic bouncing
const BALL_RADIUS = 6;
const PEG_RADIUS = 3;

// --- Multipliers Configuration (10 Boxes) ---
// Removed 25x, Max is 10x. Layout: [10, 4, 2, 1.2, 0.5, 0.5, 1.2, 2, 4, 10]
const MULTIPLIERS = [10, 4, 2, 1.2, 0.5, 0.5, 1.2, 2, 4, 10];

const MULTIPLIER_COLORS = [
    '#ef4444', // 10x - Red
    '#f97316', // 4x - Orange
    '#eab308', // 2x - Yellow
    '#3b82f6', // 1.2x - Blue
    '#22c55e', // 0.5x - Green
    '#22c55e', // 0.5x - Green
    '#3b82f6', // 1.2x - Blue
    '#eab308', // 2x - Yellow
    '#f97316', // 4x - Orange
    '#ef4444', // 10x - Red
];

interface BallEntity {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
    value: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface WinPopupState {
    amount: number;
    multiplier: number;
    id: number;
}

const PlinkoGame: React.FC<PlinkoGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(25);
    const [ballsInPlay, setBallsInPlay] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [winPopup, setWinPopup] = useState<WinPopupState | null>(null);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();
    const ballsRef = useRef<BallEntity[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const bucketAnimationsRef = useRef<number[]>(new Array(MULTIPLIERS.length).fill(0)); 
    const pegAnimationsRef = useRef<Map<number, number>>(new Map());
    const winTimeoutRef = useRef<number | null>(null);

    // Geometry
    const geometryRef = useRef({
        width: 0,
        height: 0,
        pegs: [] as {x: number, y: number}[],
        bucketWidth: 0,
        bucketY: 0,
    });

    // --- Initialization ---
    const initGeometry = useCallback(() => {
        if (!canvasRef.current) return;
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        
        const padTop = 40;
        const padBottom = 60;
        
        const bucketWidth = width / MULTIPLIERS.length;
        const bucketY = height - padBottom;
        
        const pegs: {x: number, y: number}[] = [];
        
        // Grid Settings
        const rows = 14;
        const availableHeight = bucketY - padTop - 20;
        const spacingY = availableHeight / rows;
        
        for (let row = 0; row < rows; row++) {
            const isOdd = row % 2 !== 0;
            const cols = isOdd ? MULTIPLIERS.length : MULTIPLIERS.length + 1; 
            
            const rowY = padTop + row * spacingY;
            const rowWidth = (cols - 1) * bucketWidth;
            const startX = (width - rowWidth) / 2;

            for (let col = 0; col < cols; col++) {
                pegs.push({
                    x: startX + col * bucketWidth,
                    y: rowY
                });
            }
        }

        geometryRef.current = {
            width,
            height,
            pegs,
            bucketWidth,
            bucketY,
        };
    }, []);

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && canvasRef.current.parentElement) {
                canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
                canvasRef.current.height = Math.min(600, window.innerHeight * 0.75);
                initGeometry();
            }
        };
        
        window.addEventListener('resize', handleResize);
        handleResize(); 
        
        return () => window.removeEventListener('resize', handleResize);
    }, [initGeometry]);


    // --- Physics Loop ---
    const animate = useCallback(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        const { width, height, pegs, bucketWidth, bucketY } = geometryRef.current;

        // Clear Screen
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Buckets
        const boxHeight = 50;
        
        MULTIPLIERS.forEach((mult, i) => {
            const bx = i * bucketWidth;
            const by = bucketY;
            
            // Hit Animation
            const anim = bucketAnimationsRef.current[i];
            if (anim > 0) bucketAnimationsRef.current[i] -= 0.05;

            // Box Background
            ctx.fillStyle = anim > 0 ? '#ffffff' : MULTIPLIER_COLORS[i];
            ctx.globalAlpha = anim > 0 ? 0.9 : 0.2;
            ctx.beginPath();
            ctx.roundRect(bx + 2, by, bucketWidth - 4, boxHeight, 8);
            ctx.fill();
            
            // Box Border
            ctx.globalAlpha = 1.0;
            ctx.lineWidth = 2;
            ctx.strokeStyle = MULTIPLIER_COLORS[i];
            if (anim > 0) {
                ctx.shadowColor = MULTIPLIER_COLORS[i];
                ctx.shadowBlur = 20;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Multiplier Text
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(10, bucketWidth * 0.35)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${mult}x`, bx + bucketWidth / 2, by + boxHeight / 2);
        });

        // 2. Draw Pegs
        pegs.forEach((peg, i) => {
            let scale = 1;
            let brightness = 0;
            if (pegAnimationsRef.current.has(i)) {
                let intensity = pegAnimationsRef.current.get(i)!;
                scale = 1 + intensity * 0.5;
                brightness = intensity;
                intensity -= 0.1;
                if (intensity <= 0) pegAnimationsRef.current.delete(i);
                else pegAnimationsRef.current.set(i, intensity);
            }

            ctx.beginPath();
            ctx.arc(peg.x, peg.y, PEG_RADIUS * scale, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + brightness * 0.7})`;
            ctx.fill();
            
            if (brightness > 0) {
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 10 * brightness;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });

        // 3. Physics: Update & Draw Balls
        for (let i = ballsRef.current.length - 1; i >= 0; i--) {
            const ball = ballsRef.current[i];
            
            // Apply Gravity
            ball.vy += GRAVITY;
            ball.vx *= FRICTION;
            ball.vy *= FRICTION;
            
            if (ball.vy > 12) ball.vy = 12;

            const nextX = ball.x + ball.vx;
            const nextY = ball.y + ball.vy;

            // Wall Collisions
            if (nextX < BALL_RADIUS) { ball.x = BALL_RADIUS; ball.vx *= -0.6; }
            else if (nextX > width - BALL_RADIUS) { ball.x = width - BALL_RADIUS; ball.vx *= -0.6; }
            else { ball.x = nextX; }
            
            ball.y = nextY;

            // Peg Collisions
            for (let pIndex = 0; pIndex < pegs.length; pIndex++) {
                const peg = pegs[pIndex];
                const dx = ball.x - peg.x;
                const dy = ball.y - peg.y;
                const distSq = dx*dx + dy*dy;
                const minDist = BALL_RADIUS + PEG_RADIUS;
                
                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const overlap = minDist - dist;
                    ball.x += nx * overlap;
                    ball.y += ny * overlap;

                    const dot = ball.vx * nx + ball.vy * ny;
                    ball.vx = (ball.vx - 2 * dot * nx) * ELASTICITY;
                    ball.vy = (ball.vy - 2 * dot * ny) * ELASTICITY;

                    ball.vx += (Math.random() - 0.5) * 1.5; 
                    pegAnimationsRef.current.set(pIndex, 1.0);
                }
            }

            // Scoring
            if (ball.y > bucketY) {
                const index = Math.floor(ball.x / bucketWidth);
                const safeIndex = Math.max(0, Math.min(MULTIPLIERS.length - 1, index));
                const mult = MULTIPLIERS[safeIndex];
                handleWin(ball.value, mult, safeIndex, ball.x, bucketY + boxHeight/2);
                ballsRef.current.splice(i, 1);
                continue;
            }

            // Draw Ball - YELLOW
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_RADIUS);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.4, '#facc15'); // Yellow-400
            grad.addColorStop(1, '#ca8a04'); // Yellow-700 border
            ctx.fillStyle = grad;
            ctx.shadowColor = 'rgba(250, 204, 21, 0.5)';
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        setBallsInPlay(ballsRef.current.length);

        // 4. Particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            if (p.life <= 0) {
                particlesRef.current.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 3, 3);
        }
        ctx.globalAlpha = 1.0;

        requestRef.current = requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [animate]);

    // --- Game Logic ---

    const handleWin = (betAmount: number, multiplier: number, index: number, x: number, y: number) => {
        const winnings = betAmount * multiplier;
        onBalanceUpdate(winnings, 'plinko');
        
        // Trigger Visuals
        bucketAnimationsRef.current[index] = 1.0;
        const color = MULTIPLIER_COLORS[index];

        // Particles
        for(let i=0; i<10; i++) {
            particlesRef.current.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 2,
                life: 1.0,
                color
            });
        }

        // Win Popup State (Centered)
        if (winnings > 0) {
            // Clear previous timeout if exists to prevent flashing
            if (winTimeoutRef.current) clearTimeout(winTimeoutRef.current);
            
            setWinPopup({ amount: winnings, multiplier, id: Date.now() });
            
            // Hide popup after 2 seconds
            winTimeoutRef.current = window.setTimeout(() => {
                setWinPopup(null);
            }, 2500);

            if (multiplier >= 10) {
                setShowConfetti(true);
                if (userProfile?.displayName && winnings > 10000) {
                    onAnnounceWin(userProfile.displayName, winnings, 'plinko');
                }
            }
        }
    };

    const handleDrop = async () => {
        if (!userProfile) return;
        if (bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'plinko');
        if (!success) return;

        const { width } = geometryRef.current;
        const startX = width / 2 + (Math.random() - 0.5) * 10; 

        ballsRef.current.push({
            id: Date.now(),
            x: startX,
            y: 20,
            vx: (Math.random() - 0.5) * 2,
            vy: 0,
            active: true,
            value: bet
        });
    };

    return (
        <div className="flex flex-col items-center h-full w-full max-w-4xl mx-auto p-2 relative">
             <HowToPlay>
                <p>1. حدد مبلغ الرهان لكل كرة.</p>
                <p>2. اضغط على زر <strong>"إسقاط الكرة"</strong>.</p>
                <p>3. ستسقط الكرة وترتد بين الأوتاد.</p>
                <p>4. تربح قيمة الرهان مضروبة في الرقم المكتوب على الصندوق الذي تسقط فيه الكرة.</p>
                <p>5. الصناديق في الأطراف تملك مضاعفات أعلى (تصل إلى x10) ولكن الوصول إليها أصعب.</p>
            </HowToPlay>

            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Canvas Container */}
            <div className="relative w-full bg-[#111827] rounded-xl overflow-hidden border-4 border-gray-700 shadow-2xl mb-2 mt-8">
                <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] pointer-events-none"></div>
                
                <canvas ref={canvasRef} className="block w-full h-full relative z-10" />

                {/* Center Win Popup */}
                {winPopup && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-bounce-in">
                        <div className="bg-gray-900/90 backdrop-blur-md border-2 border-yellow-500 px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.5)] text-center transform scale-110">
                            <div className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-1">ربح!</div>
                            <div className="text-5xl font-black text-yellow-400 drop-shadow-md mb-1">
                                {formatNumber(winPopup.amount)}
                            </div>
                            <div className={`text-xl font-bold ${winPopup.multiplier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                                {winPopup.multiplier}x
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="w-full bg-gray-800 p-3 rounded-xl border border-gray-700 flex flex-col gap-3 shadow-lg">
                <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-400">
                        كرات نشطة: <span className="text-white font-bold">{ballsInPlay}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                        المخاطرة: <span className="text-yellow-400 font-bold">عالية (10x)</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex-grow relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">الرهان</span>
                        <input 
                            type="number" 
                            value={bet} 
                            onChange={e => setBet(Math.max(1, Number(e.target.value)))}
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-12 pr-4 py-3 text-white font-bold focus:border-yellow-500 outline-none"
                        />
                    </div>
                    <button onClick={() => setBet(p => Math.max(10, p/2))} className="px-3 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 font-bold text-gray-300">½</button>
                    <button onClick={() => setBet(p => p*2)} className="px-3 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 font-bold text-gray-300">2x</button>
                </div>

                <button 
                    onClick={handleDrop}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white text-xl font-black rounded-xl shadow-[0_4px_0_rgb(21,128,61)] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                   <span>إسقاط الكرة</span> <span className="text-2xl">🟡</span>
                </button>
            </div>
            
            <style>{`
                @keyframes bounce-in {
                    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
                    50% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
                    70% { transform: translate(-50%, -50%) scale(0.9); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
            `}</style>
        </div>
    );
};

export default PlinkoGame;
