
import React, { useState } from 'react';
import InfoIcon from './icons/InfoIcon';

interface HowToPlayProps {
  children: React.ReactNode;
  customTrigger?: React.ReactNode;
}

const HowToPlay: React.FC<HowToPlayProps> = ({ children, customTrigger }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      {customTrigger ? (
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">
            {customTrigger}
        </div>
      ) : (
        <button
            onClick={() => setIsOpen(true)}
            className="absolute top-3 left-3 z-40 flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 backdrop-blur-md border border-gray-600 rounded-full text-gray-200 text-xs sm:text-sm font-bold hover:bg-gray-700 transition-all shadow-lg hover:scale-105"
        >
            <InfoIcon className="w-4 h-4" />
            <span>كيف تلعب؟</span>
        </button>
      )}

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-md p-6 relative shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button 
                onClick={() => setIsOpen(false)}
                className="absolute top-4 left-4 text-gray-400 hover:text-white transition text-2xl leading-none"
            >
                &times;
            </button>
            
            <div className="text-center mb-4">
                <h3 className="text-2xl font-bold text-cyan-400">طريقة اللعب 🎮</h3>
                <div className="h-1 w-16 bg-gradient-to-r from-purple-500 to-cyan-500 mx-auto mt-2 rounded-full"></div>
            </div>

            <div className="text-right text-gray-300 space-y-3 leading-relaxed text-sm sm:text-base max-h-[60vh] overflow-y-auto pl-2 custom-scrollbar font-medium">
                {children}
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full mt-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition"
            >
              فهمت، لنبدأ!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default HowToPlay;
