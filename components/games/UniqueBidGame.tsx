
import React, { useState } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const UniqueBidGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [bidAmount, setBidAmount] = useState('');
    const [myBids, setMyBids] = useState<number[]>([]);
    
    // Simulated Leaderboard (Obscured)
    const [leaderboardStatus, setLeaderboardStatus] = useState("أقل عرض فريد حالياً بين 10 و 50");

    const handleBid = async () => {
        const bid = parseInt(bidAmount);
        const fee = 50; // Cost to place a bid
        
        if (isNaN(bid) || bid <= 0) {
            addToast('أدخل رقماً صحيحاً', 'error');
            return;
        }
        if (userProfile.balance < fee) {
            addToast('رصيد غير كاف (الرسوم 50)', 'error');
            return;
        }

        const success = await onBalanceUpdate(-fee, 'uniqueBid');
        if (success) {
            setMyBids(prev => [...prev, bid]);
            addToast('تم تسجيل عرضك بنجاح!', 'success');
            setBidAmount('');
            
            // Simulate update
            if (Math.random() > 0.7) {
                setLeaderboardStatus("تغير الوضع! العرض الفريد الآن في نطاق آخر.");
            }
        }
    };

    return (
        <div className="flex flex-col h-full p-4 items-center justify-center bg-gray-900">
            <div className="bg-gradient-to-b from-purple-900 to-gray-800 p-6 rounded-2xl border border-purple-500/30 shadow-2xl w-full max-w-md text-center">
                <h2 className="text-2xl font-bold text-yellow-300 mb-2">المزاد العكسي 🔨</h2>
                <p className="text-gray-300 text-sm mb-6">
                    الفائز هو صاحب <span className="text-green-400 font-bold">أقل رقم وحيد</span> لم يكتبه أحد غيره.
                    <br/>الجائزة: <span className="text-yellow-400 font-bold">10,000 💎</span>
                </p>

                <div className="bg-black/40 p-4 rounded-lg mb-6 border border-dashed border-gray-600">
                    <p className="text-xs text-gray-400 mb-1">حالة المزاد</p>
                    <p className="text-cyan-400 font-mono animate-pulse">{leaderboardStatus}</p>
                </div>

                <div className="flex gap-2 mb-4">
                    <input 
                        type="number" 
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="اكتب عرضك..."
                        className="flex-grow bg-gray-700 border border-gray-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                    />
                    <button 
                        onClick={handleBid}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-2 rounded-lg transition shadow-lg"
                    >
                        تأكيد (50💎)
                    </button>
                </div>

                {myBids.length > 0 && (
                    <div className="text-left">
                        <p className="text-xs text-gray-500 mb-2">عروضك السابقة:</p>
                        <div className="flex flex-wrap gap-2">
                            {myBids.map((b, i) => (
                                <span key={i} className="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">{b}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniqueBidGame;
