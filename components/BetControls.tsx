
import React from 'react';
import DiamondIcon from './icons/DiamondIcon';

interface BetControlsProps {
  bet: number;
  setBet: (value: number) => void;
  minBet?: number;
  maxBet?: number;
  step?: number;
  balance: number;
  disabled?: boolean;
}

const BetControls: React.FC<BetControlsProps> = ({
  bet,
  setBet,
  minBet = 25,
  step = 10,
  balance,
  disabled = false,
}) => {
  const handleBetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valueStr = e.target.value;
    if (valueStr === '') {
        setBet(0);
        return;
    }
    const value = parseInt(valueStr, 10);
    if (!isNaN(value)) {
      setBet(Math.max(0, value));
    }
  };

  const quickBets = [25, 100, 500, 1000, 5000, 10000];

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4 mt-8">
      <div className="w-full">
        <label htmlFor="bet-amount" className="block text-lg font-medium text-gray-300 mb-2">
          مبلغ الرهان
        </label>
        <div className="relative">
          <input
            type="number"
            id="bet-amount"
            // Fix: Allow 0 to be displayed instead of empty string
            value={bet === 0 ? '0' : bet || ''}
            onChange={handleBetChange}
            min={0}
            step={step}
            disabled={disabled}
            className="w-full bg-gray-900 border-2 border-gray-600 rounded-lg py-3 pr-12 text-center text-xl font-bold focus:ring-purple-500 focus:border-purple-500 transition disabled:opacity-50"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <DiamondIcon className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
      </div>

      <div className="flex w-full justify-center flex-wrap gap-2">
          {quickBets.map((value) => (
              <button
                key={value}
                onClick={() => setBet(prev => prev + value)}
                disabled={disabled}
                className="px-4 py-1.5 bg-gray-700 text-white font-semibold rounded-full hover:bg-gray-600 transition disabled:opacity-50"
              >
                +{value >= 1000 ? `${value / 1000}K` : value}
              </button>
          ))}
          <button
              onClick={() => setBet(balance)}
              disabled={disabled}
              className="px-4 py-1.5 bg-purple-700 text-white font-semibold rounded-full hover:bg-purple-600 transition disabled:opacity-50"
            >
              الحد الأقصى
            </button>
      </div>
    </div>
  );
};

export default BetControls;
