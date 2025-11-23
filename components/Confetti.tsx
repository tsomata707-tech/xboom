import React, { useEffect, useState } from 'react';

const CONFETTI_COUNT = 150;
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#22d3ee', '#fde047', '#4ade80'];

interface Confetto {
  id: number;
  style: React.CSSProperties;
}

const Confetti: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [confetti, setConfetti] = useState<Confetto[]>([]);

  useEffect(() => {
    const newConfetti = Array.from({ length: CONFETTI_COUNT }).map((_, i) => ({
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        backgroundColor: COLORS[Math.floor(Math.random() * COLORS.length)],
        transform: `rotate(${Math.random() * 360}deg)`,
        animation: `confetti-fall ${3 + Math.random() * 2}s ${Math.random() * 1}s ease-out forwards`,
      },
    }));
    setConfetti(newConfetti);

    const timer = setTimeout(onComplete, 6000); // Longest animation is 5s, plus 1s delay
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[1000] overflow-hidden">
      {confetti.map(c => (
        <div
          key={c.id}
          className="absolute w-2 h-4 opacity-0"
          style={c.style}
        />
      ))}
    </div>
  );
};

export default Confetti;
