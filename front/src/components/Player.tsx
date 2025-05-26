import React from 'react';
import { PlayerState, formatChips, PokerPosition } from '../types/poker';
import { Card } from './Card';

type PlayerPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface PlayerProps {
  id: string;
  playerName: string;
  status: PlayerState['status'];
  hand: PlayerState['hand'];
  position: PlayerState['position'];
  chips: number;
  bet: PlayerState['bet'];
  tablePosition: PlayerPosition;
  isCurrentPlayer?: boolean;
  totalContractBet?: number;
  userContractBet?: number;
}

const positionClasses: Record<PlayerPosition, string> = {
  1: 'player-1',
  2: 'player-2',
  3: 'player-3',
  4: 'player-4',
  5: 'player-5',
  6: 'player-6',
  7: 'player-7',
  8: 'player-8',
};

export const Player: React.FC<PlayerProps> = ({
  playerName,
  status,
  hand,
  position,
  chips,
  bet,
  tablePosition,
  isCurrentPlayer = false,
  totalContractBet = 1000,
  userContractBet = 0,
}) => {
  const statusColor = () => {
    switch (status) {
      case "FOLDED":
        return "text-gray-400";
      case "ALL_IN":
        return "text-neon-yellow";
      case "PLAYING":
        return "text-neon-green";
      default:
        return "text-neon-green";
    }
  };

  return (
    <div
      className={`player ${positionClasses[tablePosition]}`}
    >
      <div className="relative">
        {/* AVATAR */}
        {/* <div className="w-12 h-12 bg-black border-2 border-neon-green shadow-neon rounded-full mr-2 flex items-center justify-center">
          <span className={`${statusColor()} text-shadow-neon`}>
            {playerName.slice(0, 2)}
          </span>
        </div>
        {totalContractBet > 0 && (
          <span className="absolute -bottom-2 -right-2 text-xs text-white bg-theme-highlight/80 px-1 rounded shadow-neon-yellow">
            ${formatChips(totalContractBet)}
          </span>
        )} */}
      </div>
      <div className="flex flex-col text-xs flex-grow">
        <div className="flex items-center mb-1">
          <span className="font-bold text-neon-green text-shadow-neon mr-2">
            {playerName}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <span className={`${statusColor()} text-shadow-neon`}>
            {status === "PLAYING" ? "" : status}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <span className={`${statusColor()} text-shadow-neon font-bold`}>
            {isCurrentPlayer ? "Computing..." : <br/>}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <span className={`${statusColor()} text-shadow-neon`}>
            {PokerPosition[position]}
          </span>
        </div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-neon-green text-shadow-neon">
            Chips: ${formatChips(chips)}
          </span>
        </div>
        <div className="flex justify-between items-center mb-1">
          {bet.total > 0 && (
            <span className="text-neon-yellow text-shadow-yellow">
              Bet Total: ${formatChips(bet.total)}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center mb-1">
          {bet.round > 0 && (
            <span className="text-neon-yellow text-shadow-yellow ml-2">
              Bet Round: ${formatChips(bet.round)}
            </span>
          )}
        </div>
        {totalContractBet > 0 && (
          <div className="text-theme-primary text-shadow-green text-xs">
            Pool: ${formatChips(totalContractBet)}
          </div>
        )}
        {userContractBet > 0 && (
          <div className="text-theme-accent text-shadow-pink text-xs">
            Your Bet: ${formatChips(userContractBet)}
          </div>
        )}
        {/* Player's hand */}
        {hand.length > 0 && (
          <div className="flex gap-1 mt-1">
            {hand.map((card, index) => (
              <Card
                key={`${card.rank}-${card.suit}-${index}`}
                card={card}
                className="scale-75"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 