/*
    queries: functions that map the poker state data structure to a workable format
 */
import { Option } from "effect";
import type { PlayerView, PokerState } from "./schemas";

export const players = (state: PokerState) => Object.values(state.players).sort()

export const seatedPlayers = (state: PokerState) =>
  Object.keys(state.players).length;

export const playingPlayers = (state: PokerState) =>
  players(state).filter((p) => p.status === "PLAYING");

export const playersInRound = (state: PokerState) =>
  players(state).filter(
    p => p.status === "PLAYING" || p.status === "FOLDED",
  );

export const dealer = (state: PokerState) =>
  playersInRound(state)[state.dealerIndex];

export function firstPlayerIndex(state: PokerState): number {
  const players = playersInRound(state).length;
  const preflop = state.community.length === 0;
  return players === 2 && preflop
    ? state.dealerIndex
    : (state.dealerIndex + 3) % players;
}

export function rotated<T>(array: T[], count: number): T[] {
  const length = array.length;
  return Array.from({ length }).map((_, i) => array[(i + count) % length]);
}

export const roundRotation = (state: PokerState) => {
  const players = playersInRound(state);
  const index = firstPlayerIndex(state);
  return rotated(players, index);
};

export const currentPlayer = (state: PokerState) => {
  const players = roundRotation(state);
  return players[state.currentPlayerIndex];
};

export const bigBlind = (state: PokerState) => {
  const players = playersInRound(state);
  return players[(state.dealerIndex + 1) % players.length];
};

export const smallBlind = (state: PokerState) => {
  const players = playersInRound(state);
  return players[(state.dealerIndex + 2) % players.length];
};

export const playerView = (state: PokerState, playerId: string): PlayerView => ({
    hand: state.players[playerId]?.hand ?? [],
    community: state.community,
    tableStatus: state.status,
    dealerId: Option.fromNullable(dealer(state)?.id),
    bigBlindId: Option.fromNullable(bigBlind(state)?.id),
    smallBlindId: Option.fromNullable(smallBlind(state)?.id),
    currentPlayerId: Option.fromNullable(currentPlayer(state)?.id),
    winningPlayerId: state.winningPlayerId,
    burnt: state.burnt,
    pot: state.pot,
    bet: state.bet,
    player: state.players[playerId],
    opponents: Object.fromEntries(
        Object.entries(state.players)
        .filter(([id, _]) => id != playerId)
        .map(([id, { status, chips, bet }]) => [id, { status, chips, bet }]),
    ),
})
