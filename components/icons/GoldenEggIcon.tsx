import React from 'react';

const GoldenEggIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <radialGradient id="eggGradient" cx="0.5" cy="0.5" r="0.6" fx="0.3" fy="0.3">
                <stop offset="0%" stopColor="#FFF7B0" />
                <stop offset="60%" stopColor="#FFD700" />
                <stop offset="95%" stopColor="#B8860B" />
                <stop offset="100%" stopColor="#8B4513" />
            </radialGradient>
            <filter id="eggGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        <path
            d="M50 10 C 80 10, 95 40, 95 65 C 95 95, 80 100, 50 100 C 20 100, 5 95, 5 65 C 5 40, 20 10, 50 10 Z"
            fill="url(#eggGradient)"
            filter="url(#eggGlow)"
        />
    </svg>
);

export default GoldenEggIcon;
