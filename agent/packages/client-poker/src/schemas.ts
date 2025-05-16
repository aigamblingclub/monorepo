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
export type Card = {
    readonly rank: CardValue;
    readonly suit: Suite;
};

export const PlayerStatusSchema = Schema.Union(
    Schema.Literal("PLAYING"),
    Schema.Literal("FOLDED"),
    Schema.Literal("ALL_IN")
);
export type PlayerStatus = typeof PlayerStatusSchema.Type;

export const HoleCardsSchema = Schema.Tuple(CardSchema, CardSchema);
export type HoleCards = typeof HoleCardsSchema.Type;

export const PlayerStateSchema = Schema.Struct({
    id: Schema.String,
    playerName: Schema.String,
    status: PlayerStatusSchema,
    hand: Schema.Union(Schema.Tuple(), HoleCardsSchema),
    chips: Schema.Number,
    bet: Schema.Struct({
        round: Schema.Number,
        total: Schema.Number,
    }),
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

export const RoundPhaseSchema = Schema.Union(
    Schema.Literal("PRE_FLOP"),
    Schema.Literal("FLOP"),
    Schema.Literal("TURN"),
    Schema.Literal("RIVER"),
    Schema.Literal("SHOWDOWN")
);
export type RoundPhase = typeof RoundPhaseSchema.Type;

export const RoundStateSchema = Schema.Struct({
    phase: RoundPhaseSchema,
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

export const PokerStateSchema = Schema.Struct({
    status: TableStatusSchema,
    players: Schema.Array(PlayerStateSchema),
    currentPlayerIndex: Schema.Number,
    deck: Schema.Array(CardSchema),
    community: Schema.Array(CardSchema),
    // Total pot across all rounds
    pot: Schema.Number,
    // Current round state
    round: RoundStateSchema,
    dealerId: Schema.String,
    winner: Schema.Union(Schema.String, Schema.Null),
    config: GameConfigSchema,
});
export type PokerState = typeof PokerStateSchema.Type;

export const MoveSchema = Schema.Union(
    Schema.Struct({ type: Schema.Literal("fold") }),
    Schema.Struct({ type: Schema.Literal("call") }),
    Schema.Struct({ type: Schema.Literal("all_in") }),
    Schema.Struct({
        type: Schema.Literal("raise"),
        amount: Schema.Number,
    })
);
export type Move = typeof MoveSchema.Type;

export const TableActionSchema = Schema.Union(
    Schema.Literal("join"),
    Schema.Literal("leave")
);
export type TableAction = typeof TableActionSchema.Type;

export const MoveEventSchema = Schema.Struct({
    type: Schema.Literal("move"),
    playerId: Schema.String,
    move: MoveSchema,
});
export type MoveEvent = typeof MoveEventSchema.Type;

export const TableEventSchema = Schema.Struct({
    type: Schema.Literal("table"),
    playerId: Schema.String,
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
    Schema.Struct({ type: Schema.Literal("end_game") })
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
    Schema.Struct({ type: Schema.Literal("table_locked") })
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
    round: RoundStateSchema,
    player: PlayerStateSchema,
    opponents: Schema.Array(PlayerStateSchema.pick("status", "chips", "bet")),
});
export type PlayerView = typeof PlayerViewSchema.Type;
