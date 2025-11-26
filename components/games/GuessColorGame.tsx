
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, GuessColorGameState } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { convertTimestamps } from '../utils/convertTimestamps';

interface UserProfile extends AppUser { balance: number; }
interface GuessColorGameProps { userProfile: UserProfile | null; onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>; onAnnounceWin: any; }

const COLORS = [
    { id: 'red', name: 'أحمر', bg: 'bg-red-600' },
    { id: 'green', name: 'أخضر', bg: 'bg-green-600' },
    { id: 'blue', name: 'أزرق', bg: 'bg-blue-600' },
    { id: 'yellow', name: 'أصفر', bg: 'bg-yellow-500' },
];

const GuessColorGame: React.FC<GuessColorGameProps> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<GuessColorGameState | null>(null);
    const [bet, setBet] = useState(100);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [hasBet, setHasBet] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [winMessage, setWinMessage] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'public', 'guessColor'), (s) => {
            if (s.exists()) {
                const data = convertTimestamps(s.data()) as GuessColorGameState;
                setGameState(data);
                if (data.status === 'betting') {
                    setHasBet(false);
                    setSelectedColor(null);
                    setWinMessage('');
                    setShowConfetti(false);
                } else if (data.status === 'result') {
                    if (hasBet && selectedColor === data.result) {
                        setWinMessage('إجابة صحيحة! 🎉');
                        setShowConfetti(true);
                    } else if (hasBet) {
                        setWinMessage('إجابة خاطئة.');
                    }
                }
            }
        });
        return () => unsub();
    }, [hasBet, selectedColor]);

    const handleBet = async () => {
        if (!selectedColor || !userProfile || gameState?.status !== 'betting') return;
        const success = await onBalanceUpdate(-bet, 'guessColor');
        if (success) {
            setHasBet(true);
            await runTransaction(db, async (t) => {
                const ref = doc(db, 'public', 'guessColor');
                const docSnap = await t.get(ref);
                const current = docSnap.data() as GuessColorGameState;
                const bets = current.bets || {};
                bets[userProfile.uid] = { userId: userProfile.uid, nickname: userProfile.displayName || 'P', amount: bet, choice: selectedColor, timestamp: Date.now(), avatar: '' };
                t.update(ref, { bets });
            });
            addToast('تم الرهان!', 'success');
        }
    };

    return (
        <div className="flex flex-col items-center justify-between h-full p-4">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="text-center mt-4">
                <h2 className="text-xl font-bold text-white">
                    {gameState?.status === 'betting' ? 'اختر اللون الرابح' : gameState?.status === 'revealing' ? 'جاري الكشف...' : 'النتيجة'}
                </h2>
                {gameState?.result && gameState.status === 'result' && (
                    <div className={`mt-2 text-2xl font-black uppercase ${gameState.result === 'red' ? 'text-red-500' : gameState.result === 'green' ? 'text-green-500' : gameState.result === 'blue' ? 'text-blue-500' : 'text-yellow-500'}`}>
                        {COLORS.find(c => c.id === gameState.result)?.name}
                    </div>
                )}
                <div className="text-lg text-yellow-300">{winMessage}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md my-4">
                {COLORS.map(color => (
                    <button
                        key={color.id}
                        onClick={() => setSelectedColor(color.id)}
                        disabled={gameState?.status !== 'betting' || hasBet}
                        className={`h-24 rounded-xl shadow-lg transition-transform ${color.bg} ${selectedColor === color.id ? 'scale-105 ring-4 ring-white' : 'opacity-80'} disabled:opacity-50`}
                    >
                        <span className="text-xl font-bold text-white drop-shadow-md">{color.name}</span>
                    </button>
                ))}
            </div>

            <div className="w-full max-w-sm">
                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={gameState?.status !== 'betting' || hasBet} />
                <button onClick={handleBet} disabled={gameState?.status !== 'betting' || hasBet || !selectedColor} className="w-full py-3 mt-4 bg-purple-600 text-white rounded-xl font-bold disabled:bg-gray-600">تأكيد الرهان</button>
            </div>
        </div>
    );
};
export default GuessColorGame;
