import React from 'react';
import { PokerState } from '../../types/poker';
import { formatChips } from '../../utils/poker';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';

interface PokerTableProps {
  gameState: PokerState;
}

export default function PokerTable({ gameState }: PokerTableProps) {
  const getPlayerPosition = (index: number, total: number) => {
    // Position players around an oval table
    const positions = [
      { bottom: '10px', left: '50%', transform: 'translateX(-50%)' }, // Bottom center
      { top: '10px', left: '50%', transform: 'translateX(-50%)' }, // Top center
      { top: '50%', left: '10px', transform: 'translateY(-50%)' }, // Left middle
      { top: '50%', right: '10px', transform: 'translateY(-50%)' }, // Right middle
      { bottom: '60px', left: '20px' }, // Bottom left
      { bottom: '60px', right: '20px' }, // Bottom right
      { top: '60px', left: '20px' }, // Top left
      { top: '60px', right: '20px' }, // Top right
    ];
    
    return positions[index] || positions[0];
  };

  const totalPot = gameState.round.volume;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Table */}
      <div style={{
        position: 'relative',
        width: '90%',
        maxWidth: '800px',
        height: '500px',
        background: 'radial-gradient(ellipse at center, #2ecc71, #27ae60)',
        borderRadius: '200px / 100px',
        border: '8px solid #8b4513',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Table center */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
          {/* Community cards */}
          <CommunityCards cards={gameState.community} phase={gameState.phase.street} />
          
          {/* Pot */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '8px',
            padding: '10px 20px',
            display: 'flex',
            gap: '20px',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                Total Pot
              </div>
              <div style={{ color: '#f39c12', fontSize: '18px', fontWeight: 'bold' }}>
                ${formatChips(totalPot)}
              </div>
            </div>
            <div style={{
              width: '1px',
              height: '30px',
              background: 'rgba(255, 255, 255, 0.2)'
            }} />
            <div>
              <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                Phase
              </div>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
                {gameState.phase.street.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Winner announcement */}
          {gameState.winner && (
            <div style={{
              background: 'linear-gradient(135deg, #f39c12, #e67e22)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)'
            }}>
              🏆 {gameState.players.find(p => p.id === gameState.winner)?.playerName} Wins!
            </div>
          )}
        </div>

        {/* Players */}
        {gameState.players.map((player, index) => {
          const position = getPlayerPosition(index, gameState.players.length);
          const isCurrentPlayer = player.id === currentPlayer?.id;
          
          return (
            <PlayerSeat
              key={player.id}
              player={player}
              isCurrentPlayer={isCurrentPlayer}
              position={position}
            />
          );
        })}

        {/* Game status */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          Round {gameState.round.roundNumber} • {gameState.tableStatus}
        </div>
      </div>
    </div>
  );
}