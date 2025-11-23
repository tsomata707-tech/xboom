import React, { useState, useEffect } from 'react';

interface GameStatusDisplayProps {
  roundId: number | undefined;
}

const GameStatusDisplay: React.FC<GameStatusDisplayProps> = ({ roundId }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    
    const formattedDate = currentTime.toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const formattedTime = currentTime.toLocaleTimeString('ar-EG', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    return (
        <div className="w-full flex justify-between items-center text-sm text-gray-400 mb-4 px-2 py-1 bg-gray-900/50 rounded-md border border-gray-700">
            <span>الجولة: <span className="font-bold text-cyan-400">#{roundId ?? '...'}</span></span>
            <span>{formattedDate} - {formattedTime}</span>
        </div>
    );
};

export default GameStatusDisplay;
