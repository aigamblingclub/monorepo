// Re-export the types from poker-state-machine package
export type {
  Card,
  PlayerStatus,
  PlayerState,
  TableStatus,
  PokerState,
  Suite as CardSuit,
  RoundPhase,
  RoundState,
  Move,
  PlayerView,
  GameConfig,
  GameEvent,
  PlayerEvent,
  TableAction,
  CardValue,
  Position,
} from './schemas';

// Import for local use
import { Suite, type CardValue as CV, type RoundPhase } from 'poker-state-machine';
type CardSuit = Suite;

// Utility function to get card label
export const getCardLabel = (rank: CV): string => {
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

// Utility function to get the phase name in a more readable format
export const getPhaseLabel = (phase: RoundPhase): string => {
  switch (phase) {
    case 'PRE_FLOP': return 'Pre-Flop';
    case 'FLOP': return 'Flop';
    case 'TURN': return 'Turn';
    case 'RIVER': return 'River';
    case 'SHOWDOWN': return 'Showdown';
    default: return 'Unknown';
  }
};

// Utility function to format chips amount
export const formatChips = (amount: number): string => {
  return new Intl.NumberFormat('en-US').format(amount);
}; 

export enum PokerPosition {
  BB = "Big Blind",
  SB = "Small Blind",
  BTN = "Button",
  EP = "Early Position",
  MP = "Middle Position",
  CO = "Cut-off",
}