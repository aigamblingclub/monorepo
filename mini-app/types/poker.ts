// Types adaptados do projeto front para o mini-app
import { Schema } from "effect";

export const CardValueSchema = Schema.Union(
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const).map((n) =>
    Schema.Literal(n)
  )
);
export type CardValue = typeof CardValueSchema.Type;

export const SUITS = ["spades", "diamonds", "clubs", "hearts"] as const;
export const SuiteSchema = Schema.Union(...SUITS.map((s) => Schema.Literal(s)));
export type Suite = typeof SuiteSchema.Type;

export const CardSchema = Schema.Struct({
  rank: CardValueSchema,
  suit: SuiteSchema,
});
export type Card = typeof CardSchema.Type;

export const PlayerStatusSchema = Schema.Union(
  Schema.Literal("PLAYING"),
  Schema.Literal("FOLDED"),
  Schema.Literal("ALL_IN"),
  Schema.Literal("ELIMINATED")
);
export type PlayerStatus = typeof PlayerStatusSchema.Type;

export const PositionSchema = Schema.Union(
  Schema.Literal("BB"), // Big Blind
  Schema.Literal("SB"), // Small Blind
  Schema.Literal("BTN"), // Button
  Schema.Literal("EP"), // Early Position
  Schema.Literal("MP"), // Middle Position
  Schema.Literal("CO"), // Cut-off
);
export type Position = typeof PositionSchema.Type;

export const BetSchema = Schema.Struct({
  amount: Schema.Number,
  volume: Schema.Number,
});
export type Bet = typeof BetSchema.Type;

export const PlayerStateSchema = Schema.Struct({
  id: Schema.String,
  playerName: Schema.String,
  status: PlayerStatusSchema,
  playedThisPhase: Schema.Boolean,
  position: PositionSchema,
  hand: Schema.Array(CardSchema),
  chips: Schema.Number,
  bet: BetSchema,
});
export type PlayerState = typeof PlayerStateSchema.Type;

export const TableStatusSchema = Schema.Union(
  Schema.Literal("WAITING"),
  Schema.Literal("PLAYING"),
  Schema.Literal("ROUND_OVER"),
  Schema.Literal("GAME_OVER")
);
export type TableStatus = typeof TableStatusSchema.Type;

export const StreetSchema = Schema.Union(
  Schema.Literal("PRE_FLOP"),
  Schema.Literal("FLOP"),
  Schema.Literal("TURN"),
  Schema.Literal("RIVER"),
  Schema.Literal("SHOWDOWN")
);
export type Street = typeof StreetSchema.Type;

export const PhaseSchema = Schema.Struct({
  street: StreetSchema,
  actionCount: Schema.Number,
  volume: Schema.Number,
});
export type Phase = typeof PhaseSchema.Type;

export const RoundStateSchema = Schema.Struct({
  roundNumber: Schema.Number,
  volume: Schema.Number,
  currentBet: Schema.Number,
  foldedPlayers: Schema.Array(Schema.String),
  allInPlayers: Schema.Array(Schema.String),
});
export type RoundState = typeof RoundStateSchema.Type;

export const PokerStateSchema = Schema.Struct({
  tableId: Schema.String,
  tableStatus: TableStatusSchema,
  players: Schema.Array(PlayerStateSchema),
  currentPlayerIndex: Schema.Number,
  deck: Schema.Array(CardSchema),
  community: Schema.Array(CardSchema),
  phase: PhaseSchema,
  round: RoundStateSchema,
  dealerId: Schema.String,
  winner: Schema.Union(Schema.String, Schema.Null),
  config: Schema.Struct({
    maxRounds: Schema.Union(Schema.Number, Schema.Null),
    startingChips: Schema.Number,
    smallBlind: Schema.Number,
    bigBlind: Schema.Number,
  }),
});
export type PokerState = typeof PokerStateSchema.Type;

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
      return '❤';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
    case 'spades':
      return '♠';
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