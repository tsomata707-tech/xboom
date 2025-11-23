import React, { useState, useLayoutEffect, useCallback } from 'react';

interface OnboardingStep {
  targetId?: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  isCentered?: boolean;
}

const steps: OnboardingStep[] = [
  {
    isCentered: true,
    title: 'مرحباً بك في xboom!',
    content: 'لنأخذ جولة سريعة لتعريفك بالميزات الرئيسية.',
  },
  {
    targetId: 'onboarding-balance',
    title: '💎 رصيدك',
    content: 'هنا يمكنك رؤية رصيدك الحالي من الجواهر. استخدمها للعب والفوز!',
    position: 'bottom',
  },
  {
    targetId: 'onboarding-gamenav',
    title: '🎮 بوابة الألعاب',
    content: 'انقر هنا للدخول إلى مجموعة ألعابنا المتنوعة والممتعة!',
    position: 'bottom',
  },
  {
    targetId: 'onboarding-management',
    title: '⚙️ قائمة الإدارة',
    content: 'من هنا يمكنك الوصول إلى محفظتك، عرض وكلاء الشحن، أو تسجيل الخروج.',
    position: 'bottom',
  },
  {
    isCentered: true,
    title: '🎉 استمتع باللعب!',
    content: 'أنت الآن جاهز للبدء. حظاً موفقاً!',
  },
];

interface TooltipPosition {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

interface OnboardingProps {
  onFinish: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onFinish }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = steps[stepIndex];

  const handleFinish = useCallback(() => {
    sessionStorage.removeItem('isNewUser');
    onFinish();
  }, [onFinish]);

  const updatePosition = useCallback(() => {
    if (currentStep.targetId) {
      const element = document.getElementById(currentStep.targetId);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep.targetId]);

  useLayoutEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [stepIndex, updatePosition]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      handleFinish();
    }
  };
  
  const handlePrev = () => {
    if (stepIndex > 0) {
        setStepIndex(stepIndex - 1);
    }
  }

  const getTooltipPosition = (): TooltipPosition => {
    if (!targetRect) return {};
    const offset = 12;
    switch (currentStep.position) {
      case 'top':
        return { bottom: window.innerHeight - targetRect.top + offset, left: targetRect.left + targetRect.width / 2 };
      case 'left':
        return { top: targetRect.top + targetRect.height / 2, right: window.innerWidth - targetRect.left + offset };
      case 'right':
        return { top: targetRect.top + targetRect.height / 2, left: targetRect.right + offset };
      case 'bottom':
      default:
        return { top: targetRect.bottom + offset, left: targetRect.left + targetRect.width / 2 };
    }
  };

  const getTooltipTransform = (): string => {
     if (currentStep.isCentered) return '-translate-x-1/2 -translate-y-1/2';
     if (!targetRect) return '';
      switch (currentStep.position) {
      case 'top': return '-translate-x-1/2';
      case 'left': return '-translate-y-1/2';
      case 'right': return '-translate-y-1/2';
      case 'bottom':
      default:
        return '-translate-x-1/2';
    }
  }

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"></div>
      
      {targetRect && (
        <div
          className="absolute rounded-lg border-2 border-dashed border-cyan-400 shadow-[0_0_20px_5px_rgba(0,220,255,0.5)] transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        ></div>
      )}

      <div
        className={`absolute bg-gray-800 border border-purple-500/50 rounded-lg p-4 w-72 text-center shadow-2xl transition-all duration-300 ${getTooltipTransform()} ${currentStep.isCentered ? 'top-1/2 left-1/2' : ''}`}
        style={currentStep.isCentered ? {} : getTooltipPosition()}
      >
        <h3 className="text-xl font-bold text-cyan-400 mb-2">{currentStep.title}</h3>
        <p className="text-gray-300 mb-4">{currentStep.content}</p>
        <div className="flex justify-between items-center">
            <button onClick={handleFinish} className="text-sm text-gray-500 hover:text-white">تخطي</button>
            <div className="flex items-center gap-2">
                {stepIndex > 0 && !steps[stepIndex - 1].isCentered && (
                     <button onClick={handlePrev} className="px-4 py-2 text-sm bg-gray-600 rounded-md hover:bg-gray-500 transition">السابق</button>
                )}
                <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-purple-600 rounded-md hover:bg-purple-500 transition"
                >
                    {stepIndex === steps.length - 1 ? 'إنهاء' : 'التالي'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;