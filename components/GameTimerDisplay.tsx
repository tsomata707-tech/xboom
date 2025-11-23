import React from 'react';

interface GameTimerDisplayProps {
    phase: 'preparing' | 'running' | 'results';
    timeRemaining: number;
    totalTime: number;
}

const GameTimerDisplay: React.FC<GameTimerDisplayProps> = ({ phase, timeRemaining, totalTime }) => {
    const progress = totalTime > 0 ? (timeRemaining / totalTime) * 100 : 0;

    const getPhaseInfo = () => {
        switch (phase) {
            case 'preparing':
                return {
                    text: `استعد! تبدأ الجولة بعد...`,
                    color: 'bg-cyan-500',
                };
            case 'running':
                return {
                    text: 'الجولة جارية!',
                    color: 'bg-red-500',
                };
            case 'results':
                return {
                    text: 'عرض النتائج...',
                    color: 'bg-purple-500',
                };
        }
    };

    const { text, color } = getPhaseInfo();

    return (
        <div className="w-full max-w-lg mx-auto my-4 text-center">
            <h3 className="text-xl font-bold text-gray-300 mb-2">{text} <span className="text-yellow-300 font-mono text-2xl">{timeRemaining}</span></h3>
            <div className="w-full bg-gray-900 rounded-full h-2.5 border border-gray-700">
                <div
                    className={`${color} h-full rounded-full`}
                    style={{ width: `${progress}%`, transition: 'width 1s linear' }}
                ></div>
            </div>
        </div>
    );
};

export default GameTimerDisplay;
