import React from 'react';

const SwordsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 21L3 17.25m0 0L6.75 13.5M3 17.25h18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 3L21 6.75m0 0L17.25 10.5M21 6.75H3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
  </svg>
);

export default SwordsIcon;
