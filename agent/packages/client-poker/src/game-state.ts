export enum PlayerAction {
    FOLD = "fold",
    CHECK = "check",
    CALL = "call",
    RAISE = "raise",
}

export interface PokerDecision {
    action: PlayerAction;
    amount?: number;
}

export interface Card {
    suit: string;
    rank: string;
}
