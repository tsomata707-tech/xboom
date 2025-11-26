
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppUser, GameId, DiceRollGameState } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import Confetti from '../Confetti';
import { convertTimestamps } from '../utils/convertTimestamps';

interface UserProfile extends AppUser {
    balance: number;
}

interface DiceRollGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const DICE_FACES: { [key: number]: string } = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

const DiceRollGame: React.FC<DiceRollGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<DiceRollGameState | null>(null);
    const [bet, setBet] = useState(100);
    const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
    const [hasBet, setHasBet] = useState(false);
    const [displayDice, setDisplayDice] = useState(1);
    const [showConfetti, setShowConfetti] = useState(false);
    const [winMessage, setWinMessage] = useState<string>('');

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'public', 'diceRoll'), (docSnap) => {
            if (docSnap.exists()) {
                const data = convertTimestamps(docSnap.data()) as DiceRollGameState;
                setGameState(data);

                if (data.status === 'betting') {
                    setHasBet(false);
                    setSelectedNumber(null);
                    setWinMessage('');
                    setShowConfetti(false);
                } else if (data.status === 'rolling') {
                    // Animation
                    const interval = setInterval(() => setDisplayDice(Math.ceil(Math.random() * 6)), 100);
                    setTimeout(() => { clearInterval(interval); if(data.result) setDisplayDice(data.result); }, 3000);
                } else if (data.status === 'result') {
                    setDisplayDice(data.result || 1);
                    if (hasBet && selectedNumber === data.result) {
                        setWinMessage(`مبروك! ظهر الرقم ${data.result}`);
                        setShowConfetti(true);
                        // Win amount is handled by server engine, but we can show UI feedback
                    } else if (hasBet) {
                        setWinMessage(`خسارة. الرقم كان ${data.result}`);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, [hasBet, selectedNumber]);

    const handleBet = async () => {
        if (!selectedNumber || !userProfile || !gameState) return;
        if (gameState.status !== 'betting') return;
        
        const success = await onBalanceUpdate(-bet, 'diceRoll');
        if (success) {
            setHasBet(true);
            await runTransaction(db, async (t) => {
                const ref = doc(db, 'public', 'diceRoll');
                const s = await t.get(ref);
                const d = s.data() as DiceRollGameState;
                const bets = d.bets || {};
                bets[userProfile.uid] = { userId: userProfile.uid, nickname: userProfile.displayName || 'User', amount: bet, choice: selectedNumber, timestamp: Date.now(), avatar: '' };
                t.update(ref, { bets });
            });
            addToast('تم الرهان!', 'success');
        }
    };

    return (
        <div className="flex flex-col items-center justify-around h-full p-4 relative">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="text-center">
                <p className={`font-bold ${gameState?.status === 'betting' ? 'text-green-400' : 'text-red-400'}`}>
                    {gameState?.status === 'betting' ? 'اختر رقماً' : 'النتيجة...'}
                </p>
            </div>

            <div className="text-9xl text-white transition-transform duration-100">
                {DICE_FACES[displayDice]}
            </div>

            <div className="h-8 text-xl font-bold text-center">{winMessage}</div>
            
            <div className="grid grid-cols-6 gap-2 w-full max-w-lg">
                {[1, 2, 3, 4, 5, 6].map(num => (
                    <button
                        key={num}
                        onClick={() => setSelectedNumber(num)}
                        disabled={gameState?.status !== 'betting' || hasBet}
                        className={`aspect-square text-3xl rounded-lg border-4 transition-all ${selectedNumber === num ? 'border-yellow-400 bg-yellow-900/50' : 'border-gray-600 bg-gray-800'} disabled:opacity-50`}
                    >
                        {DICE_FACES[num]}
                    </button>
                ))}
            </div>

            <div className="w-full max-w-sm mt-4">
                <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={gameState?.status !== 'betting' || hasBet} />
                <button onClick={handleBet} disabled={gameState?.status !== 'betting' || hasBet || !selectedNumber} className="w-full py-3 mt-4 text-xl font-bold bg-blue-600 rounded-lg text-white disabled:opacity-50">
                    {hasBet ? 'انتظر النتيجة...' : 'تأكيد الرهان'}
                </button>
            </div>
        </div>
    );
};

export default DiceRollGame;
