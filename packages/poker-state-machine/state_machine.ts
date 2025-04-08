import { Option } from "effect";
import type { PlayerState, PokerState } from "./schemas";

export const POKER_ROOM_DEFAULT_STATE: PokerState = {
  status: "WAITING",
  players: {},
  deck: [],
  community: [],
  burnt: [],
  pot: 0,
  bet: 0,
  dealerIndex: -1,
  currentPlayerIndex: -1,
  winningPlayerId: Option.none<string>(),
};

export const PLAYER_DEFAULT_STATE: Omit<PlayerState, "id"> = {
  status: "OUT",
  hand: [],
  chips: 100,
  bet: 0,
};
