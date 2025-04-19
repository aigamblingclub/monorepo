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

export interface PlayerState {
    id: string;
    name: string;
    chips: number;
    isReady: boolean;
    currentBet: number;
    isFolded: boolean;
    hand?: Card[];
}

export interface WinnerInfo {
    id: string;
    name: string;
    winningHand: Card[];
    handDescription: string;
}
