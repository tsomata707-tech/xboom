
import React, { useState, useEffect } from 'react';

const AnimatedLogo = () => {
  const [bPosition, setBPosition] = useState(0);
  const [mPosition, setMPosition] = useState(0);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // تحريك الحروف بعد نصف ثانية
    const moveTimer = setTimeout(() => {
      setBPosition(-8);  // B تتحرك لأعلى
      setMPosition(8);   // M تتحرك لأسفل
    }, 500);

    // إظهار التأثير بعد الحركة
    const showTimer = setTimeout(() => {
      setShowText(true);
    }, 1000);

    return () => {
      clearTimeout(moveTimer);
      clearTimeout(showTimer);
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      maxWidth: '350px',
      height: '100px',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '10px auto 30px auto',
      position: 'relative'
    }}>
      
      {/* الحرف X الكبير الثابت */}
      <span style={{
        fontSize: '52px',
        fontWeight: '900',
        background: 'linear-gradient(45deg, #FFD700, #FFEC8B, #FFD700)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        textShadow: '0 2px 15px rgba(255, 215, 0, 0.4)',
        marginRight: '25px', // مسافتين من BOOM
        lineHeight: 1,
        fontFamily: 'Arial, sans-serif'
      }}>
        X
      </span>

      {/* كلمة BOOM المتحركة */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative'
      }}>
        
        {/* حرف O الأول */}
        <span style={{
          fontSize: '38px',
          fontWeight: 'bold',
          background: 'linear-gradient(45deg, #FFD700, #FFEC8B, #FFD700)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          textShadow: showText ? '0 2px 10px rgba(255, 215, 0, 0.3)' : 'none',
          transition: 'text-shadow 0.3s ease-in',
          fontFamily: 'Arial, sans-serif'
        }}>
          O
        </span>

        {/* حرف O الثاني */}
        <span style={{
          fontSize: '38px',
          fontWeight: 'bold',
          background: 'linear-gradient(45deg, #FFD700, #FFEC8B, #FFD700)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          textShadow: showText ? '0 2px 10px rgba(255, 215, 0, 0.3)' : 'none',
          transition: 'text-shadow 0.3s ease-in 0.1s',
          fontFamily: 'Arial, sans-serif'
        }}>
          O
        </span>

        {/* حرف B المتحرك */}
        <span style={{
          fontSize: '38px',
          fontWeight: 'bold',
          background: 'linear-gradient(45deg, #FFD700, #FFEC8B, #FFD700)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          transform: `translateY(${bPosition}px)`,
          transition: 'transform 0.6s ease-out',
          textShadow: showText ? '0 2px 10px rgba(255, 215, 0, 0.3)' : 'none',
          marginRight: '2px',
          fontFamily: 'Arial, sans-serif'
        }}>
          B
        </span>

        {/* حرف M المتحرك */}
        <span style={{
          fontSize: '38px',
          fontWeight: 'bold',
          background: 'linear-gradient(45deg, #FFD700, #FFEC8B, #FFD700)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          transform: `translateY(${mPosition}px)`,
          transition: 'transform 0.6s ease-out',
          textShadow: showText ? '0 2px 10px rgba(255, 215, 0, 0.3)' : 'none',
          marginLeft: '2px',
          fontFamily: 'Arial, sans-serif'
        }}>
          M
        </span>

      </div>

    </div>
  );
};

export default AnimatedLogo;
