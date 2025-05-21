import { TableStatus, RoundPhase, Card, PlayerStatus, DecisionContext } from "./schemas";

export enum PlayerAction {
    FOLD = "FOLD",
    CALL = "CALL",
    RAISE = "RAISE",
    ALL_IN = "ALL_IN",
}

export interface PokerDecision {
    action: PlayerAction;
    amount?: number;
    decisionContext?: DecisionContext;
}

// export type Card = {
//     readonly rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
//     readonly suit: "spades" | "diamonds" | "clubs" | "hearts";
// };

export interface RoundState {
    phase: RoundPhase;
    roundNumber: number;
    roundPot: number;
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
        round: number;
        total: number;
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
    pot: number;
    currentPlayerIndex: number;
    dealerId: string;
    winner: string | null;
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
