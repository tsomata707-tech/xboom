import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Announcement {
    text: string;
    timestamp: any; // Firestore Timestamp
}

interface AnnouncementBannerProps {
    announcement: Announcement | null;
    onClose: () => void;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ announcement, onClose }) => {
    const [isExiting, setIsExiting] = useState(false);
    const closeTimerRef = useRef<number | null>(null);

    const handleClose = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
        }
        setIsExiting(true);
        setTimeout(onClose, 500); // Match animation duration
    }, [onClose]);

    useEffect(() => {
        setIsExiting(false); // Reset animation state for new announcements

        // Set a timer to automatically close the banner after 20 seconds
        closeTimerRef.current = window.setTimeout(() => {
            handleClose();
        }, 20000); // 20 seconds

        // Cleanup function to clear the timer if the component unmounts
        // or if a new announcement comes in.
        return () => {
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
            }
        };
    }, [announcement, handleClose]);


    if (!announcement || !announcement.text) {
        return null;
    }

    const animationClass = isExiting ? 'animate-banner-exit' : 'animate-banner-enter';

    return (
        <div className={`relative my-2 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-lg shadow-lg banner-glow flex items-stretch ${animationClass} overflow-hidden`}>
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-cyan-200/50" style={{ animation: `progress-bar 20s linear forwards` }}></div>
            
            <div className="flex-grow marquee flex items-center">
                <div 
                    className="marquee-content-reversed text-white"
                    style={{ animationDuration: '25s' }}
                >
                    {[...Array(4)].map((_, i) => (
                        <span key={i} className="inline-flex items-center mx-8 py-3 sm:text-lg font-semibold whitespace-nowrap">
                            <span className="text-2xl ml-4" role="img" aria-label="announcement">📢</span>
                            {announcement.text}
                        </span>
                    ))}
                </div>
            </div>
            <button
                onClick={handleClose}
                className="flex-shrink-0 px-4 text-white/70 hover:text-white transition-colors text-3xl leading-none bg-black/20 z-10"
                aria-label="إغلاق الإعلان"
            >
                &times;
            </button>
        </div>
    );
};

export default AnnouncementBanner;