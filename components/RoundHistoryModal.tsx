
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { convertTimestamps } from './utils/convertTimestamps';
import { formatNumber } from './utils/formatNumber';
import DiamondIcon from './icons/DiamondIcon';

// This maps game IDs to their display names. It needs to be comprehensive.
const gameNames: { [key: string]: string } = {
  coinFlip: 'ملك وكتابة',
  highLow: 'أعلى أم أدنى',
  slotMachine: 'ماكينة الحظ',
  guessColor: 'خمن اللون',
  diceRoll: 'رمي النرد',
  rockPaperScissors: 'حجر ورقة مقص',
  cardDraw: 'سحب البطاقة',
  roulette: 'الروليت',
  threeCardMonte: 'مونتي الثلاث ورقات',
  findTheBox: 'اكتشف الصندوق',
  numberWheel: 'المربع الرابح',
  luckyWheel: 'عجلة الحظ',
  treasureHunt: 'التفاحة',
  plinkoGame: 'لعبة بلينكو',
  numberGuess: 'خمن الرقم',
  gachaMachine: 'آلة الكبسولة',
  sportsBetting: 'الرهانات الرياضية',
  snakesAndLadders: 'السلم والثعبان',
};


interface RoundHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RoundStat {
    id: string;
    gameId: string;
    roundId: number;
    timestamp: number;
    totalWagered: number;
    totalWonByPlayers: number;
}

const RoundHistoryModal: React.FC<RoundHistoryModalProps> = ({ isOpen, onClose }) => {
    const [history, setHistory] = useState<RoundStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const fetchHistory = async () => {
                setLoading(true);
                try {
                    const q = query(collection(db, 'roundStats'), orderBy('timestamp', 'desc'), limit(100));
                    const querySnapshot = await getDocs(q);
                    const historyData = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...convertTimestamps(doc.data())
                    } as RoundStat));
                    setHistory(historyData);
                } catch (error) {
                    console.error("Error fetching round history:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchHistory();
        }
    }, [isOpen]);

    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-4xl shadow-2xl shadow-purple-900/40 p-6 relative game-container-animation flex flex-col" style={{height: 'min(90vh, 800px)'}} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-white transition text-2xl leading-none z-10">&times;</button>
                <h2 className="text-3xl font-bold text-cyan-400 mb-6 text-center">سجل جولات الألعاب</h2>
                
                <div className="flex-grow overflow-y-auto">
                    {loading ? (
                        <p className="text-center text-gray-400">جاري تحميل السجل...</p>
                    ) : history.length === 0 ? (
                        <p className="text-center text-gray-500">لا يوجد سجل لعرضه.</p>
                    ) : (
                        <div className="relative overflow-x-auto shadow-md rounded-lg">
                            <table className="w-full text-sm text-right text-gray-300">
                                <thead className="text-xs text-cyan-300 uppercase bg-gray-900">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">الجولة</th>
                                        <th scope="col" className="px-4 py-3">اللعبة</th>
                                        <th scope="col" className="px-4 py-3">الوقت والتاريخ</th>
                                        <th scope="col" className="px-4 py-3">إجمالي الرهانات</th>
                                        <th scope="col" className="px-4 py-3">ربح التطبيق</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(item => {
                                        const profit = item.totalWagered - item.totalWonByPlayers;
                                        return (
                                            <tr key={item.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                                                <td className="px-4 py-3 font-medium">#{item.roundId}</td>
                                                <td className="px-4 py-3">{gameNames[item.gameId] || item.gameId}</td>
                                                <td className="px-4 py-3">{new Date(item.timestamp).toLocaleString('ar-EG')}</td>
                                                <td className="px-4 py-3 flex items-center">{formatNumber(item.totalWagered)} <DiamondIcon className="w-4 h-4 mr-1"/></td>
                                                <td className={`px-4 py-3 font-bold flex items-center ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatNumber(profit)} <DiamondIcon className="w-4 h-4 mr-1"/>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoundHistoryModal;
