import React from 'react';
import { Card as CardType, PlayerState, formatChips } from '../types/poker';
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
  totalContractBet = 0,
  userContractBet = 0,
}) => {
  const statusColor = () => {
    switch (status) {
      case 'FOLDED':
        return 'text-gray-400';
      case 'ALL_IN':
        return 'text-yellow-400';
      case 'PLAYING':
        return 'text-green-400';
      default:
        return 'text-white';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'FOLDED':
        return '✗';
      case 'ALL_IN':
        return '⚡';
      case 'PLAYING':
        return '●';
      default:
        return '●';
    }
  };

  const getPositionIcon = () => {
    switch (position) {
      case 'SB': // Small Blind
        return 'SB';
      case 'BB': // Big Blind
        return 'BB';
      case 'BTN': // Dealer
        return 'D';
      case 'EP': // Early Position
        return 'EP';
      case 'MP': // Middle Position
        return 'MP';
      case 'CO': // Cut-off
        return 'CO';
      default:
        return '';
    }
  };

  return (
    <div
      className={`${tablePosition === 7 || tablePosition === 8 ? '' : `player ${positionClasses[tablePosition]}`}`}
    >
      <div className='relative'>
        {/* Player Card Container */}
        <div className='bg-black border-2 border-white rounded-lg p-3 min-w-[160px] relative'>
          {/* Current Player Glow Effect */}
          {isCurrentPlayer && (
            <div className='absolute inset-0 border-2 border-green-400 rounded-lg animate-pulse'></div>
          )}

          {/* Position Badge */}
          {position && (
            <div className='absolute -top-3 -right-2 w-6 h-6 bg-black border-2 border-white rounded-full flex items-center justify-center'>
              <span className='text-white font-mono text-[10px] font-bold'>
                {getPositionIcon()}
              </span>
            </div>
          )}

          {/* Player Avatar */}
          <div className='flex items-center mb-2'>
            <div className='w-10 h-10 bg-black border-2 border-white rounded-full mr-3 flex items-center justify-center relative overflow-hidden'>
              {/* Avatar Background Pattern */}
              <div className='absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900'></div>
              <span
                className={`${statusColor()} font-mono text-xs font-bold relative z-10`}
              >
                AGC
              </span>
              {/* Status indicator dot */}
              <div
                className={`absolute bottom-0 right-0 w-3 h-3 ${
                  status === 'PLAYING'
                    ? 'bg-green-400'
                    : status === 'FOLDED'
                      ? 'bg-gray-400'
                      : 'bg-yellow-400'
                } border border-white rounded-full`}
              ></div>
            </div>

            {/* Player Name and Status */}
            <div className='flex-1'>
              <div className='text-white font-mono text-xs font-bold truncate'>
                {playerName}
              </div>
              <div
                className={`${statusColor()} font-mono text-[10px] flex items-center ${isCurrentPlayer && status === 'PLAYING' ? 'animate-pulse' : ''}`}
              >
                <span className='mr-1'>{getStatusIcon()}</span>
                {status === 'PLAYING'
                  ? isCurrentPlayer
                    ? 'Thinking...'
                    : 'Ready'
                  : status}
              </div>
            </div>
          </div>

          {/* Chips Display */}
          <div className='mt-1'>
            <div className='text-white font-mono text-[10px]'>
              <span className='text-gray-400'>Chips:</span>
              <span className='text-green-400 ml-1 font-bold'>
                ${formatChips(chips)}
              </span>
            </div>
          </div>

          {/* Betting Information */}
          {(bet.amount > 0 || bet.volume > 0) && (
            <div className='space-y-1'>
              {bet.amount > 0 && (
                <div className='text-white font-mono text-[10px]'>
                  <span className='text-gray-400'>Round Bet:</span>
                  <span className='text-yellow-400 ml-1'>
                    ${formatChips(bet.amount)}
                  </span>
                </div>
              )}
              {bet.volume > 0 && (
                <div className='text-white font-mono text-[10px]'>
                  <span className='text-gray-400'>Total Bet:</span>
                  <span className='text-yellow-400 ml-1'>
                    ${formatChips(bet.volume)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Contract Betting Info */}
          {(totalContractBet > 0 || userContractBet > 0) && (
            <div className='border-t border-gray-600 pt-2 space-y-1'>
              {totalContractBet > 0 && (
                <div className='text-white font-mono text-[10px]'>
                  <span className='text-gray-400'>Pool:</span>
                  <span className='text-blue-400 ml-1'>
                    ${formatChips(totalContractBet)}
                  </span>
                </div>
              )}
              {userContractBet > 0 && (
                <div className='text-white font-mono text-[10px]'>
                  <span className='text-gray-400'>Your Bet:</span>
                  <span className='text-blue-400 ml-1'>
                    ${formatChips(userContractBet)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player's Hand */}
        {hand.length > 0 && (
          <div className='flex justify-center mt-2 gap-2'>
            {hand.map((card: CardType, index: number) => (
              <Card
                key={`${card.rank}-${card.suit}-${index}`}
                card={card}
                isPlayerFolded={status === 'FOLDED'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
