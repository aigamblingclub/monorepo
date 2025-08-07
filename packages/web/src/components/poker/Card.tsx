import React from 'react';
import { Card as CardType } from '../../types/poker';
import { getCardLabel, getCardSuitSymbol } from '../../utils/poker';

interface CardProps {
  card?: CardType;
  isBack?: boolean;
  className?: string;
}

export default function Card({ card, isBack = false, className = '' }: CardProps) {
  if (isBack || !card) {
    return (
      <div style={{
        width: '40px',
        height: '56px',
        background: 'linear-gradient(45deg, #2c3e50, #34495e)',
        borderRadius: '4px',
        border: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        fontWeight: 'bold',
        color: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
      }}>
        ?
      </div>
    );
  }

  const label = getCardLabel(card.rank);
  const symbol = getCardSuitSymbol(card.suit);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div style={{
      width: '40px',
      height: '56px',
      background: 'white',
      borderRadius: '4px',
      border: '1px solid #ccc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 'bold',
      color: isRed ? '#e74c3c' : '#2c3e50',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}>
      <div>{label}</div>
      <div style={{ fontSize: '16px' }}>{symbol}</div>
    </div>
  );
}