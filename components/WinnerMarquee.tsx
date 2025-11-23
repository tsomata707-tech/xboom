import React, { useEffect, useRef } from 'react';
import type { HighValueWin } from '../types';
import DiamondIcon from './icons/DiamondIcon';
import { formatNumber } from './utils/formatNumber';

interface WinnerMarqueeProps {
  winToAnnounce: HighValueWin | null;
  onClose: () => void;
}

const WinnerMarquee: React.FC<WinnerMarqueeProps> = ({ winToAnnounce, onClose }) => {
  const marqueeContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = marqueeContentRef.current;
    if (winToAnnounce && node) {
      const handleAnimationEnd = () => {
        onClose();
      };
      
      node.addEventListener('animationend', handleAnimationEnd);
      
      // Safety timeout in case animationend event doesn't fire
      const safetyTimeout = setTimeout(() => {
        handleAnimationEnd();
      }, 16000); // 1s longer than animation

      return () => {
        if (node) {
          node.removeEventListener('animationend', handleAnimationEnd);
        }
        clearTimeout(safetyTimeout);
      };
    }
  }, [winToAnnounce, onClose]);

  if (!winToAnnounce) {
    return null;
  }

  const marqueeText = (
    <span className="inline-flex items-center mx-8">
      <span className="text-2xl mr-2">🏆</span>
      <span>
        فاز اللاعب <span className="nickname-gold">{winToAnnounce.nickname}</span> بـ{' '}
        <span className="font-bold text-yellow-300 inline-flex items-center">
          {formatNumber(winToAnnounce.amount)} <DiamondIcon className="w-5 h-5 mx-1" />
        </span>{' '}
        في لعبة <span className="font-bold text-purple-300">{winToAnnounce.gameName}</span>!
      </span>
    </span>
  );

  return (
    <div className="fixed top-24 left-0 w-full z-[101] pointer-events-none">
      <div className="w-full bg-gray-800/80 backdrop-blur-sm border-y border-yellow-400/50 py-3 overflow-hidden shadow-2xl shadow-yellow-500/20">
        <div ref={marqueeContentRef} className="marquee-content-once text-gray-200 text-xl font-bold">
          {marqueeText}
        </div>
      </div>
    </div>
  );
};

export default WinnerMarquee;