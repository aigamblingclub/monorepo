'use client';

import { PlayerState } from '@/types/poker';
import { formatChips } from '@/utils/poker';
import Card from './Card';

interface PlayerSeatMobileProps {
  player: PlayerState;
  isCurrentPlayer: boolean;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  lastActionType?: string | null;
  showLastAction?: boolean;
}

export default function PlayerSeatMobile({ 
  player, 
  isCurrentPlayer, 
  position,
  lastActionType = null,
  showLastAction = false
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

  const getActionDisplay = () => {
    if (!lastActionType) return '';
    
    switch (lastActionType.toLowerCase()) {
      case 'fold':
        return 'FOLD';
      case 'call':
        return 'CALL';
      case 'check':
        return 'CHECK';
      case 'raise':
        return 'RAISE';
      case 'all_in':
        return 'ALL IN';
      default:
        return lastActionType.toUpperCase();
    }
  };

  const getActionColor = () => {
    if (!lastActionType) return 'bg-gray-600';
    
    switch (lastActionType.toLowerCase()) {
      case 'fold':
        return 'bg-red-500';
      case 'call':
        return 'bg-blue-500';
      case 'check':
        return 'bg-green-500';
      case 'raise':
        return 'bg-orange-500';
      case 'all_in':
        return 'bg-purple-500';
      default:
        return 'bg-gray-600';
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
          
          {/* Last Action Badge */}
          {showLastAction && lastActionType && (
            <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 ${getActionColor()} text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg action-popup whitespace-nowrap z-20`}>
              {getActionDisplay()}
            </div>
          )}
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

        {/* Player cards (if visible) - show for all players except folded */}
        {player.hand && player.hand.length > 0 && player.status !== 'FOLDED' && (
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