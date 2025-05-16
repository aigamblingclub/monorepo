import React from 'react';
import { Card } from './Card';
import { Player } from './Player';
import { PokerState, formatChips, getPhaseLabel } from '../types/poker';

interface PokerTableProps {
  gameState: PokerState;
}

export const PokerTable: React.FC<PokerTableProps> = ({ gameState }) => {
  return (
    <div className="h-full bg-black flex justify-center items-center">
      <div className="poker-table-container">
        <div className="table-surface">
          {/* Players */}
          {gameState?.players?.map((player, index) => (
            <Player
              key={player.id}
              player={player}
              position={
                gameState.players.length === 2
                  ? (index === 0 ? 7 : 8)
                  : ((index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
              }
              isCurrentPlayer={index === gameState?.currentPlayerIndex}
              isDealer={player.id === gameState.dealerId}
            />
          ))}

          {/* Center area */}
          <div className="center-area">
            {/* Game status */}
            <div className="game-status">
              {gameState.status === "WAITING" && "Waiting for players..."}
              {gameState.status === "ROUND_OVER" && gameState.winner && `Winner: ${gameState.winner}`}
              {gameState.status === "GAME_OVER" && gameState.winner && `Game Over - Winner: ${gameState.winner}`}
              {gameState.status === "PLAYING" && (
                <>
                  <div>Phase: {getPhaseLabel(gameState.round.phase)}</div>
                  <div>Round: {gameState.round.roundNumber}</div>
                </>
              )}
            </div>
            {/* Pot and current bet */}
            <div className="pot">
              <div>POT: ${formatChips(gameState.pot)}</div>
              {gameState.round.currentBet > 0 && (
                <div className="current-bet">Current Bet: ${formatChips(gameState.round.currentBet)}</div>
              )}
              {gameState.round.roundPot > 0 && (
                <div className="round-pot">Round Pot: ${formatChips(gameState.round.roundPot)}</div>
              )}
            </div>
            {/* Community cards */}
            <div className="river">
              {gameState?.community?.map((card, index) => (
                <Card key={`${card.rank}-${card.suit}-${index}`} card={card} />
              ))}
              {/* Empty cards to complete 5 */}
              {Array.from({ length: Math.max(0, 5 - gameState.community.length) }).map((_, index) => (
                <Card key={`empty-${index}`} card={null} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 