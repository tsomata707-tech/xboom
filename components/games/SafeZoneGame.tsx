
import React, { useState, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const SafeZoneGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<'picking' | 'bombing' | 'survived'>('picking');
    const [selectedTile, setSelectedTile] = useState<number | null>(null);
    const [destroyedTiles, setDestroyedTiles] = useState<number[]>([]);
    const [countdown, setCountdown] = useState(5);
    const [bet, setBet] = useState(100);
    const [showConfetti, setShowConfetti] = useState(false);

    const GRID_SIZE = 16; // 4x4

    const startGame = async (index: number) => {
        if (gameState !== 'picking') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'safeZone');
        if (success) {
            setSelectedTile(index);
            setGameState('bombing');
            setCountdown(3);
        }
    };

    useEffect(() => {
        if (gameState === 'bombing') {
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        resolveRound();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [gameState]);

    const resolveRound = () => {
        // Destroy 6 random tiles
        const unsafe = new Set<number>();
        while(unsafe.size < 6) {
            unsafe.add(Math.floor(Math.random() * GRID_SIZE));
        }
        const destroyed = Array.from(unsafe);
        setDestroyedTiles(destroyed);

        if (selectedTile !== null && !unsafe.has(selectedTile)) {
            // Survived
            setGameState('survived');
            const win = bet * 1.5; // Split pot simulation
            onBalanceUpdate(win, 'safeZone');
            addToast(`نجوت! ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else {
            addToast('تدمرت منطقتك! خسرت.', 'error');
            setGameState('picking'); // Reset immediately for visual effect or keep destroyed?
            setTimeout(() => reset(), 2000);
            return;
        }
        setTimeout(() => reset(), 3000);
    };

    const reset = () => {
        setGameState('picking');
        setSelectedTile(null);
        setDestroyedTiles([]);
        setShowConfetti(false);
    };

    return (
        <div className="flex flex-col h-full items-center justify-center p-4">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-green-400 mb-2">المنطقة الآمنة 🛡️</h2>
                <p className="text-gray-400 text-sm">
                    {gameState === 'picking' ? 'اختر مربعاً للوقوف فيه (100 💎)' : 
                     gameState === 'bombing' ? `الصواريخ قادمة خلال ${countdown}...` : 'النتائج'}
                </p>
            </div>

            <div className="grid grid-cols-4 gap-2 w-full max-w-[300px] aspect-square">
                {Array.from({ length: GRID_SIZE }).map((_, i) => {
                    const isSelected = selectedTile === i;
                    const isDestroyed = destroyedTiles.includes(i);
                    
                    let bgClass = 'bg-gray-700 border-gray-600';
                    if (isSelected) bgClass = 'bg-blue-600 border-blue-400 shadow-[0_0_15px_blue]';
                    if (isDestroyed) bgClass = 'bg-red-600 border-red-800 animate-pulse';
                    if (gameState === 'survived' && isSelected && !isDestroyed) bgClass = 'bg-green-500 border-green-300 shadow-[0_0_20px_green]';

                    return (
                        <button
                            key={i}
                            onClick={() => startGame(i)}
                            disabled={gameState !== 'picking'}
                            className={`rounded-lg border-2 transition-all duration-300 ${bgClass} hover:opacity-80`}
                        >
                            {isDestroyed ? '💥' : isSelected ? '👤' : ''}
                        </button>
                    )
                })}
            </div>
            
            {gameState === 'picking' && (
                <div className="mt-6">
                    <p className="text-xs text-gray-500 text-center">كلفة الدخول ثابتة: 100 💎</p>
                </div>
            )}
        </div>
    );
};

export default SafeZoneGame;
