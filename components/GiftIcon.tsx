import React from 'react';

// تم إصلاح هذا الملف الذي كان فارغًا وتسبب في أخطاء بناء.
const GiftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a2.25 2.25 0 01-2.25 2.25H5.25a2.25 2.25 0 01-2.25-2.25v-8.25M12 4.875A2.625 2.625 0 1014.625 7.5H9.375A2.625 2.625 0 1012 4.875z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.875v16.5M12 4.875c-1.28 0-2.5-1.455-2.5-3.375S10.72 0 12 0s2.5 1.455 2.5 3.375S13.28 4.875 12 4.875z" />
  </svg>
);

export default GiftIcon;
