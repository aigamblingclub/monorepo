import React from 'react';
import { Card as CardType, getCardLabel, getCardSuitSymbol } from '../types/poker';

interface CardProps {
  card: CardType | null;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ card, className = '' }) => {
  if (!card) {
    return (
      <div className={`card ${className}`}>
        <span className="card-value"></span>
        <span className="card-suit"></span>
      </div>
    );
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const cardValue = getCardLabel(card.rank);
  const cardSuit = getCardSuitSymbol(card.suit);
  return (
    <div className={`card ${className}`}>
      <span className={`card-value ${isRed ? 'suit-hearts' : 'suit-clubs'}`}>{cardValue}</span>
      <span className={`card-suit ${isRed ? 'suit-hearts' : 'suit-clubs'}`}>{cardSuit}</span>
    </div>
  );
};

interface EmptyCardProps {
  className?: string;
}

export const EmptyCard: React.FC<EmptyCardProps> = ({ className = '' }) => {
  return (
    <div className={`w-[45px] h-[65px] border-2 border-neon-cyan/50 rounded bg-black/30 flex flex-col justify-between items-center p-1 ${className}`} />
  );
}; 