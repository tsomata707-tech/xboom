
import React, { useState, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const QUESTIONS = [
    { q: "بيتزا أم برجر؟", a: "🍕 بيتزا", b: "🍔 برجر" },
    { q: "صيف أم شتاء؟", a: "☀️ صيف", b: "❄️ شتاء" },
    { q: "قهوة أم شاي؟", a: "☕ قهوة", b: "🍵 شاي" },
    { q: "أندرويد أم أيفون؟", a: "🤖 أندرويد", b: "🍎 أيفون" },
];

const MajorityRulesGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [gameState, setGameState] = useState<'voting' | 'calculating' | 'result'>('voting');
    const [question, setQuestion] = useState(QUESTIONS[0]);
    const [myVote, setMyVote] = useState<'a' | 'b' | null>(null);
    const [stats, setStats] = useState({ a: 50, b: 50 });
    const [timeLeft, setTimeLeft] = useState(10);
    const [showConfetti, setShowConfetti] = useState(false);

    const BET_AMOUNT = 100;

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (gameState === 'voting') {
                        setGameState('calculating');
                        return 2;
                    } else if (gameState === 'calculating') {
                        determineWinner();
                        return 5; // Show results
                    } else {
                        // Reset
                        setGameState('voting');
                        setQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
                        setMyVote(null);
                        setStats({ a: 50, b: 50 });
                        setShowConfetti(false);
                        return 10;
                    }
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [gameState, myVote]); // myVote dependency to ensure latest state is used in determineWinner if needed

    const vote = async (option: 'a' | 'b') => {
        if (gameState !== 'voting' || myVote) return;
        if (userProfile.balance < BET_AMOUNT) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-BET_AMOUNT, 'majorityRules');
        if (success) {
            setMyVote(option);
            addToast('تم تسجيل تصويتك', 'success');
        }
    };

    const determineWinner = () => {
        // Simulate random majority
        const percentA = Math.floor(Math.random() * 60) + 20; // 20% to 80%
        const majority = percentA > 50 ? 'a' : 'b';
        setStats({ a: percentA, b: 100 - percentA });
        setGameState('result');

        if (myVote) {
            if (myVote === majority) {
                const win = BET_AMOUNT * 1.8;
                onBalanceUpdate(win, 'majorityRules');
                addToast(`كنت مع الأغلبية! ربحت ${formatNumber(win)}`, 'success');
                setShowConfetti(true);
            } else {
                addToast('كنت مع الأقلية. خسرت.', 'error');
            }
        }
    };

    return (
        <div className="flex flex-col h-full p-4 items-center justify-center text-center">
            {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
            
            <div className="mb-8">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">تحدي الأغلبية</span>
                <h2 className="text-3xl font-black text-white mt-2">{question.q}</h2>
                <p className="text-gray-400 text-sm mt-2">اختر ما سيختاره الأغلبية لتربح</p>
            </div>

            {gameState === 'voting' ? (
                <div className="flex gap-4 w-full max-w-md">
                    <button 
                        onClick={() => vote('a')}
                        disabled={myVote !== null}
                        className={`flex-1 py-8 rounded-2xl font-bold text-xl transition-all ${myVote === 'a' ? 'bg-blue-600 ring-4 ring-blue-400' : 'bg-gray-800 hover:bg-gray-700'} ${myVote === 'b' ? 'opacity-50' : ''}`}
                    >
                        {question.a}
                    </button>
                    <div className="flex items-center font-black text-gray-600">OR</div>
                    <button 
                        onClick={() => vote('b')}
                        disabled={myVote !== null}
                        className={`flex-1 py-8 rounded-2xl font-bold text-xl transition-all ${myVote === 'b' ? 'bg-pink-600 ring-4 ring-pink-400' : 'bg-gray-800 hover:bg-gray-700'} ${myVote === 'a' ? 'opacity-50' : ''}`}
                    >
                        {question.b}
                    </button>
                </div>
            ) : (
                <div className="w-full max-w-md">
                    <div className="flex justify-between mb-2 font-bold text-lg">
                        <span className="text-blue-400">{stats.a}%</span>
                        <span className="text-pink-400">{stats.b}%</span>
                    </div>
                    <div className="h-8 w-full bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="bg-blue-600 h-full transition-all duration-1000 ease-out" style={{ width: `${stats.a}%` }}></div>
                        <div className="bg-pink-600 h-full transition-all duration-1000 ease-out" style={{ width: `${stats.b}%` }}></div>
                    </div>
                    <p className="mt-4 text-xl font-bold text-white">
                        {gameState === 'calculating' ? 'جاري فرز الأصوات...' : (
                            stats.a > stats.b ? `الأغلبية اختارت ${question.a}` : `الأغلبية اختارت ${question.b}`
                        )}
                    </p>
                </div>
            )}

            <div className="mt-8 text-gray-500 text-sm">
                الوقت المتبقي: <span className="text-white font-bold">{timeLeft}s</span>
            </div>
        </div>
    );
};

export default MajorityRulesGame;
