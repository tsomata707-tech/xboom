
import React, { useState, useEffect } from 'react';
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

const TARGETS = [
    { id: 'bank', name: 'البنك المركزي', difficulty: 'Easy', icon: '🏦', multiplier: 2.8 },
    { id: 'cloud', name: 'السحابة', difficulty: 'Med', icon: '☁️', multiplier: 2.8 },
    { id: 'gov', name: 'قاعدة البيانات', difficulty: 'Hard', icon: '🗄️', multiplier: 2.8 },
];

const CyberHackGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [hackingState, setHackingState] = useState<'idle' | 'hacking' | 'success' | 'fail'>('idle');
    const [targetIndex, setTargetIndex] = useState<number | null>(null);
    const [bet, setBet] = useState(100);
    const [hackProgress, setHackProgress] = useState(0);
    const [logs, setLogs] = useState<string[]>([]);
    const [showConfetti, setShowConfetti] = useState(false);

    const startHack = async (index: number) => {
        if (hackingState === 'hacking') return;
        if (bet > userProfile.balance) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-bet, 'cyberHack');
        if (!success) return;

        setHackingState('hacking');
        setTargetIndex(index);
        setHackProgress(0);
        setLogs(['Initializing handshake...', 'Bypassing firewall...', 'Injecting payload...']);
        setShowConfetti(false);

        let p = 0;
        const interval = setInterval(() => {
            p += Math.random() * 15;
            if (p > 100) p = 100;
            setHackProgress(p);
            
            if (p >= 100) {
                clearInterval(interval);
                finishHack();
            }
        }, 200);
    };

    const finishHack = () => {
        // 1 in 3 chance to win
        const win = Math.random() < 0.33;
        
        if (win && targetIndex !== null) {
            setHackingState('success');
            const winAmount = bet * 2.8;
            onBalanceUpdate(winAmount, 'cyberHack');
            setLogs(prev => [...prev, 'ACCESS GRANTED', `Credits Transferred: ${formatNumber(winAmount)}`]);
            addToast('تم الاختراق بنجاح! 🔓', 'success');
            setShowConfetti(true);
        } else {
            setHackingState('fail');
            setLogs(prev => [...prev, 'ACCESS DENIED', 'Connection Terminated.']);
            addToast('فشل الاختراق. تم كشفك! 🚨', 'error');
        }

        setTimeout(() => {
            setHackingState('idle');
            setTargetIndex(null);
            setLogs([]);
            setHackProgress(0);
        }, 3000);
    };

    return (
        <div className="flex flex-col h-full p-4 bg-black font-mono text-green-500 relative overflow-hidden">
             <HowToPlay>
                <p>1. اختر هدفاً للاختراق (خادم).</p>
                <p>2. جميع الأهداف لها نفس فرصة النجاح (33%) ونفس الربح (x2.8).</p>
                <p>3. النظام سيحاول اختراق الهدف.</p>
                <p>4. إذا نجح الاختراق (ACCESS GRANTED)، تربح الجائزة.</p>
                <p>5. إذا فشل (ACCESS DENIED)، تخسر الرهان.</p>
            </HowToPlay>
            
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            {/* Matrix Background Effect (Static for perf) */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 255, 0, .3) 25%, rgba(0, 255, 0, .3) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, .3) 75%, rgba(0, 255, 0, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 255, 0, .3) 25%, rgba(0, 255, 0, .3) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, .3) 75%, rgba(0, 255, 0, .3) 76%, transparent 77%, transparent)', backgroundSize: '30px 30px' }}></div>

            {/* Terminal Screen */}
            <div className="bg-gray-900 border border-green-500/50 rounded-lg p-4 h-32 mb-4 overflow-y-auto shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                <p className="text-xs opacity-50 mb-2">root@xboom-terminal:~#</p>
                {logs.map((log, i) => (
                    <p key={i} className={`text-sm ${log.includes('DENIED') ? 'text-red-500' : log.includes('GRANTED') ? 'text-green-400 font-bold' : 'text-green-700'}`}>
                        {`> ${log}`}
                    </p>
                ))}
                {hackingState === 'hacking' && (
                     <div className="w-full h-1 bg-gray-800 mt-2 rounded overflow-hidden">
                         <div className="h-full bg-green-500 transition-all duration-200" style={{ width: `${hackProgress}%` }}></div>
                     </div>
                )}
            </div>

            {/* Targets */}
            <div className="flex-grow grid grid-cols-1 gap-3">
                {TARGETS.map((target, i) => (
                    <button
                        key={i}
                        onClick={() => startHack(i)}
                        disabled={hackingState !== 'idle'}
                        className={`
                            relative p-4 border-2 rounded-xl flex items-center justify-between transition-all group
                            ${targetIndex === i && hackingState === 'hacking' ? 'border-yellow-500 bg-yellow-900/20 animate-pulse' : ''}
                            ${targetIndex === i && hackingState === 'success' ? 'border-green-500 bg-green-900/20' : ''}
                            ${targetIndex === i && hackingState === 'fail' ? 'border-red-500 bg-red-900/20' : ''}
                            ${hackingState === 'idle' ? 'border-green-900 hover:border-green-500 bg-gray-900 hover:bg-gray-800' : ''}
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-3xl group-hover:animate-bounce">{target.icon}</span>
                            <div className="text-left">
                                <div className="font-bold text-lg">{target.name}</div>
                                <div className="text-xs opacity-70">Reward: <span className="text-green-400">x{target.multiplier}</span></div>
                            </div>
                        </div>
                        {targetIndex === i && hackingState !== 'idle' ? (
                             <span className="text-xl animate-spin">⚙️</span>
                        ) : (
                             <span className="text-2xl opacity-0 group-hover:opacity-100 transition-opacity">⚡</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="mt-4">
                <BetControls bet={bet} setBet={setBet} balance={userProfile.balance} disabled={hackingState !== 'idle'} />
            </div>
        </div>
    );
};

export default CyberHackGame;
