export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type Suite = 'spades' | 'diamonds' | 'clubs' | 'hearts';

export interface Card {
  rank: CardValue;
  suit: Suite;
}

export type PlayerStatus = 'PLAYING' | 'FOLDED' | 'ALL_IN' | 'ELIMINATED';
export type Position = 'BB' | 'SB' | 'BTN' | 'EP' | 'MP' | 'CO';
export type Street = 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';
export type TableStatus = 'WAITING' | 'PLAYING' | 'ROUND_OVER' | 'GAME_OVER';

export interface Bet {
  amount: number;
  volume: number;
}

export interface PlayerState {
  id: string;
  playerName: string;
  status: PlayerStatus;
  playedThisPhase: boolean;
  position: Position;
  hand: [] | [Card, Card];
  chips: number;
  bet: Bet;
}

export interface GameConfig {
  maxRounds: number | null;
  startingChips: number;
  smallBlind: number;
  bigBlind: number;
}

export interface RoundState {
  roundNumber: number;
  currentBet: number;
  volume: number;
}

export interface PhaseState {
  street: Street;
}

export interface LastMove {
  playerId: string;
  move: {
    type: string;
  };
}

export interface PokerState {
  players: PlayerState[];
  community: Card[];
  currentPlayerIndex: number;
  round: RoundState;
  phase: PhaseState;
  tableStatus: TableStatus;
  lastMove: LastMove | null;
  winner: string | null;
  dealerId: string | null;
}