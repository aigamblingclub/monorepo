import { type PlayerState, type PokerState } from "./schemas";

export const POKER_ROOM_DEFAULT_STATE: PokerState = {
  tableId: "0", // created in makePokerRoom
  tableStatus: "WAITING",
  players: [],
  lastMove: null,
  deck: [],
  community: [],
  pot: 0,
  round: {
    phase: "PRE_FLOP",
    roundNumber: 1,
    roundPot: 0,
    currentBet: 0,
    foldedPlayers: [],
    allInPlayers: [],
  },
  dealerId: "",
  currentPlayerIndex: -1,
  winner: null,
  config: {
    maxRounds: null,
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
  },
};

export const PLAYER_DEFAULT_STATE: Omit<PlayerState, "id"> = {
  status: "PLAYING",
  hand: [],
  chips: 1000,
  position: "BB", // will be set by the game-state-machine
  playedThisPhase: false,
  bet: { round: 0, total: 0 },
  playerName: "",
};
