import React, { useState, useCallback } from 'react';
import { formatChips } from '../types/poker';
import { PlayerBet } from './AccountManager';

interface PlayerBettingProps {
  playerId: string;
  playerName: string;
  totalBet: number;
  bet: PlayerBet;
  onPlaceBet: (playerId: string, amount: number) => void;
}

export const PlayerBetting: React.FC<PlayerBettingProps> = ({
  playerName,
  totalBet,
  bet,
  playerId,
  onPlaceBet,
}) => {
  const [betAmount, setBetAmount] = useState<string>('');

  const handleBet = useCallback(() => {
    const amount = parseInt(betAmount);
    if (!isNaN(amount) && amount > 0) {
      onPlaceBet(playerId, amount);
      setBetAmount('');
    }
  }, [playerId, betAmount, onPlaceBet]);

  return (
    <div className='bg-black border border-white rounded p-3 transition-all duration-300 ease-in-out hover:border-gray-400'>
      {/* Player Name */}
      <div className='border-b border-white pb-2 mb-3'>
        <h4 className='text-white font-mono font-semibold'>{playerName}</h4>
      </div>

      {/* Betting Information */}
      <div className='space-y-2 mb-3'>
        <div>
          <label className='block text-white font-mono text-xs mb-1'>
            Total Pool:
          </label>
          <div className='bg-black border border-white rounded px-2 py-1 font-mono text-sm text-white'>
            ${formatChips(totalBet)}
          </div>
        </div>

        {bet.betAmount > 0 && (
          <div>
            <label className='block text-white font-mono text-xs mb-1'>
              Your Bet:
            </label>
            <div className='bg-black border border-green-500 rounded px-2 py-1 font-mono text-sm text-green-400'>
              ${formatChips(bet.betAmount)}
            </div>
          </div>
        )}
      </div>

      {/* Betting Input */}
      <div className='space-y-2'>
        <div>
          <label className='block text-white font-mono text-xs mb-1'>
            Place Bet:
          </label>
          <div className='flex gap-2'>
            <input
              type='number'
              value={betAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setBetAmount(e.target.value)
              }
              placeholder='Enter amount'
              className='flex-1 bg-black border border-white rounded px-2 py-1 font-mono text-sm text-white placeholder-gray-400 focus:border-gray-400 focus:outline-none'
            />
            <button
              onClick={handleBet}
              disabled={
                !betAmount || isNaN(Number(betAmount)) || Number(betAmount) <= 0
              }
              className='px-3 py-1 bg-black border border-white rounded font-mono text-sm text-white hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white'
            >
              Bet
            </button>
          </div>
        </div>

        {/* Bet Share Information */}
        {bet.betAmount > 0 && totalBet > 0 && (
          <div className='mt-2 p-2 bg-black border border-gray-500 rounded'>
            <div className='text-gray-400 font-mono text-xs'>
              Your share: {((bet.betAmount / (totalBet || 1)) * 100).toFixed(1)}
              % of pool
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
