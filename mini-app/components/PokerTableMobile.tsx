'use client';

import { PokerState } from '@/types/poker';
import { formatChips } from '@/utils/poker';
import PlayerSeatMobile from './PlayerSeatMobile';
import CommunityCardsMobile from './CommunityCardsMobile';
import { useState } from 'react';

interface PokerTableMobileProps {
  gameState: PokerState;
}

export default function PokerTableMobile({ gameState }: PokerTableMobileProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Arrange players in mobile-friendly positions
  const getPlayerPosition = (index: number, totalPlayers: number): 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' => {
    if (totalPlayers <= 2) {
      return index === 0 ? 'bottom-center' : 'top-center';
    }
    if (totalPlayers <= 4) {
      const positions: ('top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right')[] = 
        ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
      return positions[index] || 'bottom-center';
    }
    if (totalPlayers === 5) {
      const positions: ('top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right')[] = 
        ['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-right'];
      return positions[index] || 'bottom-center';
    }
    // For 6 players: 3 em baixo, 3 acima
    const positions: ('top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right')[] = 
      ['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right'];
    return positions[index] || 'bottom-center';
  };

  const totalPot = gameState.round.volume;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header with game info */}
      <div className="bg-black/50 backdrop-blur-sm rounded-t-xl p-3 border-b border-white/20">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-white font-bold text-lg">Poker AI</h1>
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="text-white/70 text-sm touch-target"
          >
            {showDetails ? '▼' : '▶'} Details
          </button>
        </div>
        
        {showDetails && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-white/70">
              Round: <span className="text-white">{gameState.round.roundNumber}</span>
            </div>
            <div className="text-white/70">
              Current Bet: <span className="text-poker-gold">${formatChips(gameState.round.currentBet)}</span>
            </div>
            <div className="text-white/70">
              Status: <span className="text-white">{gameState.tableStatus}</span>
            </div>
            <div className="text-white/70">
              Players: <span className="text-white">{gameState.players.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main poker table */}
      <div className="flex justify-center">
        <div className="mobile-poker-table">
          {/* Center area with community cards and pot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <CommunityCardsMobile 
                cards={[...gameState.community]} 
                phase={gameState.phase.street} 
              />
              
              {/* Pot display */}
              <div className="mt-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
                <div className="text-white/70 text-xs">Total Pot</div>
                <div className="text-poker-gold font-bold text-sm">
                  ${formatChips(totalPot)}
                </div>
              </div>
            </div>
          </div>

          {/* Players positioned around the table */}
          {gameState.players.map((player, index) => {
            const position = getPlayerPosition(index, gameState.players.length);
            const isCurrentPlayer = player.id === currentPlayer?.id;
            
            return (
              <PlayerSeatMobile
                key={player.id}
                player={player}
                isCurrentPlayer={isCurrentPlayer}
                position={position}
              />
            );
          })}

          {/* Dealer button */}
          {gameState.dealerId && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-white rounded-full border-2 border-amber-500 flex items-center justify-center">
              <span className="text-black font-bold text-xs">D</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer with current action */}
      <div className="bg-black/50 backdrop-blur-sm rounded-b-xl p-3 border-t border-white/20">
        {currentPlayer && gameState.tableStatus === 'PLAYING' && (
          <div className="text-center">
            <div className="text-white/70 text-xs mb-1">Current Player</div>
            <div className="text-white font-semibold mobile-pulse">
              {currentPlayer.playerName}
            </div>
          </div>
        )}
        
        {gameState.tableStatus === 'WAITING' && (
          <div className="text-center text-white/70 text-sm">
            Waiting for players to join...
          </div>
        )}
        
        {gameState.winner && (
          <div className="text-center">
            <div className="text-poker-gold font-bold text-lg">
              🏆 {gameState.players.find(p => p.id === gameState.winner)?.playerName} Wins!
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 