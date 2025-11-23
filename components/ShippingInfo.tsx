import React, { useState } from 'react';

const ShippingInfo: React.FC = () => {
    const [showVFCash, setShowVFCash] = useState(false);
    const [copied, setCopied] = useState(false);
    const vfCashNumber = '01065580651';

    const copyToClipboard = () => {
        navigator.clipboard.writeText(vfCashNumber).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="my-6 p-4 bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl flex flex-col sm:flex-row justify-around items-center gap-4">
            <a 
                href="https://wa.me/201055455403" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-green-600/80 text-white font-bold py-2 px-5 rounded-full hover:bg-green-500 transition-colors duration-300"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                <span>وكيل الشحن</span>
            </a>
            <div className="text-center">
                <button 
                    onClick={() => setShowVFCash(prev => !prev)}
                    className="flex items-center gap-2 bg-purple-600/80 text-white font-bold py-2 px-5 rounded-full hover:bg-purple-500 transition-colors duration-300"
                >
                    <span>طريقة الشحن</span>
                    <svg className={`w-4 h-4 transition-transform duration-300 ${showVFCash ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {showVFCash && (
                    <div className="mt-3 p-3 bg-gray-900 rounded-lg text-center game-container-animation">
                        <p className="text-gray-400">فودافون كاش</p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-lg font-bold text-cyan-400 tracking-widest">{vfCashNumber}</span>
                            <button onClick={copyToClipboard} title="نسخ الرقم" className="p-1 bg-gray-700 rounded-md hover:bg-gray-600">
                                {copied ? <span className="text-green-400">✓ تم</span> : 
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default ShippingInfo;
