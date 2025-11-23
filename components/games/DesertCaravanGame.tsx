
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

const PATHS = [
    { id: 'dunes', name: 'الكثبان الرملية', risk: 'عالي', multiplier: 3.0 },
    { id: 'oasis', name: 'طريق الواحة', risk: 'عالي', multiplier: 3.0 },
    { id: 'rocky', name: 'الوادي الصخري', risk: 'عالي', multiplier: 3.0 },
];

const DesertCaravanGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<'choosing' | 'traveling' | 'result'>('choosing');
    const [selectedPath, setSelectedPath] = useState<number | null>(null);
    const [safePath, setSafePath] = useState<number | null>(null);
    const [bet, setBet] = useState(100);
    const [showConfetti, setShowConfetti] = useState(false);
    const [stormPos, setStormPos] = useState(0);

    const startJourney = async (index: number) => {
        if (gameState !== 'choosing') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }

        const success = await onBalanceUpdate(-bet, 'desertCaravan');
        if (!success) return;

        setSelectedPath(index);
        setGameState('traveling');
        setStormPos(0);
        setShowConfetti(false);

        // Storm Animation
        let p = 0;
        const interval = setInterval(() => {
            p += 2;
            setStormPos(p);
            if (p >= 100) {
                clearInterval(interval);
                resolveJourney(index);
            }
        }, 50);
    };

    const resolveJourney = (choice: number) => {
        // 1 path is safe, 2 are hit by storm
        const safe = Math.floor(Math.random() * 3);
        setSafePath(safe);
        setGameState('result');

        if (choice === safe) {
            const win = bet * 3.0;
            onBalanceUpdate(win, 'desertCaravan');
            addToast(`نجت القافلة! وصلت بسلام. ربحت ${formatNumber(win)}`, 'success');
            setShowConfetti(true);
        } else {
            addToast('ضربت العاصفة القافلة. خسرت البضاعة.', 'error');
        }

        setTimeout(() => {
            setGameState('choosing');
            setSelectedPath(null);
            setSafePath(null);
            setStormPos(0);
        }, 3000);
    };

    return (
        <div className="flex flex-col h-full p-4 bg-orange-100 relative overflow-hidden">
             <HowToPlay>
                <p>1. أنت قائد قافلة تجارية في الصحراء.</p>
                <p>2. عاصفة رملية قادمة! يجب أن تختار طريقاً واحداً للنجاة.</p>
                <p>3. اختر بين (الكثبان، الواحة، الوادي).</p>
                <p>4. طريق واحد فقط سيكون آمناً من العاصفة.</p>
                <p>5. إذا اخترت الطريق الآمن، تربح 3 أضعاف رهانك!</p>
            </HowToPlay>
            
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}

            {/* Sky/Storm Background */}
            <div className={`absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-orange-300 to-yellow-100 transition-all duration-1000 ${gameState === 'traveling' ? 'brightness-75' : ''}`}>
                 {/* Sun */}
                 <div className="absolute top-4 right-4 w-16 h-16 bg-yellow-400 rounded-full blur-sm opacity-80"></div>
            </div>
            
            {/* Storm Overlay */}
            {gameState === 'traveling' && (
                 <div 
                    className="absolute top-0 left-0 h-full bg-black/40 z-20 backdrop-blur-[2px] transition-all ease-linear border-r-4 border-orange-800/30"
                    style={{ width: `${stormPos}%` }}
                 ></div>
            )}

            <div className="flex-grow flex flex-col justify-end gap-4 z-10 relative pb-4">
                 <div className="text-center mb-4">
                     <h2 className="text-2xl font-black text-orange-900 drop-shadow-sm">اختر مسارك</h2>
                     <p className="text-orange-800 text-sm">العاصفة تقترب...</p>
                 </div>

                 <div className="grid grid-cols-3 gap-3">
                     {PATHS.map((path, i) => {
                         const isSelected = selectedPath === i;
                         const isSafe = safePath === i;
                         const isLost = gameState === 'result' && selectedPath === i && !isSafe;

                         return (
                             <button
                                 key={i}
                                 onClick={() => startJourney(i)}
                                 disabled={gameState !== 'choosing'}
                                 className={`
                                     h-32 rounded-t-full rounded-b-lg border-b-4 transition-all transform flex flex-col items-center justify-end pb-4
                                     ${isSelected ? 'bg-orange-500 border-orange-700 -translate-y-2 shadow-xl' : 'bg-orange-200 border-orange-300 hover:bg-orange-300'}
                                     ${isSafe && gameState === 'result' ? 'bg-green-500 border-green-700 scale-110 z-20' : ''}
                                     ${isLost ? 'bg-red-500 border-red-700 opacity-50 grayscale' : ''}
                                     disabled:cursor-not-allowed
                                 `}
                             >
                                 <span className="text-3xl mb-2">{i === 0 ? '🏜️' : i === 1 ? '🌴' : '⛰️'}</span>
                                 <span className={`text-xs font-bold ${isSelected || isSafe ? 'text-white' : 'text-orange-900'}`}>
                                     {path.name}
                                 </span>
                                 {isSafe && gameState === 'result' && <span className="text-white font-bold mt-1">نجاة!</span>}
                                 {isLost && <span className="text-white font-bold mt-1">ضياع ☠️</span>}
                             </button>
                         );
                     })}
                 </div>
            </div>

            <div className="bg-white/80 p-4 rounded-xl border-2 border-orange-200 backdrop-blur-sm z-30">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={gameState !== 'choosing'} />
            </div>
        </div>
    );
};

export default DesertCaravanGame;
