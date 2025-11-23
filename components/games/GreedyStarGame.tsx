import React from 'react';
import type { AppUser, GameId } from '../../types';

interface UserProfile extends AppUser {
    balance: number;
}

interface GreedyStarGameProps {
    userProfile: UserProfile | null;
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const GreedyStarGame: React.FC<GreedyStarGameProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <h2 className="text-3xl font-bold text-cyan-400">لعبة خضار اكس بوم</h2>
      <p className="text-gray-400 mt-4 text-lg">
        ⚙️ هذه اللعبة تخضع للصيانة حاليًا لتحسين الأداء. ⚙️
      </p>
      <p className="text-gray-500 mt-2">
        نعتذر عن الإزعاج، ستعود اللعبة قريبًا بشكل أفضل!
      </p>
    </div>
  );
};

export default GreedyStarGame;
