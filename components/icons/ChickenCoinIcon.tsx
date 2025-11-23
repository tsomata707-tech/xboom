import React from 'react';

const ChickenCoinIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
        <defs>
            <radialGradient id="coinGradient" cx="0.5" cy="0.5" r="0.5" fx="0.25" fy="0.25">
                <stop offset="0%" stopColor="#FFEE90" />
                <stop offset="50%" stopColor="#FFD700" />
                <stop offset="100%" stopColor="#B8860B" />
            </radialGradient>
        </defs>
        {/* Outer dark ring */}
        <circle cx="50" cy="50" r="48" fill="#B8860B" />
        {/* Main coin face */}
        <circle cx="50" cy="50" r="45" fill="url(#coinGradient)" stroke="#8B4513" strokeWidth="2" />
        {/* Chicken Leg Icon */}
        <g transform="translate(25, 20) scale(1.5)">
            <path d="M11.6,12.2c0.8,0.3,1.6-0.3,1.7-1.1c0.3-1.6-0.6-3.2-2.1-3.6c-0.1,0-0.2-0.1-0.3-0.1c-0.3-0.1-0.5-0.2-0.8-0.2 c-0.8-0.2-1.6-0.1-2.4,0.3c-2,0.8-3.1,3-2.7,5.1c0.1,0.8,0.8,1.3,1.6,1.2c0.7-0.1,1.2-0.7,1.1-1.4c-0.2-1,0.4-2,1.4-2.2 c1-0.2,2,0.4,2.2,1.4C10.5,11.7,11,12,11.6,12.2z" fill="#A52A2A"/>
            <path d="M13.6,17.4c-0.4-0.1-0.8-0.1-1.2,0l-1.3,0.3c-1,0.2-2.1-0.4-2.3-1.4c-0.2-1,0.4-2.1,1.4-2.3l1.3-0.3c1-0.2,2.1,0.4,2.3,1.4 C14.1,16.1,13.9,16.8,13.6,17.4z" fill="#A52A2A"/>
            <path d="M19.1,12.6c-0.2-0.1-0.5-0.2-0.8-0.2c-0.8-0.2-1.6-0.1-2.4,0.3c-1,0.4-1.8,1.2-2.3,2.2c-1.1,2.1-0.2,4.6,1.8,5.7 c0.7,0.4,1.4,0.5,2.2,0.5c0.8,0,1.5-0.2,2.2-0.5c2.1-1.1,3-3.6,1.8-5.7C20.9,13.8,20.1,13,19.1,12.6z" fill="#D2691E"/>
        </g>
        {/* Skull and crossbones as an alternative */}
        <g transform="translate(28, 30) scale(1.8)" fill="#000" opacity="0.3">
            <circle cx="8" cy="6" r="2.5" />
            <rect x="5.5" y="8" width="5" height="1.5" rx="0.5" />
            <path d="M 11 11 L 5 17 M 5 11 L 11 17" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
        </g>
    </svg>
);

export default ChickenCoinIcon;
