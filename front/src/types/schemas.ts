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
  Schema.Literal("ALL_IN")
);
export type PlayerStatus = typeof PlayerStatusSchema.Type;

export const HoleCardsSchema = Schema.Tuple(CardSchema, CardSchema);
export type HoleCards = typeof HoleCardsSchema.Type;

/**
 * # Position in the table
 * 
 * ## Heads-up Game Structure (2 Players)
 *  - Big Blind (BB): Second forced bet, twice the small blind
 *  - Small Blind (SB): First forced bet, left of button
 *  - Action moves clockwise
 * 
 * ## Regular Game Structure (3+ Players)
 *  - Small Blind (SB): First forced bet, left of button
 *  - Big Blind (BB): Second forced bet, twice the small blind
 *  - Button (BTN): Dealer position, acts last post-flop
 *  - Early Position (EP): First positions after blinds
 *  - Middle Position (MP): Middle positions
 *  - Cut-off (CO): Position before button
 *  - Action moves clockwise
 * 
 */
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
  hand: Schema.Union(Schema.Tuple(), HoleCardsSchema),
  chips: Schema.Number,
  bet: BetSchema,
});
export type PlayerState = typeof PlayerStateSchema.Type;

export const GameConfigSchema = Schema.Struct({
  maxRounds: Schema.Union(Schema.Number, Schema.Null),
  startingChips: Schema.Number,
  smallBlind: Schema.Number,
  bigBlind: Schema.Number,
});
export type GameConfig = typeof GameConfigSchema.Type;

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
  // Round-specific pot (will be added to main pot at end of round)
  roundPot: Schema.Number,
  // Round-specific bet
  currentBet: Schema.Number,
  // Players who have folded this round
  foldedPlayers: Schema.Array(Schema.String),
  // Players who are all-in this round
  allInPlayers: Schema.Array(Schema.String),
});
export type RoundState = typeof RoundStateSchema.Type;
export const DecisionContextSchema = Schema.Struct({
  thinking: Schema.Union(Schema.String, Schema.Null),
  explanation: Schema.Union(Schema.String, Schema.Null),
  analysis: Schema.Union(Schema.String, Schema.Null),
  reasoning: Schema.Union(Schema.String, Schema.Null),
  strategy: Schema.Union(Schema.String, Schema.Null),
  logic: Schema.Union(Schema.String, Schema.Null),
  roleplay: Schema.Union(Schema.String, Schema.Null),
});
export type DecisionContext = typeof DecisionContextSchema.Type;

export const MoveSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("fold"),
    decisionContext: Schema.Union(Schema.Null, DecisionContextSchema),
  }),
  Schema.Struct({
    type: Schema.Literal("call"),
    decisionContext: Schema.Union(Schema.Null, DecisionContextSchema),
  }),
  Schema.Struct({
    type: Schema.Literal("all_in"),
    decisionContext: Schema.Union(Schema.Null, DecisionContextSchema),
  }),
  Schema.Struct({
    type: Schema.Literal("raise"),
    amount: Schema.Number,
    decisionContext: Schema.Union(Schema.Null, DecisionContextSchema),
  })
);
export type Move = typeof MoveSchema.Type;
export const MoveEventSchema = Schema.Struct({
  type: Schema.Literal("move"),
  playerId: Schema.String,
  move: MoveSchema,
});
export type MoveEvent = typeof MoveEventSchema.Type;

/**
 * # Poker State
 * 
 * One Game (table) has multiple rounds.
 * One round has multiple phases/streets.
 * One phase/street has multiple actions.
 */
export const PokerStateSchema = Schema.Struct({
  tableId: Schema.String,
  tableStatus: TableStatusSchema,
  players: Schema.Array(PlayerStateSchema),
  lastMove: Schema.Union(MoveEventSchema, Schema.Null),
  currentPlayerIndex: Schema.Number,
  deck: Schema.Array(CardSchema),
  community: Schema.Array(CardSchema),
  // Total pot across all rounds
  pot: Schema.Number,
  phase: PhaseSchema,
  round: RoundStateSchema,
  dealerId: Schema.String,
  winner: Schema.Union(Schema.String, Schema.Null),
  config: GameConfigSchema,
});
export type PokerState = typeof PokerStateSchema.Type;

export const TableActionSchema = Schema.Union(
  Schema.Literal("join"),
  Schema.Literal("leave")
);
export type TableAction = typeof TableActionSchema.Type;


export const TableEventSchema = Schema.Struct({
  type: Schema.Literal("table"),
  playerId: Schema.String,
  playerName: Schema.String,
  action: TableActionSchema,
});
export type TableEvent = typeof TableEventSchema.Type;

export const PlayerEventSchema = Schema.Union(
  MoveEventSchema,
  TableEventSchema
);
export type PlayerEvent = typeof PlayerEventSchema.Type;

export const SystemEventSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal("start") }),
  Schema.Struct({ type: Schema.Literal("transition_phase") }),
  Schema.Struct({ type: Schema.Literal("next_round") }),
  Schema.Struct({ type: Schema.Literal("end_game") }),
  Schema.Struct({ type: Schema.Literal("auto_restart") })
);
export type SystemEvent = typeof SystemEventSchema.Type;

export const GameEventSchema = Schema.Union(
  PlayerEventSchema,
  SystemEventSchema
);
export type GameEvent = typeof GameEventSchema.Type;

export const StateMachineErrorSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("inconsistent_state"),
    message: Schema.String,
  })
);
export type StateMachineError = typeof StateMachineErrorSchema.Type;

export const ProcessEventErrorSchema = Schema.Union(
  StateMachineErrorSchema,
  Schema.Struct({ type: Schema.Literal("not_your_turn") }),
  Schema.Struct({ type: Schema.Literal("table_locked") }),
  Schema.Struct({ type: Schema.Literal("game_already_started") }),
  Schema.Struct({ type: Schema.Literal("insufficient_players") }),
  Schema.Struct({ type: Schema.Literal("game_not_over") })
);
export type ProcessEventError = typeof ProcessEventErrorSchema.Type;

export const ProcessStateErrorSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("inconsistent_state"),
    state: PokerStateSchema,
    message: Schema.String,
  })
);
export type ProcessStateError = typeof ProcessStateErrorSchema.Type;

export const ProcessingStateStreamErrorsSchema = Schema.Union(
  ProcessEventErrorSchema,
  ProcessStateErrorSchema
);

export const PlayerViewSchema = Schema.Struct({
  hand: Schema.Array(CardSchema),
  tableStatus: TableStatusSchema,
  currentPlayerId: Schema.Option(Schema.String),
  dealerId: Schema.String,
  bigBlindId: Schema.Option(Schema.String),
  smallBlindId: Schema.Option(Schema.String),
  community: Schema.Array(CardSchema),
  pot: Schema.Number,
  phase: PhaseSchema,
  round: RoundStateSchema,
  player: PlayerStateSchema,
  opponents: Schema.Array(
    Schema.Struct({
      status: PlayerStatusSchema,
      chips: Schema.Number,
      bet: BetSchema,
      hand: Schema.Array(CardSchema),
    })
  ),
});
export type PlayerView = typeof PlayerViewSchema.Type;
