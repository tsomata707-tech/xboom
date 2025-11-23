
import React, { useState, useEffect } from 'react';
import type { AppUser, GameId } from '../../types';
import { useToast } from '../../AuthGate';
import { formatNumber } from '../utils/formatNumber';
import Confetti from '../Confetti';
import HowToPlay from '../HowToPlay';

interface Props {
    userProfile: AppUser & { balance: number };
    onBalanceUpdate: (amount: number, gameId: GameId) => Promise<boolean>;
}

const BankOfLuckGame: React.FC<Props> = ({ userProfile, onBalanceUpdate }) => {
    const { addToast } = useToast();
    const [pot, setPot] = useState(10000);
    const [timeLeft, setTimeLeft] = useState(59);
    const [hasJoined, setHasJoined] = useState(false);
    const [participants, setParticipants] = useState(12);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 0) {
                    // Round End Simulation
                    if (hasJoined) {
                        // 5% chance to be the big winner
                        if (Math.random() < 0.05) {
                            const win = pot * 0.5;
                            onBalanceUpdate(win, 'bankOfLuck');
                            addToast(`أنت السارق المحظوظ! ربحت ${formatNumber(win)}`, 'success');
                        } else {
                            addToast('لم يحالفك الحظ هذه المرة.', 'info');
                        }
                        setHasJoined(false);
                    }
                    setPot(10000);
                    setParticipants(10 + Math.floor(Math.random() * 10));
                    return 59;
                }
                // Simulate pot growth
                if (Math.random() < 0.3) {
                    setPot(p => p + 200);
                    setParticipants(p => p + 1);
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [hasJoined, pot, onBalanceUpdate, addToast]);

    const joinPot = async () => {
        if (hasJoined) return;
        const fee = 200;
        if (userProfile.balance < fee) {
            addToast('رصيد غير كاف', 'error');
            return;
        }
        const success = await onBalanceUpdate(-fee, 'bankOfLuck');
        if (success) {
            setHasJoined(true);
            setPot(prev => prev + fee);
            setParticipants(prev => prev + 1);
            addToast('دخلت السحب بنجاح!', 'success');
        }
    };

    return (
        <div className="flex flex-col h-full items-center justify-center p-4 relative overflow-hidden bg-[#1a1a1a]">
             <HowToPlay>
                <p>1. ادفع رسوم الاشتراك (200 💎) للدخول في السحب.</p>
                <p>2. تزداد قيمة الخزنة كلما انضم لاعبون جدد.</p>
                <p>3. انتظر انتهاء المؤقت (جولة كل 60 ثانية).</p>
                <p>4. عند انتهاء الوقت، يختار النظام فائزاً واحداً عشوائياً.</p>
                <p>5. إذا حالفك الحظ، ستفوز بنسبة كبيرة من قيمة الخزنة!</p>
            </HowToPlay>

             <div className="absolute top-0 left-0 w-full h-1 bg-gray-800">
                 <div className="h-full bg-yellow-500 transition-all duration-1000" style={{ width: `${(timeLeft / 60) * 100}%` }}></div>
             </div>

             <div className="relative z-10 text-center">
                 <div className="w-48 h-48 mx-auto bg-yellow-500/10 rounded-full flex items-center justify-center border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)] mb-6 animate-pulse">
                     <div className="text-center">
                         <span className="text-4xl">🏦</span>
                         <p className="text-3xl font-black text-white mt-2">{formatNumber(pot)}</p>
                         <p className="text-xs text-yellow-200 uppercase tracking-widest">خزنة الحظ</p>
                     </div>
                 </div>
                 
                 <div className="flex justify-center gap-8 mb-8 text-sm text-gray-400">
                     <div>
                         <p className="font-bold text-white">{participants}</p>
                         <p>مشترك</p>
                     </div>
                     <div>
                         <p className="font-bold text-red-400">{timeLeft}s</p>
                         <p>متبقي</p>
                     </div>
                 </div>

                 <button
                    onClick={joinPot}
                    disabled={hasJoined}
                    className={`w-full max-w-xs py-4 rounded-xl font-bold text-xl shadow-lg transition-all transform active:scale-95
                        ${hasJoined 
                            ? 'bg-green-600 text-white cursor-default' 
                            : 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black'}
                    `}
                 >
                     {hasJoined ? 'تم الاشتراك ✅' : 'اشتراك بـ 200 💎'}
                 </button>
             </div>
        </div>
    );
};

export default BankOfLuckGame;