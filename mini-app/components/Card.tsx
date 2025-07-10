'use client';

import { Card as CardType } from '@/types/poker';
import { getCardLabel, getCardSuitSymbol } from '@/utils/poker';

interface CardProps {
  card?: CardType;
  isBack?: boolean;
  className?: string;
}

export default function Card({ card, isBack = false, className = '' }: CardProps) {
  if (isBack || !card) {
    return (
      <div className={`poker-card poker-card-back ${className}`}>
        <div className="text-white font-bold">?</div>
      </div>
    );
  }

  const label = getCardLabel(card.rank);
  const symbol = getCardSuitSymbol(card.suit);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div className={`poker-card ${className}`}>
      <div className={`flex flex-col items-center justify-center ${isRed ? 'text-red-600' : 'text-black'}`}>
        <div className="text-xs font-bold leading-none">{label}</div>
        <div className="text-xs leading-none">{symbol}</div>
      </div>
    </div>
  );
} 