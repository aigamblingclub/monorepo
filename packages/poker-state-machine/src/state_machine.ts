import { type PlayerState, type PokerState } from "./schemas";

export const POKER_ROOM_DEFAULT_STATE: PokerState = {
  tableId: "0", // created in makePokerRoom
  tableStatus: "WAITING",
  players: [],
  lastMove: null,
  deck: [],
  community: [],
  phase: {
    street: "PRE_FLOP",
    actionCount: 0,
    volume: 0,
  },
  round: {
    roundNumber: 1,
    volume: 0,
    currentBet: 0,
    foldedPlayers: [],
    allInPlayers: [],
  },
  dealerId: "",
  currentPlayerIndex: -1,
  winner: null,
  config: {
    maxRounds: null,
    startingChips: 200,
    smallBlind: 10,
    bigBlind: 20,
  },
};

export const PLAYER_DEFAULT_STATE: Omit<PlayerState, "id"> = {
  status: "PLAYING",
  hand: [],
  chips: 200,
  position: "BB", // will be set by the game-state-machine
  playedThisPhase: false,
  bet: { amount: 0, volume: 0 },
  playerName: "",
};
