import { useState, useEffect, useRef, useCallback } from 'react';

interface GameLoopOptions {
    preparationTime?: number;
    gameTime?: number;
    resultsTime?: number;
}

interface UseGameLoopProps {
    onRoundStart: () => void;
    onRoundEnd: () => void;
}

export const useGameLoop = ({ onRoundStart, onRoundEnd }: UseGameLoopProps, options: GameLoopOptions = {}) => {
    const {
        preparationTime = 10,
        gameTime = 10,
        resultsTime = 4,
    } = options;

    const [phase, setPhase] = useState<'preparing' | 'running' | 'results'>('preparing');
    const [timeRemaining, setTimeRemaining] = useState(preparationTime);
    const [roundId, setRoundId] = useState(1);
    const [totalTime, setTotalTime] = useState(preparationTime);

    const intervalRef = useRef<number | null>(null);
    const onRoundStartRef = useRef(onRoundStart);
    const onRoundEndRef = useRef(onRoundEnd);

    useEffect(() => {
        onRoundStartRef.current = onRoundStart;
        onRoundEndRef.current = onRoundEnd;
    }, [onRoundStart, onRoundEnd]);

    const startNextPhase = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        setPhase(prevPhase => {
            let nextPhase: typeof phase;
            let nextDuration: number;

            switch (prevPhase) {
                case 'results':
                    nextPhase = 'preparing';
                    nextDuration = preparationTime;
                    setRoundId(id => id + 1);
                    onRoundEndRef.current();
                    break;
                case 'preparing':
                    nextPhase = 'running';
                    nextDuration = gameTime;
                    onRoundStartRef.current();
                    break;
                case 'running':
                default:
                    nextPhase = 'results';
                    nextDuration = resultsTime;
                    break;
            }
            
            setTimeRemaining(nextDuration);
            setTotalTime(nextDuration);
            return nextPhase;
        });
    }, [preparationTime, gameTime, resultsTime]);


    useEffect(() => {
        intervalRef.current = window.setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    startNextPhase();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [phase, startNextPhase]);

    return { phase, timeRemaining, roundId, totalTime };
};
