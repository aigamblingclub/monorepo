import React from 'react';
import { PlayerState } from '../../types/poker';
import { formatChips } from '../../utils/poker';
import Card from './Card';

interface PlayerSeatProps {
  player: PlayerState;
  isCurrentPlayer: boolean;
  position: { top?: string; bottom?: string; left?: string; right?: string };
}

export default function PlayerSeat({ player, isCurrentPlayer, position }: PlayerSeatProps) {
  const getStatusColor = () => {
    switch (player.status) {
      case 'PLAYING':
        return isCurrentPlayer ? '#27ae60' : '#3498db';
      case 'FOLDED':
        return '#7f8c8d';
      case 'ALL_IN':
        return '#e74c3c';
      case 'ELIMINATED':
        return '#2c3e50';
      default:
        return '#7f8c8d';
    }
  };

  return (
    <div style={{
      position: 'absolute',
      ...position,
      background: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '8px',
      padding: '8px',
      border: isCurrentPlayer ? '2px solid #f39c12' : '1px solid rgba(255, 255, 255, 0.2)',
      minWidth: '120px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px'
    }}>
      {/* Avatar */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${getStatusColor()}, ${getStatusColor()}dd)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '14px',
        border: '2px solid white',
        position: 'relative'
      }}>
        {player.playerName.slice(0, 2).toUpperCase()}
        {/* Status dot */}
        <div style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          border: '2px solid white'
        }} />
      </div>

      {/* Player info */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
          {player.playerName}
        </div>
        <div style={{ color: '#f39c12', fontSize: '12px', fontWeight: 'bold' }}>
          ${formatChips(player.chips)}
        </div>
        {player.bet.amount > 0 && (
          <div style={{ color: '#f1c40f', fontSize: '11px' }}>
            Bet: ${formatChips(player.bet.amount)}
          </div>
        )}
      </div>

      {/* Cards */}
      {player.hand && player.hand.length > 0 && player.status !== 'FOLDED' && (
        <div style={{ display: 'flex', gap: '2px', transform: 'scale(0.8)' }}>
          {player.hand.map((card, index) => (
            <Card key={index} card={card} />
          ))}
        </div>
      )}

      {/* Position badge */}
      <div style={{
        position: 'absolute',
        bottom: '-8px',
        right: '-8px',
        background: '#f39c12',
        color: 'black',
        fontSize: '10px',
        padding: '2px 4px',
        borderRadius: '4px',
        fontWeight: 'bold'
      }}>
        {player.position}
      </div>
    </div>
  );
}