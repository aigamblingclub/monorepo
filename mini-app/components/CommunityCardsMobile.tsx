'use client';

import { Card as CardType, Street } from '@/types/poker';
import Card from './Card';

interface CommunityCardsMobileProps {
  cards: CardType[];
  phase: Street;
}

export default function CommunityCardsMobile({ cards, phase }: CommunityCardsMobileProps) {
  const getCardsToShow = () => {
    switch (phase) {
      case 'PRE_FLOP':
        return 0;
      case 'FLOP':
        return 3;
      case 'TURN':
        return 4;
      case 'RIVER':
      case 'SHOWDOWN':
        return 5;
      default:
        return 0;
    }
  };

  const cardsToShow = getCardsToShow();

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Community Cards */}
      <div className="flex gap-0.5 xs:gap-1">
        {Array.from({ length: 5 }, (_, index) => {
          if (index < cardsToShow && cards[index]) {
            return (
              <Card 
                key={index} 
                card={cards[index]} 
                className="mobile-card-flip w-6 h-8 xs:w-8 xs:h-10"
              />
            );
          }
          return (
            <div 
              key={index} 
              className="w-6 h-8 xs:w-8 xs:h-10 border-dashed border-white/30 bg-transparent rounded flex items-center justify-center"
            >
              <div className="text-white/50 text-xs">?</div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 