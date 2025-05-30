import React, { useState, useCallback } from 'react';
import { formatChips } from '../types/poker';
import { PlayerBet } from './BettingPanel';

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
    <div className="h-full w-full transition-all duration-300 ease-in-out shadow-[0_0_calc(var(--shadow-strength)*0.5)_var(--theme-primary)] hover:shadow-[0_0_var(--shadow-strength)_var(--theme-accent)] hover:border-theme-accent border border-theme-primary rounded-border-radius-element px-3 py-1 bg-surface-tertiary">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-theme-highlight text-shadow-yellow">{playerName}</h4>
      </div>

      <div className="text-sm mb-1">
        <div className="text-theme-primary text-shadow-green">
          Total Pool: ${formatChips(totalBet)}
        </div>
        {bet.betAmount > 0 && (
          <div className="text-theme-accent text-shadow-pink">
            Your Bet: ${formatChips(bet.betAmount)}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          value={betAmount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBetAmount(e.target.value)}
          placeholder="Enter bet amount"
          className="w-[150px] text-xs px-2 rounded-border-radius-element bg-surface-primary border border-theme-primary text-theme-primary placeholder-theme-secondary"
        />
        <button
          onClick={handleBet}
          className="px-3 border border-theme-primary bg-theme-primary text-surface-primary rounded-border-radius-element hover:bg-theme-highlight transition-colors"
          disabled={!betAmount || isNaN(Number(betAmount)) || Number(betAmount) <= 0}
        >
          Bet
        </button>
      </div>

      {bet.betAmount > 0 && totalBet > 0 && (
        <div className="mt-2 text-xs text-theme-secondary text-shadow-cyan">
          Your share: {((bet.betAmount / (totalBet || 1)) * 100).toFixed(1)}% of pool
        </div>
      )}
    </div>
  );
}; 