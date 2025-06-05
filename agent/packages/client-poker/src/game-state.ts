import { TableStatus, Card, PlayerStatus, DecisionContext } from "./schemas";

export enum PlayerAction {
    FOLD = "FOLD",
    CALL = "CALL",
    RAISE = "RAISE",
    ALL_IN = "ALL_IN",
}

export interface PokerDecision {
    action: PlayerAction;
    amount?: number;
    decisionContext: DecisionContext | null;
}

export type RoundPhase = "PRE_FLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";

export interface Phase {
    street: RoundPhase;
    actionCount: number;
    volume: number;
}

export interface RoundState {
    roundNumber: number;
    volume: number;
    currentBet: number;
    foldedPlayers: string[];
    allInPlayers: string[];
}

export interface PlayerState {
    id: string;
    playerName: string;
    status: PlayerStatus;
    chips: number;
    hand?: readonly Card[];
    bet: {
        amount: number;
        volume: number;
    };
}

export interface WinnerInfo {
    id: string;
    playerName?: string;
    winningHand?: readonly Card[];
    handDescription?: string;
}

export interface GameState {
    players: PlayerState[];
    tableStatus: TableStatus;
    currentPlayerIndex: number;
    dealerId: string;
    winner: string | null;
    phase: Phase;
    round: RoundState;
    communityCards: readonly Card[];
    config: {
        maxRounds: number | null;
        startingChips: number;
        smallBlind: number;
        bigBlind: number;
    };
    roundHistory: string[];
}

export interface AvailableGame {
    id: string;
    players: Array<{
        id?: string;
        playerName: string;
        status: PlayerStatus;
    }>;
    createdAt: string;
    tableStatus: TableStatus;
    playersNeeded?: number;
}

export interface AvailableGamesResponse {
    games: AvailableGame[];
    maxGames: number;
    currentGames: number;
    canCreateNew: boolean;
}
