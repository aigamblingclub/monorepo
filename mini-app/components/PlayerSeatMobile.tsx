'use client';

import { PlayerState } from '@/types/poker';
import { formatChips } from '@/utils/poker';
import Card from './Card';

interface PlayerSeatMobileProps {
  player: PlayerState;
  isCurrentPlayer: boolean;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export default function PlayerSeatMobile({ 
  player, 
  isCurrentPlayer, 
  position 
}: PlayerSeatMobileProps) {
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-1 left-1 transform';
      case 'top-center':
        return 'top-1 left-1/2 transform -translate-x-1/2';
      case 'top-right':
        return 'top-1 right-1 transform';
      case 'bottom-left':
        return 'bottom-1 left-1 transform';
      case 'bottom-center':
        return 'bottom-1 left-1/2 transform -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-1 right-1 transform';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (player.status) {
      case 'PLAYING':
        return isCurrentPlayer ? 'bg-green-500' : 'bg-blue-500';
      case 'FOLDED':
        return 'bg-gray-500';
      case 'ALL_IN':
        return 'bg-red-500';
      case 'ELIMINATED':
        return 'bg-black';
      default:
        return 'bg-gray-500';
    }
  };

  const isVertical = false;
  const isCorner = position.includes('left') || position.includes('right');
  const isCenter = position.includes('center');

  return (
    <div className={`player-seat-mobile ${isCorner ? 'corner' : ''} ${getPositionClasses()} ${isCurrentPlayer ? 'mobile-glow' : ''}`}>
      <div className={`flex flex-col items-center gap-1`}>
        
        {/* Avatar with status indicator */}
        <div className="relative">
          <div className={`player-avatar ${isCorner ? 'w-8 h-8 xs:w-10 xs:h-10' : 'w-10 h-10 xs:w-12 xs:h-12'}`}>
            {player.playerName.slice(0, 2).toUpperCase()}
          </div>
          <div className={`absolute -top-1 -right-1 w-2 h-2 xs:w-3 xs:h-3 rounded-full ${getStatusColor()} border border-white`} />
        </div>

        {/* Player info */}
        <div className="text-center min-w-0">
          <div className={`text-white font-medium truncate ${isCorner ? 'text-xs' : 'text-xs'}`}>
            {player.playerName}
          </div>
          <div className={`text-poker-gold font-bold ${isCorner ? 'text-xs' : 'text-xs'}`}>
            ${formatChips(player.chips)}
          </div>
          {player.bet.amount > 0 && (
            <div className={`text-yellow-300 ${isCorner ? 'text-xs' : 'text-xs'}`}>
              Bet: ${formatChips(player.bet.amount)}
            </div>
          )}
        </div>

        {/* Player cards (if visible) - only show for center positions */}
        {player.hand && player.hand.length > 0 && isCenter && (
          <div className="flex gap-1">
            {player.hand.map((card, index) => (
              <Card 
                key={index} 
                card={card} 
                className="w-4 h-6 xs:w-6 xs:h-8"
              />
            ))}
          </div>
        )}

        {/* Position indicator */}
        <div className={`absolute -bottom-1 -right-1 bg-amber-500 text-black text-xs px-1 rounded ${isCorner ? 'text-xs' : ''}`}>
          {player.position}
        </div>
      </div>
    </div>
  );
} 