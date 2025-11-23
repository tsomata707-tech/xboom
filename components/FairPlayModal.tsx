import React from 'react';

interface FairPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FairPlayModal: React.FC<FairPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-purple-900/40 p-6 relative game-container-animation" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 left-4 text-gray-400 hover:text-white transition text-2xl leading-none">&times;</button>
        <h2 className="text-3xl font-bold text-cyan-400 mb-4 text-center">سياسة اللعب النظيف والشفافية</h2>
        
        <div className="space-y-4 text-gray-300 text-right">
            <p>مرحباً بك في xboom! نحن نؤمن بالشفافية الكاملة مع لاعبينا.</p>
            
            <div>
                <h3 className="font-bold text-white text-lg mb-1">🎲 مولد الأرقام العشوائية (RNG)</h3>
                <p>جميع نتائج الألعاب في xboom يتم تحديدها مباشرة داخل متصفحك. هذا يعني أن العشوائية يتم إنشاؤها بواسطة جهازك (Client-Side) وليست من خادم مركزي.</p>
            </div>

            <div>
                <h3 className="font-bold text-white text-lg mb-1">🎮 للترفيه فقط</h3>
                <p>تم تصميم هذا التطبيق كمنصة ترفيهية وتجريبية. العملات (💎) المستخدمة في التطبيق هي عملات افتراضية وليس لها قيمة نقدية حقيقية.</p>
            </div>

            <div>
                <h3 className="font-bold text-white text-lg mb-1">🔒 الأمان والنزاهة</h3>
                <p>بما أن منطق اللعبة يعمل على جهازك، فمن الممكن تقنياً التأثير على النتائج باستخدام أدوات المطورين في المتصفح. نرجو اللعب بمسؤولية وفهم أن هذه المنصة ليست للمقامرة بأموال حقيقية.</p>
            </div>

            <p className="text-center pt-4">شكراً لتفهمك ونتمنى لك وقتاً ممتعاً!</p>
        </div>

        <div className="mt-6 flex justify-center">
            <button
              onClick={onClose}
              className="w-full max-w-xs py-2 text-lg font-bold bg-purple-600 hover:bg-purple-500 rounded-lg transition"
            >
              فهمت
            </button>
        </div>
      </div>
    </div>
  );
};

export default FairPlayModal;