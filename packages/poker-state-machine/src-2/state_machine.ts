import { Effect, Option, Queue } from "effect";
import { TableEvent, type MoveEvent, type PlayerState, type PokerState } from "./schemas";
import { addPlayer, removePlayer, startRound } from "./transitions";

export const POKER_ROOM_DEFAULT_STATE: PokerState = {
  status: "WAITING",
  players: [],
  deck: [],
  community: [],
  pot: 0,
  bet: 0,
  // TODO: both of these are bad default values, refactor later
  dealerId: '',
  currentPlayerIndex: -1,
  // winningPlayerId: Option.none<string>(),
};

export const PLAYER_DEFAULT_STATE: Omit<PlayerState, "id"> = {
  status: "OUT",
  hand: [],
  chips: 100,
  bet: { round: 0, total: 0 },
};
