
import React, { useState, useEffect, useRef } from 'react';

interface LoadingScreenProps {
    isDataReady: boolean;
    onLoadingComplete: () => void;
}

const loadingMessages = [
    "جاري الاتصال بالخادم...",
    "جاري تحميل ملفك الشخصي...",
    "تحميل بيانات الألعاب...",
    "التحقق من الرصيد...",
    "تهيئة الواجهة...",
    "لحظات قليلة وينتهي التحميل..."
];

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isDataReady, onLoadingComplete }) => {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState(loadingMessages[0]);
    const [isFadingOut, setIsFadingOut] = useState(false);

    const textIntervalRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        // Interval to cycle through status texts
        let messageIndex = 0;
        textIntervalRef.current = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setStatusText(loadingMessages[messageIndex]);
        }, 800);

        // Interval for the "fake" progress before data is ready
        progressIntervalRef.current = window.setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) {
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                    return 95;
                }
                // Slower increment as it gets closer to the end
                const increment = prev < 70 ? Math.random() * 3 : Math.random() * 1.5;
                return Math.min(prev + increment, 95);
            });
        }, 200);

        return () => {
            if (textIntervalRef.current) clearInterval(textIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (isDataReady) {
            // Data is ready, so stop the fake progress and text cycling
            if (textIntervalRef.current) clearInterval(textIntervalRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

            setStatusText("اكتمل التحميل!");

            // Quickly fill the rest of the progress bar
            const finalProgressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(finalProgressInterval);
                        
                        // Start fade out animation, then call onLoadingComplete
                        setIsFadingOut(true);
                        setTimeout(() => {
                            onLoadingComplete();
                        }, 500); // Match fade-out duration

                        return 100;
                    }
                    return prev + 5;
                });
            }, 40); // Faster interval for a quick fill
        }
    }, [isDataReady, onLoadingComplete]);

    const fadeClass = isFadingOut ? 'loading-screen-fade-out' : 'loading-screen-fade-in';

    return (
        <div className={`min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4 transition-opacity duration-500 ${fadeClass}`}>
            {/* تم تحديث الشعار هنا */}
            <h1 className="text-6xl font-black tracking-wider mb-8 flex items-center gap-3" style={{ fontFamily: 'sans-serif' }}>
                <span className="xboom-gold-logo">XBOOM</span> 
                <span className="text-6xl eagle-gold-glow">🦅</span>
            </h1>
            <div className="w-full max-w-lg bg-gray-700 rounded-full h-4 overflow-hidden border-2 border-gray-600 shadow-inner">
                <div
                    className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full transition-all duration-300 ease-linear progress-bar--striped"
                    style={{ width: `${Math.round(progress)}%`, animation: `progress-bar-stripes 1s linear infinite` }}
                ></div>
            </div>
            <p className="mt-4 text-lg text-gray-300 transition-opacity duration-300 h-6">
                {statusText}
            </p>
            <p className="mt-2 text-xl text-gray-400">
                أهلاً بك
            </p>
        </div>
    );
};

export default LoadingScreen;
