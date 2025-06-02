import React from 'react';
import {
  Card as CardType,
  getCardLabel,
  getCardSuitSymbol,
} from '../types/poker';

interface CardProps {
  card: CardType | null;
  className?: string;
  isPlayerFolded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  card,
  className = '',
  isPlayerFolded = false,
}) => {
  if (!card) {
    return (
      <div
        className={`w-[45px] h-[65px] border border-[var(--border-width)] border-[var(--theme-secondary)] shadow-[0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary),inset_0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary)] rounded-[var(--border-radius-card)] bg-[var(--surface-tertiary)] flex flex-col justify-between items-center p-1.5 text-lg font-bold ${className}`}
      >
        <span className='text-[var(--theme-secondary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-secondary)]'></span>
        <span className='text-[1.3em] text-[var(--theme-secondary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-secondary)]'></span>
      </div>
    );
  }
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const cardValue = getCardLabel(card.rank);
  const cardSuit = getCardSuitSymbol(card.suit);

  // Adjust font size for hearts vs other suits
  const getSuitSize = (suit: string) => {
    return suit === 'hearts' ? { fontSize: '1em' } : { fontSize: '1.3em' };
  };

  // Determine colors based on folded status
  const getCardColors = () => {
    if (isPlayerFolded) {
      return 'text-gray-400'; // Same grey as folded status
    }
    return isRed
      ? 'text-[var(--theme-alert)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-alert)]'
      : 'text-[var(--theme-secondary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-secondary)]';
  };

  return (
    <div
      className={`w-[45px] h-[65px] border border-[var(--border-width)] border-[var(--theme-secondary)] shadow-[0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary),inset_0_0_calc(var(--shadow-strength)*0.7)_var(--theme-secondary)] rounded-[var(--border-radius-card)] bg-[var(--surface-tertiary)] flex flex-col justify-between items-center p-1.5 text-lg font-bold ${className}`}
    >
      <span className={getCardColors()}>{cardValue}</span>
      <span style={getSuitSize(card.suit)} className={getCardColors()}>
        {cardSuit}
      </span>
    </div>
  );
};

interface EmptyCardProps {
  className?: string;
}

export const EmptyCard: React.FC<EmptyCardProps> = ({ className = '' }) => {
  return (
    <div
      className={`w-[45px] h-[65px] border-2 border-neon-cyan/50 rounded bg-black/30 flex flex-col justify-between items-center p-1 ${className}`}
    />
  );
};
