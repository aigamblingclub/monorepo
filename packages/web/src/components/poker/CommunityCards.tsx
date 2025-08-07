import React from 'react';
import { Card as CardType, Street } from '../../types/poker';
import Card from './Card';

interface CommunityCardsProps {
  cards: CardType[];
  phase: Street;
}

export default function CommunityCards({ cards, phase }: CommunityCardsProps) {
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
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {Array.from({ length: 5 }, (_, index) => {
        if (index < cardsToShow && cards[index]) {
          return <Card key={index} card={cards[index]} />;
        }
        return (
          <div
            key={index}
            style={{
              width: '40px',
              height: '56px',
              border: '2px dashed rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '18px'
            }}
          >
            ?
          </div>
        );
      })}
    </div>
  );
}