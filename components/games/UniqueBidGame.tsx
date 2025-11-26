
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import HowToPlay from '../HowToPlay';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
    onAnnounceWin: (nickname: string, amount: number, gameName: GameId) => void;
}

const ENTRY_FEE = 50;
const JACKPOT = 10000;

interface Bid {
    value: number;
    isMine: boolean;
    timestamp: number;
}

const UniqueBidGame: React.FC<Props> = ({ userProfile, onBalanceUpdate, onAnnounceWin }) => {
    const { addToast } = useToast();
    const [bidAmount, setBidAmount] = useState('');
    // Initialize with some dummy data to make it look alive immediately
    const [allBids, setAllBids] = useState<Bid[]>([
        { value: 8, isMine: false, timestamp: Date.now() - 10000 },
        { value: 15, isMine: false, timestamp: Date.now() - 5000 },
    ]);
    const [statusMessage, setStatusMessage] = useState("المزاد مفتوح! كن صاحب أقل رقم وحيد.");
    const [isWinning, setIsWinning] = useState(false);
    
    const myBids = useMemo(() => allBids.filter(b => b.isMine).sort((a, b) => b.timestamp - a.timestamp), [allBids]);

    // Calculate Lowest Unique Bid
    const lowestUnique = useMemo(() => {
        const counts: Record<number, number> = {};
        allBids.forEach(b => counts[b.value] = (counts[b.value] || 0) + 1);
        const uniqueValues = Object.keys(counts).map(Number).filter(v => counts[v] === 1);
        if (uniqueValues.length === 0) return null;
        const minVal = Math.min(...uniqueValues);
        return allBids.find(b => b.value === minVal) || null;
    }, [allBids]);

    // Update Status Message based on state
    useEffect(() => {
        if (!lowestUnique) {
            setStatusMessage("لا يوجد رقم وحيد حالياً! المنافسة محتدمة.");
            setIsWinning(false);
        } else if (lowestUnique.isMine) {
            setStatusMessage(`🎉 أنت الفائز حالياً بالرقم ${lowestUnique.value}! حافظ على موقعك.`);
            setIsWinning(true);
        } else {
            setStatusMessage("تغير الوضع! العرض الفريد الآن في نطاق آخر.");
            setIsWinning(false);
        }
    }, [lowestUnique]);

    // Bot Simulation - Constant Activity
    useEffect(() => {
        const interval = setInterval(() => {
            // Bots bid mostly low numbers (1-20) to create collisions
            const randomVal = Math.floor(Math.random() * 25) + 1;
            addBid(randomVal, false);
        }, 3500); // New bid every 3.5 seconds

        return () => clearInterval(interval);
    }, []);

    const addBid = (val: number, isMine: boolean) => {
        setAllBids(prev => {
            const newBids = [...prev, { value: val, isMine, timestamp: Date.now() }];
            // Keep history manageable
            return newBids.slice(-100);
        });
    };

    const handleBid = async () => {
        const bid = parseInt(bidAmount);
        
        if (isNaN(bid) || bid <= 0) {
            addToast('أدخل رقماً صحيحاً (أكبر من 0)', 'error');
            return;
        }

        // Allow duplicates (strategy), but maybe warn? 
        // In real reverse auction, duplicate kills the previous unique, so it's valid strategy to attack.
        
        if (userProfile.balance < ENTRY_FEE) {
            addToast(`رصيد غير كاف (الرسوم ${ENTRY_FEE})`, 'error');
            return;
        }

        const success = await onBalanceUpdate(-ENTRY_FEE, 'uniqueBid');
        if (success) {
            addBid(bid, true);
            addToast(`تم تسجيل العرض: ${bid}`, 'success');
            setBidAmount('');
        }
    };

    return (
        <div className="flex flex-col h-full p-4 items-center justify-center bg-gray-900 relative overflow-hidden">
            <HowToPlay>
                <p>1. الهدف: كتابة <strong>أصغر رقم صحيح موجب</strong> لا يكتبه أحد غيرك.</p>
                <p>2. تكلفة المحاولة الواحدة {ENTRY_FEE} 💎.</p>
                <p>3. هذا المزاد مفتوح ومستمر، لا يوجد وقت محدد للنهاية.</p>
                <p>4. حاول أن تجد الرقم الذي يجعلك "صاحب أقل رقم وحيد" لأطول فترة ممكنة.</p>
                <p>5. إذا كتب شخص آخر نفس رقمك، يحترق الرقم ويخرج كلاهما من المنافسة.</p>
            </HowToPlay>

            <div className="w-full max-w-md bg-[#4a148c] rounded-3xl p-1 shadow-2xl border border-[#7c43bd] relative overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
                
                {/* Header Area */}
                <div className="text-center pt-8 pb-4 relative z-10">
                    <div className="flex justify-center items-center gap-2 mb-2">
                        <span className="text-3xl">🔨</span>
                        <h2 className="text-3xl font-black text-yellow-400 drop-shadow-md">المزاد العكسي</h2>
                    </div>
                    <p className="text-white text-xs opacity-90 px-8 leading-relaxed">
                        الفائز هو صاحب <span className="text-green-300 font-bold">أقل رقم وحيد</span> لم يكتبه أحد غيره.
                        <br/>
                        الجائزة: <span className="font-bold text-yellow-300">{formatNumber(JACKPOT)}</span>
                    </p>
                </div>

                {/* Status Box */}
                <div className="mx-6 my-4 bg-[#1a0b2e] rounded-xl p-6 text-center border border-purple-500/30 shadow-inner relative overflow-hidden min-h-[100px] flex items-center justify-center">
                    <p className={`text-sm sm:text-base font-bold leading-relaxed transition-all duration-500 ${isWinning ? 'text-green-400' : 'text-cyan-400'}`}>
                        {statusMessage}
                    </p>
                    {/* Decorative pulse */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50 animate-pulse"></div>
                </div>

                {/* Input Area */}
                <div className="px-6 pb-4 flex flex-col gap-3 z-10">
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            placeholder="اكتب عرضك..."
                            className="flex-grow bg-[#2d1b4e] border-2 border-[#5b32a8] rounded-lg px-4 py-3 text-white text-right placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-colors"
                            onKeyDown={(e) => e.key === 'Enter' && handleBid()}
                        />
                    </div>
                    <button 
                        onClick={handleBid}
                        className="w-full bg-[#a855f7] hover:bg-[#9333ea] text-white font-bold py-3 rounded-lg shadow-lg transition-all transform active:scale-95 flex justify-center items-center gap-2"
                    >
                        <span>تأكيد</span>
                        <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">({ENTRY_FEE} 💎)</span>
                    </button>
                </div>

                {/* My Bids History */}
                <div className="flex-grow bg-[#250e47] mt-2 p-4 relative">
                    <p className="text-gray-400 text-xs mb-3 text-right">عروضك السابقة:</p>
                    <div className="flex flex-wrap gap-2 justify-end max-h-[100px] overflow-y-auto custom-scrollbar">
                        {myBids.length > 0 ? myBids.map((b, i) => {
                            // Check if this specific bid is still unique (visual helper)
                            // Note: This is simple client-side check on 'allBids'
                            const count = allBids.filter(x => x.value === b.value).length;
                            const isStillUnique = count === 1;
                            const isLowest = lowestUnique?.value === b.value;

                            return (
                                <div key={i} className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-sm border transition-all animate-pop-in
                                    ${isLowest ? 'bg-green-600 border-green-400 text-white scale-110 shadow-[0_0_10px_green]' : 
                                      !isStillUnique ? 'bg-red-900/50 border-red-800 text-red-300 opacity-60 line-through' : 
                                      'bg-gray-700 border-gray-600 text-gray-300'}
                                `}>
                                    {b.value}
                                </div>
                            )
                        }) : (
                            <span className="text-gray-600 text-xs">لا توجد عروض سابقة</span>
                        )}
                    </div>
                </div>

                {/* Floating Decorations */}
                <div className="absolute top-10 right-10 text-6xl opacity-5 pointer-events-none select-none">🔨</div>
                <div className="absolute bottom-20 left-5 text-8xl opacity-5 pointer-events-none select-none">💎</div>
            </div>
            
            <style>{`
                @keyframes pop-in { 0% { transform: scale(0); } 80% { transform: scale(1.1); } 100% { transform: scale(1); } }
                .animate-pop-in { animation: pop-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default UniqueBidGame;
