import React, { useState } from 'react';

interface AgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: {
      playerID?: string;
  } | null;
}

const agents = [
    { name: 'وكيل 1', phone: '+201055455403' },
    { name: 'وكيل 2', phone: '+201559047552' },
    { name: 'وكيل 3', phone: '+201204904963' },
    { name: 'وكيل 4', phone: '+201065580651' },
];

const pricingTiers = [
    { diamonds: 250, price: '50 جنيه' },
    { diamonds: 1000, price: '200 جنيه' },
    { diamonds: 5000, price: '1,000 جنيه' },
    { diamonds: 50000, price: '10,000 جنيه' },
    { diamonds: 100000, price: '20,000 جنيه' },
];

const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const WhatsappIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01s-.521.074-.792.372c-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
);

const AgentsModal: React.FC<AgentsModalProps> = ({ isOpen, onClose, userProfile }) => {
    const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<{ diamonds: number; price: string; } | null>(null);

    if (!isOpen) return null;

    const handleCopy = (phone: string) => {
        navigator.clipboard.writeText(phone);
        setCopiedPhone(phone);
        setTimeout(() => setCopiedPhone(null), 2000);
    };
    
    const generateWhatsappMessage = () => {
        if (!selectedPackage || !userProfile?.playerID) {
            return encodeURIComponent(`مرحباً، أرغب في طلب شحن 💎.`);
        }

        const message = `مرحباً إدارة xboom،
أرغب في طلب شحن.

- الباقة: ${selectedPackage.diamonds.toLocaleString()} 💎
- السعر: ${selectedPackage.price}
- ID اللاعب: ${userProfile.playerID}

شكراً لكم.`;
        return encodeURIComponent(message);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-purple-500/30 rounded-2xl w-full max-w-md shadow-2xl shadow-purple-900/40 p-6 relative game-container-animation" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-3 left-4 text-gray-400 hover:text-white transition text-3xl leading-none">&times;</button>
                <h2 className="text-3xl font-bold text-cyan-400 mb-6 text-center">وكلاء الشحن</h2>
                
                <h3 className="text-xl font-bold text-cyan-400 mb-4 text-center">1. اختر باقة الشحن</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {pricingTiers.map(tier => (
                        <button
                            key={tier.diamonds}
                            onClick={() => setSelectedPackage(tier)}
                            className={`p-3 text-center rounded-lg transition-all border-2 ${
                                selectedPackage?.diamonds === tier.diamonds
                                    ? 'bg-purple-600 border-cyan-400 scale-105 shadow-lg'
                                    : 'bg-gray-700 border-gray-600 hover:border-purple-500'
                            }`}
                        >
                            <p className="font-bold text-lg text-white">{tier.diamonds.toLocaleString()} 💎</p>
                            <p className="text-sm text-cyan-300">{tier.price}</p>
                        </button>
                    ))}
                </div>

                <h3 className="text-xl font-bold text-cyan-400 mb-4 text-center">2. تواصل مع وكيل</h3>
                <div className="space-y-4">
                    {agents.map((agent) => {
                        const whatsappMessage = generateWhatsappMessage();
                        const canContact = !!selectedPackage;
                        const href = canContact 
                           ? `https://wa.me/${agent.phone.replace(/\+/g, '')}?text=${whatsappMessage}` 
                           : '#';

                        return (
                            <div key={agent.phone} className="bg-gray-900/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div className="text-center sm:text-right">
                                    <p className="font-bold text-lg text-white">{agent.name}</p>
                                    <p className="text-cyan-400 font-mono tracking-wider">{agent.phone}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => handleCopy(agent.phone)} className="p-2 w-20 h-10 flex justify-center items-center bg-gray-700 rounded-md hover:bg-gray-600 transition" title="نسخ الرقم">
                                        {copiedPhone === agent.phone ? <CheckIcon className="text-green-400"/> : <CopyIcon />}
                                    </button>
                                    <a href={href} 
                                       target="_blank" 
                                       rel="noopener noreferrer" 
                                       className={`p-2 h-10 flex justify-center items-center bg-green-600 rounded-md transition ${!canContact ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-500'}`}
                                       title={canContact ? "تواصل عبر واتساب" : "الرجاء اختيار باقة أولاً"}
                                       onClick={(e) => !canContact && e.preventDefault()}
                                    >
                                        <WhatsappIcon />
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
                 <p className="text-xs text-gray-500 mt-6 text-center">تنويه: تعامل فقط مع الوكلاء المذكورين أعلاه لتجنب عمليات الاحتيال.</p>
            </div>
        </div>
    );
};

export default AgentsModal;