import React from 'react';
import { Card } from './Card';
import { Player } from './Player';
import { PokerState } from '../types/poker';

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
              {gameState.status === "PLAYING" && "Game in progress"}
            </div>
            {/* Pot */}
            <div className="pot">POT: ${gameState.pot}</div>
            {/* Community cards */}
            <div className="river">
              {gameState?.community?.map((card, index) => (
                <Card key={`${card.rank}-${card.suit}-${index}`} card={card} />
              ))}
              {/* Empty cards para completar 5 */}
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