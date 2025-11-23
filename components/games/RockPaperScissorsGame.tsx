
import React, { useState } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import BetControls from '../BetControls';
import { formatNumber } from '../utils/formatNumber';
import HowToPlay from '../HowToPlay';

interface UserProfile extends AppUser {
    balance: number;
}

interface RockPaperScissorsGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

type Choice = 'rock' | 'paper' | 'scissors';
const CHOICES: Choice[] = ['rock', 'paper', 'scissors'];
const EMOJIS: { [key in Choice]: string } = {
    rock: '✊',
    paper: '✋',
    scissors: '✌️'
};
const WIN_MULTIPLIER = 2;

const RockPaperScissorsGame: React.FC<RockPaperScissorsGameProps> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bet, setBet] = useState(100);
    const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
    const [computerChoice, setComputerChoice] = useState<Choice | null>(null);
    const [result, setResult] = useState<'win' | 'loss' | 'draw' | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handlePlay = async (choice: Choice) => {
        if (isLoading) return;
        if (!userProfile || bet <= 0 || bet > userProfile.balance) {
            addToast('الرهان غير صالح أو رصيدك غير كافٍ.', 'error');
            return;
        }
        
        setIsLoading(true);
        setPlayerChoice(choice);
        setComputerChoice(null);
        setResult(null);

        const success = await onBalanceUpdate(-bet, 'rockPaperScissors');
        if (!success) {
            setIsLoading(false);
            return;
        }

        setTimeout(() => {
            const compChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)];
            setComputerChoice(compChoice);

            if (choice === compChoice) {
                setResult('draw');
                onBalanceUpdate(bet, 'rockPaperScissors'); // Return bet
            } else if (
                (choice === 'rock' && compChoice === 'scissors') ||
                (choice === 'paper' && compChoice === 'rock') ||
                (choice === 'scissors' && compChoice === 'paper')
            ) {
                const winnings = bet * WIN_MULTIPLIER;
                setResult('win');
                onBalanceUpdate(winnings, 'rockPaperScissors');
                if (winnings > 10000 && userProfile.displayName) {
                    onAnnounceWin(userProfile.displayName, winnings, 'rockPaperScissors');
                }
            } else {
                setResult('loss');
            }
            setIsLoading(false);
        }, 1500); // Suspense
    };

    const getResultMessage = () => {
        if (!result) return null;
        switch (result) {
            case 'win': return <span className="text-green-400">🎉 لقد فزت بـ {formatNumber(bet * WIN_MULTIPLIER)} 💎!</span>;
            case 'loss': return <span className="text-red-500">لقد خسرت.</span>;
            case 'draw': return <span className="text-gray-400">تعادل! تم إرجاع رهانك.</span>;
        }
    };
    
    return (
        <div className="flex flex-col items-center justify-around h-full p-4 relative">
             <HowToPlay>
                <p>1. حدد مبلغ الرهان.</p>
                <p>2. اضغط على الرمز الذي تريد لعبه: <strong>حجر (✊)</strong>، <strong>ورقة (✋)</strong>، أو <strong>مقص (✌️)</strong>.</p>
                <p>3. القواعد كالتالي:</p>
                <ul className="list-disc list-inside pr-4">
                    <li>الحجر يهزم المقص</li>
                    <li>الورقة تهزم الحجر</li>
                    <li>المقص يهزم الورقة</li>
                </ul>
                <p>4. إذا فزت، تربح ضعف رهانك. في حالة التعادل، يعود لك رهانك.</p>
            </HowToPlay>

            <div className="w-full flex justify-around items-center my-8">
                <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">أنت</h3>
                    <div className="w-28 h-28 sm:w-36 sm:h-36 bg-gray-700 rounded-full flex items-center justify-center text-6xl">
                        {playerChoice ? EMOJIS[playerChoice] : '?'}
                    </div>
                </div>
                <span className="text-4xl font-bold text-red-500">VS</span>
                 <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">الكمبيوتر</h3>
                    <div className="w-28 h-28 sm:w-36 sm:h-36 bg-gray-900 rounded-full flex items-center justify-center text-6xl">
                         {computerChoice ? EMOJIS[computerChoice] : (isLoading ? <div className="animate-spin text-4xl">⚙️</div> : '?')}
                    </div>
                </div>
            </div>

            <div className="h-10 text-xl font-bold text-center game-container-animation">
                {getResultMessage()}
            </div>
            
             <div className="w-full max-w-lg flex flex-col items-center gap-4">
                <p className="font-bold text-gray-300">اختر حركتك:</p>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full">
                    {CHOICES.map(choice => (
                        <button
                            key={choice}
                            onClick={() => handlePlay(choice)}
                            disabled={isLoading}
                            className="aspect-square text-4xl sm:text-5xl font-bold rounded-lg border-4 border-gray-600 bg-gray-700 hover:bg-gray-600 hover:border-cyan-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {EMOJIS[choice]}
                        </button>
                    ))}
                </div>
            </div>

            <BetControls bet={bet} setBet={setBet} balance={userProfile?.balance ?? 0} disabled={isLoading} />
        </div>
    );
};

export default RockPaperScissorsGame;
