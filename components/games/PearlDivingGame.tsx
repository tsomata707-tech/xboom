
import React, { useState } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import HowToPlay from '../HowToPlay';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const DEPTHS = [
    { id: 'shallow', name: 'مياه ضحلة', risk: 'منخفضة', multiplier: 1.5, chance: 0.6, color: 'from-cyan-400 to-blue-400' },
    { id: 'medium', name: 'عمق متوسط', risk: 'متوسطة', multiplier: 3.0, chance: 0.3, color: 'from-blue-500 to-indigo-600' },
    { id: 'deep', name: 'القاع المظلم', risk: 'عالية', multiplier: 10.0, chance: 0.1, color: 'from-indigo-900 to-black' },
];

const PearlDivingGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [isDiving, setIsDiving] = useState(false);
    const [bet, setBet] = useState(100);
    const [selectedDepth, setSelectedDepth] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [diverPos, setDiverPos] = useState(0); // 0 to 100
    const [bubblePos, setBubblePos] = useState([0, 20, 40, 60, 80]);

    const handleDive = async (index: number) => {
        if (isDiving) return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'pearlDiving');
        if (!success) return;

        setIsDiving(true);
        setSelectedDepth(index);
        setDiverPos(0);
        setShowConfetti(false);

        // Animation Loop
        let progress = 0;
        const depthConfig = DEPTHS[index];
        
        const diveInterval = setInterval(() => {
            progress += 2;
            setDiverPos(progress);
            setBubblePos(prev => prev.map(p => (p + 5) % 100)); // Animate bubbles

            if (progress >= 100) {
                clearInterval(diveInterval);
                resolveDive(depthConfig);
            }
        }, 30);
    };

    const resolveDive = (config: typeof DEPTHS[0]) => {
        const win = Math.random() < config.chance;
        
        if (win) {
            const winnings = bet * config.multiplier;
            onBalanceUpdate(winnings, 'pearlDiving');
            addToast(`وجدت اللؤلؤة! 🦪 ربحت ${formatNumber(winnings)}`, 'success');
            setShowConfetti(true);
        } else {
            addToast('لم تجد شيئاً سوى الصخور. 🪨', 'error');
        }
        
        setTimeout(() => {
            setIsDiving(false);
            setDiverPos(0);
            setSelectedDepth(null);
        }, 2000);
    };

    return (
        <div className="flex flex-col h-full p-3 relative overflow-hidden bg-gradient-to-b from-cyan-300 to-blue-900">
             <HowToPlay>
                <p>1. اختر مستوى العمق الذي تريد الغوص فيه.</p>
                <p>2. <strong>مياه ضحلة:</strong> فرصة فوز عالية، ربح قليل (x1.5).</p>
                <p>3. <strong>عمق متوسط:</strong> توازن بين المخاطرة والربح (x3.0).</p>
                <p>4. <strong>القاع المظلم:</strong> مخاطرة عالية جداً، ربح ضخم (x10.0).</p>
                <p>5. انتظر الغواص ليرى إن كان سيجد اللؤلؤة أم لا.</p>
            </HowToPlay>
            
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

            {/* Ocean Background Animation */}
            <div className="absolute inset-0 pointer-events-none">
                {bubblePos.map((y, i) => (
                     <div key={i} className="absolute bg-white/20 rounded-full w-4 h-4 transition-all duration-1000" 
                          style={{ left: `${10 + i * 20}%`, bottom: `${y}%` }}></div>
                ))}
            </div>

            <div className="flex-grow flex flex-col justify-center gap-4 z-10">
                {DEPTHS.map((depth, i) => (
                    <button
                        key={i}
                        onClick={() => handleDive(i)}
                        disabled={isDiving}
                        className={`relative h-24 rounded-xl overflow-hidden border-2 transition-all transform 
                            ${selectedDepth === i ? 'scale-105 border-yellow-400 shadow-xl' : 'border-white/30 hover:border-white/60'}
                            disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r ${depth.color}
                        `}
                    >
                        <div className="absolute inset-0 flex items-center justify-between px-6">
                            <div className="text-right">
                                <h3 className="font-bold text-lg text-white drop-shadow-md">{depth.name}</h3>
                                <p className="text-xs text-gray-200">مخاطرة: {depth.risk}</p>
                            </div>
                            <div className="text-2xl font-black text-yellow-300 drop-shadow-md">x{depth.multiplier}</div>
                        </div>
                        
                        {/* Diver Animation */}
                        {isDiving && selectedDepth === i && (
                            <div 
                                className="absolute top-1/2 transform -translate-y-1/2 transition-all duration-75 ease-linear"
                                style={{ right: `${diverPos}%` }}
                            >
                                <span className="text-4xl filter drop-shadow-lg">🤿</span>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            <div className="bg-black/40 p-4 rounded-xl backdrop-blur-sm mt-4 z-10">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={isDiving} />
            </div>
        </div>
    );
};

export default PearlDivingGame;
