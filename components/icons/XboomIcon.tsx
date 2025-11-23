import React from 'react';

const XboomIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <linearGradient id="lensGradientLeft" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#090979" />
            </linearGradient>
            <linearGradient id="lensGradientRight" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff005d" />
                <stop offset="100%" stopColor="#77002b" />
            </linearGradient>
            <filter id="glassesGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <g transform="skewX(-10) translate(10, 15)" filter="url(#glassesGlow)">
            {/* Frame */}
            <path d="M 20 40 L 40 20 H 90 L 80 40 L 90 60 H 40 Z" fill="#111" />
            <path d="M 180 40 L 160 20 H 110 L 120 40 L 110 60 H 160 Z" fill="#111" />
            <path d="M 90 35 H 110" stroke="#111" strokeWidth="10" strokeLinecap="round" />

            {/* Lenses */}
            <path d="M 45 25 H 85 L 75 40 L 85 55 H 45 Z" fill="url(#lensGradientLeft)" />
            <path d="M 155 25 H 115 L 125 40 L 115 55 H 155 Z" fill="url(#lensGradientRight)" />
            
             {/* Shine */}
            <path d="M 50 30 L 70 45" stroke="#fff" strokeWidth="3" strokeOpacity="0.4" strokeLinecap="round" />
            <path d="M 150 30 L 130 45" stroke="#fff" strokeWidth="3" strokeOpacity="0.4" strokeLinecap="round" />
        </g>
    </svg>
);

export default XboomIcon;
