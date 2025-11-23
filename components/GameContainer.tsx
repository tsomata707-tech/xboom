
import React from 'react';

interface GameContainerProps {
  title: string;
  children: React.ReactNode;
}

const GameContainer: React.FC<GameContainerProps> = ({ title, children }) => {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-3xl font-bold text-cyan-400 mb-6">{title}</h2>
      {children}
    </div>
  );
};

export default GameContainer;
