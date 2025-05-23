import React, { useState, useCallback } from 'react';
import { formatChips } from '../types/poker';

interface PlayerBettingProps {
  playerId: string;
  playerName: string;
  totalContractBet: number;
  userContractBet: number;
  onPlaceBet: (playerId: string, amount: number) => void;
}

export const PlayerBetting: React.FC<PlayerBettingProps> = ({
  playerName,
  totalContractBet,
  userContractBet,
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
    <div className="player-betting border border-theme-primary rounded-border-radius-element p-3 bg-surface-tertiary">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-theme-highlight text-shadow-yellow">{playerName}</h4>
      </div>

      <div className="stats text-sm mb-3">
        <div className="text-theme-primary text-shadow-green">
          Total Pool: ${formatChips(totalContractBet)}
        </div>
        {userContractBet > 0 && (
          <div className="text-theme-accent text-shadow-pink">
            Your Bet: ${formatChips(userContractBet)}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          placeholder="Enter bet amount"
          className="flex-1 px-2 py-1 rounded-border-radius-element bg-surface-primary border border-theme-primary text-theme-primary placeholder-theme-secondary"
        />
        <button
          onClick={handleBet}
          className="px-3 py-1 bg-theme-primary text-surface-primary rounded-border-radius-element hover:bg-theme-highlight transition-colors"
        >
          Bet
        </button>
      </div>

      {userContractBet > 0 && totalContractBet > 0 && (
        <div className="mt-2 text-xs text-theme-secondary text-shadow-cyan">
          Your share: {((userContractBet / (totalContractBet || 1)) * 100).toFixed(1)}% of pool
        </div>
      )}
    </div>
  );
}; 