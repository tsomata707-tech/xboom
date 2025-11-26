
import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, LuckyWheelGameState } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import BetControls from '../BetControls';
import { convertTimestamps } from '../utils/convertTimestamps';

interface UserProfile extends AppUser {
    balance: number;
}

interface LuckyWheelGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const SEGMENTS = [
    { id: 'x50', multiplier: 50, label: 'x50', color: '#FFD700' },
    { id: 'x0_1', multiplier: 0, label: 'x0', color: '#1A202C' },
    { id: 'x2', multiplier: 2, label: 'x2', color: '#3182CE' },
    { id: 'x0_2', multiplier: 0, label: 'x0', color: '#1A202C' },
    { id: 'free', multiplier: 0, label: 'مجانية', color: '#805AD5' },
    { id: 'x5', multiplier: 5, label: 'x5', color: '#38A169' },
    { id: 'x0_3', multiplier: 0, label: 'x0', color: '#1A202C' },
    { id: 'x1.5', multiplier: 1.5, label: 'x1.5', color: '#319795' },
    { id: 'x0_4', multiplier: 0, label: 'x0', color: '#1A202C' },
    { id: 'x10', multiplier: 10, label: 'x10', color: '#E53E3E' },
];

const LuckyWheelGame: React.FC<LuckyWheelGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<LuckyWheelGameState | null>(null);
    const [bet, setBet] = useState(100);
    const [rotation, setRotation] = useState(0);
    const [hasBet, setHasBet] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [winMessage, setWinMessage] = useState<React.ReactNode | null>(null);
    const wheelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const docRef = doc(db, 'public', 'luckyWheel');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as LuckyWheelGameState;
                setGameState(data);

                if (data.status === 'betting') {
                    setHasBet(false);
                    setWinMessage(null);
                    setShowConfetti(false);
                    // Reset rotation visually without animation if needed, or keep spinning
                } else if (data.status === 'spinning' && data.resultSegment) {
                    spinWheel(data.resultSegment);
                } else if (data.status === 'result') {
                    // Check if user won
                    if (hasBet) {
                        const segment = SEGMENTS.find(s => s.id === data.resultSegment);
                        if (segment && segment.multiplier > 0) {
                            const win = bet * segment.multiplier;
                            setWinMessage(<span className="text-green-400">مبروك! ربحت {formatNumber(win)}</span>);
                            setShowConfetti(true);
                            onBalanceUpdate(win, 'luckyWheel'); // Award locally for immediate feedback
                        } else {
                            setWinMessage(<span className="text-red-400">حظ أوفر.</span>);
                        }
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [hasBet, bet]); // Dependencies for payout logic

    const spinWheel = (targetId: string) => {
        const segmentCount = SEGMENTS.length;
        const segmentAngle = 360 / segmentCount;
        const targetIndex = SEGMENTS.findIndex(s => s.id === targetId);
        
        // Calculate target rotation
        const baseTargetAngle = (360 - (targetIndex * segmentAngle)) % 360;
        const extraSpins = 5 * 360;
        const currentMod = rotation % 360;
        let dist = baseTargetAngle - currentMod;
        if (dist < 0) dist += 360;
        
        setRotation(rotation + extraSpins + dist);
    };

    const handleBet = async () => {
        if (!userProfile || !gameState) return;
        if (gameState.status !== 'betting') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'luckyWheel');
        if (success) {
            setHasBet(true);
            addToast('تم وضع الرهان', 'success');
            
            // Register bet in Firestore
            await runTransaction(db, async (t) => {
                const ref = doc(db, 'public', 'luckyWheel');
                const s = await t.get(ref);
                const d = s.data() as LuckyWheelGameState;
                const bets = d.bets || {};
                bets[userProfile.uid] = { userId: userProfile.uid, nickname: userProfile.displayName || 'User', amount: bet };
                t.update(ref, { bets });
            });
        }
    };

    return (
        <div className="flex flex-col items-center h-full w-full max-w-md mx-auto overflow-hidden justify-start pt-2 relative">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="bg-gray-800 px-4 py-1 rounded-full mb-2">
                <span className={`font-bold ${gameState?.status === 'betting' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {gameState?.status === 'betting' ? 'مفتوح للرهان' : gameState?.status === 'spinning' ? 'جاري الدوران...' : 'النتيجة'}
                </span>
            </div>

            {/* Wheel Area */}
            <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-10 h-12 text-yellow-500">▼</div>
                <div 
                    ref={wheelRef}
                    className="w-full h-full rounded-full border-4 border-gray-700 shadow-2xl overflow-hidden relative transition-transform duration-[4000ms] cubic-bezier(0.25, 0.1, 0.25, 1)"
                    style={{ transform: `rotate(${rotation}deg)` }}
                >
                    <svg viewBox="0 0 100 100" className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {SEGMENTS.map((segment, index) => {
                            const count = SEGMENTS.length;
                            const angle = 360 / count;
                            const startAngle = ((index * angle) - 90 - (angle/2)) * (Math.PI / 180);
                            const endAngle = (((index + 1) * angle) - 90 - (angle/2)) * (Math.PI / 180);
                            const x1 = 50 + 50 * Math.cos(startAngle);
                            const y1 = 50 + 50 * Math.sin(startAngle);
                            const x2 = 50 + 50 * Math.cos(endAngle);
                            const y2 = 50 + 50 * Math.sin(endAngle);
                            return <path key={segment.id} d={`M50,50 L${x1},${y1} A50,50 0 0,1 ${x2},${y2} Z`} fill={segment.color} stroke="#111" strokeWidth="0.5" />;
                        })}
                    </svg>
                    {SEGMENTS.map((segment, index) => {
                        const angle = (360 / SEGMENTS.length) * index;
                        return (
                            <div key={segment.id} className="absolute top-0 left-1/2 w-[1px] h-1/2 origin-bottom flex flex-col items-center pt-3" style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}>
                                <span className="font-bold text-xs text-white transform rotate-180 writing-vertical-rl">{segment.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="h-10 flex items-center justify-center w-full mt-2">
                {winMessage}
            </div>

            <div className="w-full px-4 mt-2">
                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={gameState?.status !== 'betting' || hasBet} />
                <button 
                    onClick={handleBet} 
                    disabled={gameState?.status !== 'betting' || hasBet}
                    className="w-full py-3 mt-2 text-xl font-bold bg-yellow-500 rounded-xl text-black hover:opacity-90 disabled:opacity-50"
                >
                    {hasBet ? 'تم الرهان' : 'لف العجلة (رهان)'}
                </button>
            </div>
        </div>
    );
};

export default LuckyWheelGame;
