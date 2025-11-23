import React from 'react';

const ChickenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
        <text x="50" y="50" fontSize="80" textAnchor="middle" dominantBaseline="middle">
            🐔
        </text>
    </svg>
);

export default ChickenIcon;