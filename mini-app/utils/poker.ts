import { CardValue, Suite, Street } from '../types/poker';

// Utility functions
export const getCardLabel = (rank: CardValue): string => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
};

export const getCardSuitSymbol = (suit: Suite): string => {
  switch (suit) {
    case 'hearts':
      return '❤️';
    case 'diamonds':
      return '♦️';
    case 'clubs':
      return '♣️';
    case 'spades':
      return '♠️';
    default:
      return '';
  }
};

export const getPhaseLabel = (phase: Street): string => {
  switch (phase) {
    case 'PRE_FLOP':
      return 'Pre-Flop';
    case 'FLOP':
      return 'Flop';
    case 'TURN':
      return 'Turn';
    case 'RIVER':
      return 'River';
    case 'SHOWDOWN':
      return 'Showdown';
    default:
      return 'Unknown';
  }
};

export const formatChips = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount);
}; 