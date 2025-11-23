
import React from 'react';

const GlobeNetworkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <radialGradient id="globeGradient" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#4facfe" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.1" />
      </radialGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Globe Background */}
    <circle cx="50" cy="50" r="40" fill="url(#globeGradient)" opacity="0.2" />
    
    <g stroke="currentColor" strokeWidth="1.5" fill="none" filter="url(#glow)">
      {/* Sphere Outline */}
      <circle cx="50" cy="50" r="40" strokeWidth="2" />
      
      {/* Latitudes */}
      <ellipse cx="50" cy="50" rx="40" ry="12" />
      <ellipse cx="50" cy="50" rx="40" ry="28" />
      <line x1="10" y1="50" x2="90" y2="50" />
      
      {/* Longitudes */}
      <ellipse cx="50" cy="50" rx="12" ry="40" />
      <ellipse cx="50" cy="50" rx="28" ry="40" />
      <line x1="50" y1="10" x2="50" y2="90" />

      {/* Nodes/Network Points */}
      <circle cx="50" cy="22" r="3" fill="currentColor" stroke="none" />
      <circle cx="78" cy="50" r="3" fill="currentColor" stroke="none" />
      <circle cx="22" cy="50" r="3" fill="currentColor" stroke="none" />
      <circle cx="50" cy="78" r="3" fill="currentColor" stroke="none" />
      <circle cx="65" cy="35" r="2" fill="currentColor" stroke="none" opacity="0.8" />
      <circle cx="35" cy="65" r="2" fill="currentColor" stroke="none" opacity="0.8" />
    </g>
  </svg>
);

export default GlobeNetworkIcon;
