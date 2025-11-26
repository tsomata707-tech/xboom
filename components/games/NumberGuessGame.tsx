
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, NumberGuessGameState } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { convertTimestamps } from '../utils/convertTimestamps';

interface UserProfile extends AppUser { balance: number; }
interface Props { userProfile: UserProfile | null; onBalanceUpdate: any; onAnnounceWin: any; }

const NumberGuessGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<NumberGuessGameState | null>(null);
    const [bet, setBet] = useState(100);
    const [selectedNum, setSelectedNum] = useState<number | null>(null);
    const [hasBet, setHasBet] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'public', 'numberGuess'), (s) => {
            if (s.exists()) {
                const data = convertTimestamps(s.data()) as NumberGuessGameState;
                setGameState(data);
                if (data.status === 'betting') {
                    setHasBet(false);
                    setSelectedNum(null);
                    setShowConfetti(false);
                } else if (data.status === 'result') {
                    if (hasBet && selectedNum === data.result) setShowConfetti(true);
                }
            }
        });
        return () => unsub();
    }, [hasBet, selectedNum]);

    const handleBet = async (num: number) => {
        if (!userProfile || gameState?.status !== 'betting') return;
        const success = await onBalanceUpdate(-bet, 'numberGuess');
        if (success) {
            setSelectedNum(num);
            setHasBet(true);
            addToast(`تم اختيار الرقم ${num}`, 'success');
        }
    };

    return (
        <div className="flex flex-col items-center justify-between h-full p-4">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-cyan-400">
                    {gameState?.status === 'result' ? `الرقم الفائز: ${gameState.result}` : 'خمن الرقم (1-10)'}
                </h2>
            </div>
            <div className="grid grid-cols-5 gap-3 w-full max-w-md">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                    <button
                        key={num}
                        onClick={() => handleBet(num)}
                        disabled={hasBet || gameState?.status !== 'betting'}
                        className={`aspect-square rounded-lg border-2 text-2xl font-bold transition-all ${selectedNum === num ? 'bg-purple-600 border-white' : 'bg-gray-800 border-gray-600'} ${gameState?.status === 'result' && gameState.result === num ? 'bg-green-500 animate-bounce' : ''}`}
                    >
                        {num}
                    </button>
                ))}
            </div>
            <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={hasBet || gameState?.status !== 'betting'} />
        </div>
    );
};
export default NumberGuessGame;
