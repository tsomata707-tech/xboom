import React from 'react';

// تم إصلاح هذا الملف الذي كان فارغًا وتسبب في أخطاء بناء.
// هذا الآن مكون نائب صالح.
const ReferralModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 p-6 rounded-lg text-white" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold">نظام الإحالة</h2>
        <p className="mt-4">قادم قريبا!</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-purple-600 rounded">إغلاق</button>
      </div>
    </div>
  );
};

export default ReferralModal;
