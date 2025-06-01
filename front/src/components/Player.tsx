import React from 'react';
import { Card as CardType, PlayerState, formatChips } from '../types/poker';
import { Card } from './Card';

type PlayerPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const getPositionLabel = (position: PlayerState['position']): string => {
  switch (position) {
    case 'BB': return 'Big Blind';
    case 'SB': return 'Small Blind';
    case 'BTN': return 'Button';
    case 'EP': return 'Early Position';
    case 'MP': return 'Middle Position';
    case 'CO': return 'Cut-off';
    default: return position;
  }
};

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
        return "text-yellow-400";
      case "PLAYING":
        return "text-white";
      default:
        return "text-white";
    }
  };

  return (
    <div className={`player ${positionClasses[tablePosition]}`}>
      <div className="relative">
        {/* AVATAR */}
        {/* <div className="w-12 h-12 bg-black border-2 border-white mr-2 flex items-center justify-center">
          <span className={`${statusColor()} font-mono`}>
            {playerName.slice(0, 2)}
          </span>
        </div>
        {totalContractBet > 0 && (
          <span className="absolute -bottom-2 -right-2 text-xs text-white bg-green-400 px-1">
            ${formatChips(totalContractBet)}
          </span>
        )} */}
      </div>
      <div className="flex flex-col text-xs flex-grow font-mono">
        <div className="flex items-center mb-1">
          <span className="font-bold text-white mr-2">
            {playerName}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <span className={`${statusColor()}`}>
            {status === "PLAYING" ? "" : status}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <span className={`${statusColor()} font-bold`}>
            {isCurrentPlayer ? "Computing..." : <br />}
          </span>
        </div>
        <div className="flex items-center mb-1">
          <span className={`${statusColor()}`}>
            {getPositionLabel(position)}
          </span>
        </div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-white">
            Chips: <span className="text-green-400">${formatChips(chips)}</span>
          </span>
        </div>
        <div className="flex justify-between items-center mb-1">
          {bet.volume > 0 && (
            <span className="text-white">
              Bet Total: <span className="text-green-400">${formatChips(bet.volume)}</span>
            </span>
          )}
        </div>
        <div className="flex justify-between items-center mb-1">
          {bet.amount > 0 && (
            <span className="text-white ml-2">
              Bet Round: <span className="text-green-400">${formatChips(bet.amount)}</span>
            </span>
          )}
        </div>
        {totalContractBet > 0 && (
          <div className="text-white text-xs">
            Pool: <span className="text-green-400">${formatChips(totalContractBet)}</span>
          </div>
        )}
        {userContractBet > 0 && (
          <div className="text-white text-xs">
            Your Bet: <span className="text-green-400">${formatChips(userContractBet)}</span>
          </div>
        )}
        {/* Player's hand */}
        {hand.length > 0 && (
          <div className="flex gap-1 mt-1">
            {hand.map((card: CardType, index: number) => (
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