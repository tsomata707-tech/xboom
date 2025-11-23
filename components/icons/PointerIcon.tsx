import React from 'react';

const PointerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <g style={{ filter: 'url(#glow)' }}>
            {/* Hand Shape */}
            <path
                d="M 40,90
                   L 40,60
                   C 40,50 42,45 50,45
                   C 58,45 60,50 60,60
                   L 60,75
                   L 55,75
                   L 55,62
                   C 55,58 54,55 50,55
                   C 46,55 45,58 45,62
                   L 45,90
                   Z"
                fill="#ffcc80"
                stroke="#8d6e63"
                strokeWidth="2"
            />
            {/* Index Finger Pointing */}
            <path
                d="M 50,45
                   L 50,15
                   C 50,5 45,5 45,15
                   L 45,45
                   Z"
                fill="#ffcc80"
                stroke="#8d6e63"
                strokeWidth="2"
            />
            {/* Fingernail */}
            <path
                d="M 50,15 C 47,15 45,18 45,20 L 50,20 Z"
                fill="#fff59d"
            />
        </g>
    </svg>
);

export default PointerIcon;
