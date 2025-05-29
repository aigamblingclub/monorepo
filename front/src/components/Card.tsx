import React from 'react';
import { Card as CardType, getCardLabel, getCardSuitSymbol } from '../types/poker';

interface CardProps {
  card: CardType | null;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ card, className = '' }) => {
  if (!card) {
    return (
      <div className={`w-[45px] h-[65px] border-[var(--border-width)] border-[var(--theme-secondary)] shadow-[0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary),inset_0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary)] rounded-[var(--border-radius-card)] bg-[var(--surface-tertiary)] flex flex-col justify-between items-center p-1.5 text-lg font-bold ${className}`}>
        <span className="text-[var(--theme-secondary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-secondary)]"></span>
        <span className="text-[1.3em] text-[var(--theme-secondary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-secondary)]"></span>
      </div>
    );
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const cardValue = getCardLabel(card.rank);
  const cardSuit = getCardSuitSymbol(card.suit);
  return (
    <div className={`w-[45px] h-[65px] border-[var(--border-width)] border-[var(--theme-secondary)] shadow-[0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary),inset_0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary)] rounded-[var(--border-radius-card)] bg-[var(--surface-tertiary)] flex flex-col justify-between items-center p-1.5 text-lg font-bold ${className}`}>
      <span className={`text-[var(--theme-secondary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-secondary)] ${isRed ? 'text-[var(--theme-alert)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-alert)]' : ''}`}>{cardValue}</span>
      <span className={`text-[1.3em] text-[var(--theme-secondary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-secondary)] ${isRed ? 'text-[var(--theme-alert)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-alert)]' : ''}`}>{cardSuit}</span>
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