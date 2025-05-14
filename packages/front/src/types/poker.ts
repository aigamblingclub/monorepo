// Re-export the types from poker-state-machine package
export type {
  Card,
  PlayerStatus,
  PlayerState,
  TableStatus,
  PokerState,
  Suite as CardSuit
} from 'poker-state-machine';

// Import for local use
import { Suite } from 'poker-state-machine';
type CardSuit = Suite;

// Utility function to get card label
export const getCardLabel = (rank: number): string => {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
};

// Utility function to get card suit symbol
export const getCardSuitSymbol = (suit: CardSuit): string => {
  switch (suit) {
    case 'hearts': return '♥';
    case 'diamonds': return '♦';
    case 'clubs': return '♣';
    case 'spades': return '♠';
    default: return '';
  }
}; 