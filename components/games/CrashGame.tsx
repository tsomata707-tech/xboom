
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface CrashGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

interface BotPlayer {
    id: string;
    bet: number;
    target: number; // Multiplier they plan to cash out at
    cashedOut: boolean;
    avatar: string;
}

// --- Configuration ---
const PREPARATION_TIME_MS = 7000; 

// --- Algorithm Helpers ---
const generateCrashPoint = (isPlayerActive: boolean) => {
    const r = Math.random();
    const houseEdge = isPlayerActive ? 0.08 : 0.02;
    const instantCrashChance = isPlayerActive ? 0.08 : 0.01;

    if (r < instantCrashChance) return 1.00;

    let crashPoint = (0.99 / (1 - r)) * (1 - houseEdge);
    
    if (isPlayerActive) {
        if (crashPoint > 50 && Math.random() > 0.1) crashPoint = 50 + Math.random() * 50; 
    } else {
        crashPoint = Math.min(crashPoint, 5000); 
    }

    return Math.max(1.00, Math.floor(crashPoint * 100) / 100);
};

const generateFakeID = () => {
    const last4 = Math.floor(1000 + Math.random() * 9000);
    return `****${last4}`;
}

const CrashGame: React.FC<CrashGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    
    // --- Game State ---
    const [gameState, setGameState] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
    const [displayMultiplier, setDisplayMultiplier] = useState(1.00); // For final state sync
    const [countdown, setCountdown] = useState(PREPARATION_TIME_MS / 1000);
    const [history, setHistory] = useState<number[]>([]);
    
    // --- Betting State ---
    const [betAmount, setBetAmount] = useState(100);
    const [autoCashout, setAutoCashout] = useState<string>(''); 
    const [isBettingNext, setIsBettingNext] = useState(false); 
    const [isActiveBet, setIsActiveBet] = useState(false); 
    const [hasCashedOut, setHasCashedOut] = useState(false);
    const [winnings, setWinnings] = useState(0);

    // --- Players/Bots State ---
    const [bots, setBots] = useState<BotPlayer[]>([]);
    
    // --- Refs ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const multiplierTextRef = useRef<HTMLDivElement>(null); // Direct DOM Access
    const cashOutTextRef = useRef<HTMLSpanElement>(null); // Direct DOM Access for Cashout Button
    const requestRef = useRef<number>();
    const startTimeRef = useRef<number>(0);
    const crashPointRef = useRef<number>(0);
    const gameStateRef = useRef(gameState); 
    const botsRef = useRef<BotPlayer[]>([]); // Ref to track bots without causing re-renders inside loop
    const currentMultiplierRef = useRef(1.00);

    // Sync refs
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { botsRef.current = bots; }, [bots]);

    // 1. --- Preparation Phase (Countdown) ---
    useEffect(() => {
        let timerInterval: any;

        if (gameState === 'WAITING') {
            setDisplayMultiplier(1.00);
            currentMultiplierRef.current = 1.00;
            if (multiplierTextRef.current) multiplierTextRef.current.innerText = '1.00x';
            
            setHasCashedOut(false);
            setWinnings(0);
            
            const numBots = Math.floor(Math.random() * 8) + 3;
            const newBots: BotPlayer[] = Array.from({ length: numBots }).map(() => ({
                id: generateFakeID(),
                bet: [50, 100, 200, 500, 1000][Math.floor(Math.random() * 5)],
                target: 1 + (Math.random() * Math.random() * 10),
                cashedOut: false,
                avatar: ['👤', '🦊', '🦁', '🐯', '🐸', '🐼'][Math.floor(Math.random() * 6)]
            }));
            setBots(newBots);

            let timeLeft = PREPARATION_TIME_MS;
            setCountdown(timeLeft / 1000);

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            timerInterval = setInterval(() => {
                timeLeft -= 100;
                setCountdown(Math.max(0, parseFloat((timeLeft / 1000).toFixed(1))));

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    setGameState('FLYING'); 
                }
            }, 100);
        }

        return () => clearInterval(timerInterval);
    }, [gameState]);

    // 2. --- Flying Phase Initialization ---
    useEffect(() => {
        if (gameState === 'FLYING') {
            initializeRound();
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState]);

    const initializeRound = async () => {
        let playerParticipating = false;

        if (isBettingNext) {
            if (userProfile && userProfile.balance >= betAmount) {
                const success = await onBalanceUpdate(-betAmount, 'crashGame');
                if (success) {
                    setIsActiveBet(true);
                    setIsBettingNext(false);
                    playerParticipating = true;
                } else {
                    setIsActiveBet(false);
                    setIsBettingNext(false);
                    addToast('رصيد غير كافٍ لبدء الجولة.', 'error');
                }
            } else {
                setIsActiveBet(false);
                setIsBettingNext(false);
                addToast('رصيد غير كافٍ.', 'error');
            }
        } else {
            setIsActiveBet(false);
        }

        const point = generateCrashPoint(playerParticipating);
        crashPointRef.current = point;
        startTimeRef.current = Date.now();

        requestRef.current = requestAnimationFrame(gameLoop);
    };

    // 3. --- The Game Loop (Optimized for Performance) ---
    const gameLoop = () => {
        if (gameStateRef.current !== 'FLYING') return;

        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        
        const newMultiplier = Math.max(1, Math.exp(0.00006 * elapsed));
        currentMultiplierRef.current = newMultiplier;

        // Direct DOM update for high performance - Prevents React Re-render
        if (multiplierTextRef.current) {
            multiplierTextRef.current.innerText = `${newMultiplier.toFixed(2)}x`;
        }

        // Update cashout button text
        if (cashOutTextRef.current && isActiveBet && !hasCashedOut) {
            const currentProfit = betAmount * newMultiplier;
            cashOutTextRef.current.innerText = `+${formatNumber(currentProfit)} 💎`;
        }
        
        // Check Bot Cashouts - Batch updates to avoid flicker, but minimal logic here
        let botsChanged = false;
        const updatedBots = botsRef.current.map(bot => {
            if (!bot.cashedOut && newMultiplier >= bot.target) {
                botsChanged = true;
                return { ...bot, cashedOut: true };
            }
            return bot;
        });
        
        if (botsChanged) {
            setBots(updatedBots);
        }

        if (newMultiplier >= crashPointRef.current) {
            handleCrash(crashPointRef.current);
            return;
        }
        
        if (isActiveBet && !hasCashedOut && autoCashout !== '' && parseFloat(autoCashout) > 1) {
            const target = parseFloat(autoCashout);
            if (newMultiplier >= target) {
                handleCashOutInternal(target);
            }
        }

        drawCanvas(newMultiplier, 'FLYING');
        requestRef.current = requestAnimationFrame(gameLoop);
    };

    // 4. --- Crash Handler ---
    const handleCrash = (finalValue: number) => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        
        const safeFinalValue = typeof finalValue === 'number' && !isNaN(finalValue) ? finalValue : 1.00;

        setDisplayMultiplier(safeFinalValue); // Update React state once at the end
        setGameState('CRASHED');
        setHistory(prev => [safeFinalValue, ...prev].slice(0, 15));
        drawCanvas(safeFinalValue, 'CRASHED');
        
        if (multiplierTextRef.current) {
            multiplierTextRef.current.innerText = `${safeFinalValue.toFixed(2)}x`;
        }

        if (isActiveBet && !hasCashedOut) {
            setIsActiveBet(false);
        }

        setTimeout(() => {
            setGameState('WAITING');
        }, 2000); 
    };

    // 5. --- Cashout Logic ---
    const handleCashOutInternal = (currentM: number) => {
        if (!isActiveBet || hasCashedOut) return;
        if (gameState === 'CRASHED') return;

        setHasCashedOut(true);
        const rawWin = betAmount * currentM;
        const winAmount = Math.floor(rawWin * 100) / 100;
        
        setWinnings(winAmount);
        onBalanceUpdate(winAmount, 'crashGame');
        
        addToast(`سحب ناجح! +${formatNumber(winAmount)} 💎`, 'success');
        if (winAmount > 10000 && userProfile?.displayName) {
            onAnnounceWin(userProfile.displayName, winAmount, 'crashGame');
        }
    };

    // 6. --- Drawing Logic (Canvas) ---
    const drawCanvas = useCallback((currentM: number, state: 'FLYING' | 'CRASHED') => {
        if (typeof currentM !== 'number' || isNaN(currentM)) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        const maxVisibleM = Math.max(2, currentM * 1.2);
        const maxVisibleT = Math.max(10, (Math.log(currentM) / 0.00006) / 1000 * 1.2); 

        const mapY = (val: number) => h - ((val - 1) / (maxVisibleM - 1)) * (h - 40) - 20;
        const mapX = (t: number) => (t / maxVisibleT) * (w - 40) + 20;

        // Grid
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=1; i<=5; i++) {
            const yVal = 1 + ((maxVisibleM - 1)/5) * i;
            const y = mapY(yVal);
            const label = !isNaN(yVal) ? yVal.toFixed(1) : '0.0';
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.fillStyle = '#6B7280';
            ctx.font = '10px Arial';
            ctx.fillText(label+'x', w - 30, y - 5);
        }
        ctx.stroke();

        // Curve
        const elapsedSecs = (Math.log(currentM) / 0.00006) / 1000;
        
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = state === 'CRASHED' ? '#EF4444' : '#06B6D4';
        
        ctx.moveTo(mapX(0), mapY(1));
        const endX = mapX(elapsedSecs);
        const endY = mapY(currentM);
        const cpX = endX * 0.6;
        const cpY = mapY(1);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();

        // Area
        ctx.lineTo(endX, h);
        ctx.lineTo(mapX(0), h);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        if (state === 'CRASHED') {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        } else {
            gradient.addColorStop(0, 'rgba(6, 182, 212, 0.5)');
            gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
        }
        ctx.fillStyle = gradient;
        ctx.fill();

        // Rocket
        ctx.save();
        ctx.translate(endX, endY);
        
        if (state === 'CRASHED') {
            ctx.font = '40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💥', 0, 0);
        } else {
            const angle = -25;
            ctx.rotate(angle * Math.PI / 180);
            ctx.font = '30px Arial';
            ctx.shadowColor = '#06B6D4';
            ctx.shadowBlur = 20;
            ctx.fillText('🚀', -20, 10);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#F59E0B';
            ctx.beginPath();
            ctx.arc(-25, 5, 4 + Math.random()*2, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }, []);

    // --- Resize Observer ---
    useEffect(() => {
        const resizeCanvas = () => {
            if (containerRef.current && canvasRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
                if (gameState !== 'WAITING') {
                    drawCanvas(currentMultiplierRef.current, gameState);
                }
            }
        };
        setTimeout(resizeCanvas, 100);
        
        const observer = new ResizeObserver(() => resizeCanvas());
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [drawCanvas, gameState]);


    // --- Handlers ---
    const handleMainButton = () => {
        if (gameState === 'WAITING' || gameState === 'CRASHED') {
            setIsBettingNext(prev => !prev);
        } else if (gameState === 'FLYING') {
            if (isActiveBet && !hasCashedOut) {
                handleCashOutInternal(currentMultiplierRef.current);
            } else if (!isActiveBet) {
                setIsBettingNext(prev => !prev);
            }
        }
    };

    const handleDouble = () => setBetAmount(prev => Math.min(userProfile?.balance || 0, prev * 2));
    const handleHalf = () => setBetAmount(prev => Math.max(10, Math.floor(prev / 2)));

    const getMaskedID = (id: string | undefined) => {
        if (!id) return '****';
        if (id.length <= 4) return id;
        return `****${id.slice(-4)}`;
    };

    return (
        <div className="flex flex-col h-full bg-[#0f1923] text-white rounded-lg overflow-hidden shadow-2xl border border-gray-800 relative">
             <HowToPlay>
                <p>1. حدد مبلغ الرهان قبل بدء الجولة.</p>
                <p>2. اضغط على "بيت (BET)" للدخول في الجولة القادمة.</p>
                <p>3. عندما ينطلق الصاروخ، يزداد المضاعف (x1.00 يتصاعد).</p>
                <p>4. اضغط على "سحب الأرباح" قبل أن ينفجر الصاروخ (CRASH)!</p>
                <p>5. إذا انفجر الصاروخ قبل السحب، تخسر رهانك.</p>
                <p>6. يمكنك تعيين "سحب تلقائي" (Auto Cashout) ليقوم النظام بالسحب عند الوصول لرقم معين.</p>
            </HowToPlay>

             {winnings > 0 && <Confetti onComplete={() => {}} />}
            
            <div className="h-10 bg-[#1a2c38] flex items-center justify-between px-3 gap-2 overflow-hidden relative shadow-md z-10 flex-shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-row-reverse w-full">
                    {history.map((h, i) => (
                        <div key={i} className={`px-2 py-0.5 rounded text-xs font-bold min-w-[45px] text-center ${h >= 2.0 ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-gray-700/50 text-gray-400 border border-gray-600'}`}>
                            {(h || 1.0).toFixed(2)}x
                        </div>
                    ))}
                    <span className="text-xs text-gray-500 font-bold ml-auto whitespace-nowrap">التاريخ</span>
                </div>
            </div>

            <div className="flex-grow relative flex flex-col md:flex-row min-h-[300px]">
                <div ref={containerRef} className="relative flex-grow h-[300px] md:h-auto bg-[#0f1923] overflow-hidden gpu-accelerated">
                    <canvas ref={canvasRef} className="block w-full h-full" />

                    <div className="absolute top-2 left-2 z-30 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg w-48 max-h-[200px] overflow-hidden flex flex-col pointer-events-none">
                        <div className="bg-black/60 px-3 py-1 text-xs font-bold text-gray-400 flex justify-between">
                            <span>اللاعبون ({bots.length + (isActiveBet ? 1 : 0)})</span>
                            <span>الرهان</span>
                        </div>
                        <div className="overflow-y-auto flex-grow p-1 space-y-1">
                            {isActiveBet && (
                                <div className={`flex justify-between items-center text-xs px-2 py-1 rounded ${hasCashedOut ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/5'}`}>
                                    <div className="flex items-center gap-1">
                                        <span>👤</span>
                                        <span className="text-yellow-300 font-mono">{getMaskedID(userProfile?.playerID)}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        {hasCashedOut ? (
                                            <span className="text-green-400 font-bold">+{formatNumber(winnings)}</span>
                                        ) : (
                                            <span className="text-white">{formatNumber(betAmount)}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {bots.map((bot, i) => (
                                <div key={i} className={`flex justify-between items-center text-xs px-2 py-1 rounded transition-colors duration-300 ${bot.cashedOut ? 'bg-green-500/10' : 'opacity-70'}`}>
                                    <div className="flex items-center gap-1">
                                        <span>{bot.avatar}</span>
                                        <span className="text-gray-300 font-mono">{bot.id}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        {bot.cashedOut ? (
                                            <span className="text-green-400 font-bold">+{formatNumber(Math.floor(bot.bet * bot.target))}</span>
                                        ) : (
                                            <span className="text-gray-400">{formatNumber(bot.bet)}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {gameState === 'WAITING' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
                            <div className="text-cyan-400 text-lg font-bold mb-2">الجولة تبدأ خلال</div>
                            <div className="text-6xl font-black text-white font-mono drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                                {countdown.toFixed(1)}s
                            </div>
                            <div className="w-1/2 h-1 bg-gray-700 rounded-full mt-4 overflow-hidden">
                                <div className="h-full bg-cyan-500 transition-all duration-100" style={{width: `${(countdown/7)*100}%`}}></div>
                            </div>
                            <p className="mt-4 text-gray-400 text-sm animate-pulse">ضع رهانك الآن...</p>
                        </div>
                    )}

                    {/* Main Multiplier Display - Optimized with Direct DOM Manipulation */}
                    <div 
                        className={`absolute top-10 left-1/2 -translate-x-1/2 text-center z-10 pointer-events-none ${gameState === 'WAITING' ? 'hidden' : 'block'}`}
                    >
                        <div 
                            ref={multiplierTextRef}
                            className={`text-6xl sm:text-7xl font-black font-mono drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] ${gameState === 'CRASHED' ? 'text-red-500' : 'text-white'}`}
                        >
                            1.00x
                        </div>
                        {gameState === 'CRASHED' && (
                             <div className="text-xl font-bold text-red-500 mt-2 animate-bounce">CRASHED</div>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-80 bg-[#1f2937] border-t md:border-t-0 md:border-r border-gray-700 p-4 flex flex-col gap-4 shadow-2xl z-30 flex-shrink-0">
                    
                    <div className="bg-[#111827] p-4 rounded-xl border border-gray-600 shadow-inner">
                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                            <span>مبلغ الرهان</span>
                            <span>الرصيد: {formatNumber(userProfile?.balance || 0)}</span>
                        </div>
                        
                        <div className="flex gap-2 mb-4">
                            <div className="relative flex-grow">
                                <input 
                                    type="number" 
                                    value={betAmount || ''} 
                                    onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                                    disabled={isActiveBet}
                                    className="w-full bg-[#1f2937] border border-gray-500 rounded-lg px-4 py-2 text-white font-bold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-lg transition-all disabled:opacity-50"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">💎</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <button onClick={handleHalf} disabled={isActiveBet} className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs font-bold transition disabled:opacity-50">½</button>
                                <button onClick={handleDouble} disabled={isActiveBet} className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded text-xs font-bold transition disabled:opacity-50">2x</button>
                            </div>
                        </div>

                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                            <span>سحب تلقائي عند (x)</span>
                            <span className="text-[10px] text-gray-500">(اتركه فارغاً للسحب اليدوي)</span>
                        </div>
                        <div className="relative mb-2">
                            <input 
                                type="number" 
                                value={autoCashout} 
                                onChange={(e) => setAutoCashout(e.target.value)}
                                disabled={isActiveBet}
                                placeholder="لا نهائي"
                                step="0.10"
                                min="1.01"
                                className="w-full bg-[#1f2937] border border-gray-500 rounded-lg px-4 py-2 text-white font-bold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none disabled:opacity-50 placeholder-gray-600"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">AUTO</span>
                        </div>
                    </div>

                    {gameState === 'FLYING' && isActiveBet && !hasCashedOut ? (
                        <button 
                            onClick={handleMainButton}
                            className="w-full flex-grow min-h-[80px] rounded-xl text-2xl font-black shadow-lg transition-all transform active:scale-95 flex flex-col items-center justify-center relative overflow-hidden bg-orange-500 hover:bg-orange-400 text-white shadow-orange-900/50 border-b-4 border-orange-700"
                        >
                             <span className="text-lg font-bold tracking-widest">سحب الأرباح</span>
                             <span ref={cashOutTextRef} className="text-sm font-mono font-bold mt-1 bg-black/20 px-2 rounded">
                                 +{formatNumber(betAmount)} 💎
                             </span>
                        </button>
                    ) : (
                        <button 
                            onClick={handleMainButton}
                            className={`w-full flex-grow min-h-[80px] rounded-xl text-2xl font-black shadow-lg transition-all transform active:scale-95 flex flex-col items-center justify-center relative overflow-hidden
                                ${isBettingNext 
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/50 border-b-4 border-red-800' 
                                    : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/50 border-b-4 border-green-800'
                                }
                            `}
                        >
                            {isBettingNext ? (
                                <>
                                    <span className="text-lg">إلغاء الرهان</span>
                                    <span className="text-xs font-normal opacity-80">انتظار الجولة القادمة...</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-3xl tracking-wider">بيت (BET)</span>
                                    <span className="text-xs font-normal opacity-80">
                                        {gameState === 'FLYING' ? 'للجولة القادمة' : 'ضع رهانك الآن'}
                                    </span>
                                </>
                            )}
                        </button>
                    )}

                    {hasCashedOut && isActiveBet && (
                        <div className="bg-green-900/30 border border-green-500/30 p-3 rounded-lg text-center animate-pulse">
                            <p className="text-green-400 text-sm font-bold">تم السحب بنجاح!</p>
                            <p className="text-white font-bold text-lg">+{formatNumber(winnings)} 💎</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CrashGame;
