import React from 'react';

const GenieIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <text x="12" y="15" fontSize="20px" textAnchor="middle" dominantBaseline="middle">
      🧞
    </text>
  </svg>
);

export default GenieIcon;