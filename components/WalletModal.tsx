import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { convertTimestamps } from './utils/convertTimestamps';
import type { TransactionRequest } from '../types';
import DiamondIcon from './icons/DiamondIcon';
import { useToast } from '../AuthGate';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  userId: string;
  onRequestTransaction: (type: 'deposit' | 'withdraw', amount: number) => Promise<boolean>;
  formatNumber: (num: number) => string;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, balance, userId, onRequestTransaction, formatNumber }) => {
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingTransaction, setIsConfirmingTransaction] = useState(false);
  const [requests, setRequests] = useState<TransactionRequest[]>([]);
  const { addToast } = useToast();

  const MIN_DEPOSIT = 250;
  const MAX_DEPOSIT = 500_000;
  const MIN_WITHDRAW = 1000;
  const MAX_WITHDRAW = 150_000;
  const DIAMOND_TO_EGP_RATE = 0.2; // 1 diamond = 0.2 EGP
  
  useEffect(() => {
    if (!isOpen || !userId) {
        setRequests([]); // Clear requests when modal is not open
        return;
    }

    const transQuery = query(
        collection(db, 'transactions'), 
        where('userId', '==', userId), 
        orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(transQuery, (snapshot) => {
        const fetchedRequests = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...convertTimestamps(doc.data()) 
        } as TransactionRequest));
        setRequests(fetchedRequests);
    }, (error) => {
        console.error("Error fetching transactions inside WalletModal:", error.message);
        addToast("فشل تحميل سجل الطلبات.", "error");
    });

    // Cleanup listener on modal close or when userId/isOpen changes
    return () => unsubscribe();
  }, [isOpen, userId, addToast]);


  if (!isOpen) return null;
  
  const processTransaction = async () => {
    const numericAmount = Number(amount);
    setIsSubmitting(true);
    const success = await onRequestTransaction(activeTab, numericAmount);
    if (success) {
      addToast(`تم إرسال طلب ${activeTab === 'deposit' ? 'الإيداع' : 'السحب'} بنجاح.`, 'success');
      setAmount('');
    }
    setIsSubmitting(false);
  };

  const handleMainButtonClick = async () => {
      const numericAmount = Number(amount);

      if (isNaN(numericAmount) || numericAmount <= 0) {
        addToast('الرجاء إدخال مبلغ صالح.', 'error');
        return;
      }

      if (activeTab === 'deposit') {
          if (numericAmount < MIN_DEPOSIT) {
              addToast(`الحد الأدنى للإيداع هو ${formatNumber(MIN_DEPOSIT)} 💎`, 'error');
              return;
          }
          if (numericAmount > MAX_DEPOSIT) {
              addToast(`الحد الأقصى للإيداع في المرة الواحدة هو ${formatNumber(MAX_DEPOSIT)} 💎`, 'error');
              return;
          }
      }

      if (activeTab === 'withdraw') {
        if (numericAmount < MIN_WITHDRAW) {
            addToast(`الحد الأدنى للسحب هو ${formatNumber(MIN_WITHDRAW)} 💎`, 'error');
            return;
        }
        if (numericAmount > balance) {
            addToast('رصيدك غير كافٍ لإتمام عملية السحب.', 'error');
            return;
        }
        if (numericAmount > MAX_WITHDRAW) {
            addToast(`الحد الأقصى للسحب في المرة الواحدة هو ${formatNumber(MAX_WITHDRAW)} 💎`, 'error');
            return;
        }
      }
      setIsConfirmingTransaction(true);
  };
  
  const handleConfirmTransaction = async () => {
    setIsConfirmingTransaction(false);
    await processTransaction();
  };

  const getStatusChip = (status: TransactionRequest['status']) => {
      switch(status) {
          case 'pending': return 'bg-yellow-500/20 text-yellow-400';
          case 'approved': return 'bg-green-500/20 text-green-400';
          case 'rejected': return 'bg-red-500/20 text-red-500';
      }
  }

  const numericAmount = Number(amount) || 0;
  const monetaryValue = numericAmount * DIAMOND_TO_EGP_RATE;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-purple-900/40 p-6 relative game-container-animation" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-white transition">&times;</button>
        <h2 className="text-3xl font-bold text-purple-400 mb-2 text-center">المحفظة</h2>
        <div className="text-center mb-6">
            <p className="text-gray-400">رصيدك الحالي</p>
            <div className="flex items-center justify-center space-x-2">
                <DiamondIcon className="w-7 h-7 text-cyan-400"/>
                <span className="text-3xl font-bold">{formatNumber(balance)}</span>
            </div>
        </div>

        <div className="bg-gray-900/50 p-4 rounded-lg">
            <div className="flex border-b border-gray-700 mb-4">
                <button onClick={() => setActiveTab('deposit')} className={`flex-1 py-2 font-bold transition ${activeTab === 'deposit' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500'}`}>إيداع</button>
                <button onClick={() => setActiveTab('withdraw')} className={`flex-1 py-2 font-bold transition ${activeTab === 'withdraw' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500'}`}>سحب</button>
            </div>
            
            <div className="flex flex-col items-center gap-2">
                <p className="text-gray-300 text-center text-sm px-2">
                  {activeTab === 'deposit' 
                    ? `اطلب إيداعًا. الحد الأدنى ${formatNumber(MIN_DEPOSIT)} 💎 والحد الأقصى ${formatNumber(MAX_DEPOSIT)} 💎.` 
                    : `اطلب سحبًا. الحد الأدنى ${formatNumber(MIN_WITHDRAW)} 💎 والحد الأقصى ${formatNumber(MAX_WITHDRAW)} 💎.`}
                </p>
                 <div className="relative w-full max-w-xs">
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={activeTab === 'deposit' ? MIN_DEPOSIT : MIN_WITHDRAW} placeholder="أدخل المبلغ" className="w-full bg-gray-800 border-2 border-gray-600 rounded-lg py-3 pr-12 text-center text-xl font-bold focus:ring-cyan-500 focus:border-cyan-500 transition"/>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <DiamondIcon className="w-6 h-6 text-cyan-400" />
                    </div>
                </div>
                {numericAmount > 0 && (
                    <p className="text-center text-gray-400 -mt-1">
                        القيمة: <span className="font-bold text-cyan-400">{monetaryValue.toLocaleString('ar-EG')} جنيه مصري</span>
                    </p>
                )}
                <button onClick={handleMainButtonClick} disabled={isSubmitting || !amount || Number(amount) <= 0} className="w-full max-w-xs py-3 text-lg font-bold bg-cyan-600 hover:bg-cyan-500 rounded-lg transition disabled:opacity-50 disabled:cursor-wait mt-2">
                    {isSubmitting ? 'جاري الإرسال...' : `طلب ${activeTab === 'deposit' ? 'إيداع' : 'سحب'}`}
                </button>
            </div>
        </div>
        
        <div className="mt-6">
            <h3 className="font-bold text-xl mb-3 text-center">سجل الطلبات</h3>
            <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-gray-900/50 rounded-lg">
                {requests.length > 0 ? requests.map(req => (
                    <div key={req.id} className="bg-gray-800 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <span className={`font-bold ${req.type === 'deposit' ? 'text-green-400' : 'text-yellow-400'}`}>{req.type === 'deposit' ? 'إيداع' : 'سحب'}</span>
                            <span className="text-lg font-mono ml-4">{formatNumber(req.amount)}</span>
                        </div>
                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${getStatusChip(req.status)}`}>
                            {
                                {pending: 'معلق', approved: 'موافق عليه', rejected: 'مرفوض'}[req.status]
                            }
                        </span>
                    </div>
                )) : <p className="text-center text-gray-500">لا توجد طلبات.</p>}
            </div>
        </div>

        {isConfirmingTransaction && (
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4 rounded-2xl">
                <h3 className="text-xl font-bold text-yellow-300">
                    {`تأكيد عملية ${activeTab === 'deposit' ? 'الإيداع' : 'السحب'}`}
                </h3>
                <p className="my-4 text-center text-gray-300">
                    هل أنت متأكد أنك تريد طلب {activeTab === 'deposit' ? 'إيداع' : 'سحب'} مبلغ
                    <br/>
                    <strong className="text-2xl text-white font-mono">{formatNumber(numericAmount)} 💎</strong>
                    <br/>
                    <span className="text-lg text-cyan-400">
                        (بما يعادل {monetaryValue.toLocaleString('ar-EG')} جنيه مصري)؟
                    </span>
                </p>
                <div className="flex gap-4 w-full max-w-xs">
                    <button 
                        onClick={() => setIsConfirmingTransaction(false)} 
                        className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition"
                        disabled={isSubmitting}
                    >
                        إلغاء
                    </button>
                    <button 
                        onClick={handleConfirmTransaction} 
                        className={`flex-1 py-2 rounded-lg transition disabled:opacity-50 ${
                            activeTab === 'deposit'
                                ? 'bg-green-600 hover:bg-green-500'
                                : 'bg-red-600 hover:bg-red-500'
                        }`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'جاري...' : `تأكيد ${activeTab === 'deposit' ? 'الإيداع' : 'السحب'}`}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default WalletModal;