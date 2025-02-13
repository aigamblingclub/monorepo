import { BehaviorSubject } from "rxjs";
import {
  determineHandType,
  determineWinningHand,
  getShuffledDeck,
  type Card,
  type Deck,
} from "./poker";

// Indicates whether the player is playing the current round.
// NOTE: FOLDED is just a temporary marker so the length of our
// playersInRound doesn't change during the rotation, but as soon as
// the index needs to loop back to 0 we mark FOLDED players as OUT.
export type PlayerStatus = "PLAYING" | "FOLDED" | "OUT";

export type PlayerState = {
  id: string;
  status: PlayerStatus;
  hand: Card[];
  chips: number;
  bet: number;
};

// Indicates whether we are still waiting for the minimum amount of players to start
export type TableStatus = "WAITING" | "PLAYING";

export type PokerState = {
  status: TableStatus;
  players: { [userId: string]: PlayerState };
  deck: Deck;
  community: Card[];
  burnt: Card[];
  pot: number;
  bet: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  winningPlayerId?: string;
};

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
};

export const PLAYER_DEFAULT_STATE: Omit<PlayerState, "id"> = {
  status: "OUT",
  hand: [],
  chips: 100,
  bet: 0,
};

export type Move =
  | { type: "fold" }
  | { type: "call" }
  | { type: "raise"; amount: number };

// queries
export const seatedPlayers = (state: PokerState) =>
  Object.keys(state.players).length;

export const playingPlayers = (state: PokerState) =>
  Object.values(state.players).filter((p) => p.status === "PLAYING");

export const playersInRound = (state: PokerState) =>
  Object.values(state.players).filter(
    (p) => p.status === "PLAYING" || p.status === "FOLDED",
  );

export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

export const dealer = (state: PokerState) =>
  playersInRound(state)[state.dealerIndex];

export const bigBlind = (state: PokerState) => {
  const players = roundRotation(state);
  return players[(state.dealerIndex + 1) % players.length];
};

export const smallBlind = (state: PokerState) => {
  const players = roundRotation(state);
  return players[(state.dealerIndex + 2) % players.length];
};

function rotated<T>(array: T[], count: number): T[] {
  const length = array.length;
  return Array.from({ length }).map((_, i) => array[(i + count) % length]);
}

export const firstPlayerIndex = (state: PokerState) => {
  const players = playersInRound(state).length;
  const preflop = state.burnt.length === 0;
  return players === 2 && preflop
    ? state.dealerIndex
    : (state.dealerIndex + 1) % players;
};

export const firstPlayer = (state: PokerState) => {
  const players = playersInRound(state);
  const index = firstPlayerIndex(state);
  return players[index];
};

export const roundRotation = (state: PokerState) => {
  const players = playersInRound(state);
  const index = firstPlayerIndex(state);
  return rotated(players, index);
};

// state transition functions

// precondition: waiting for players | finished previous round
export function dealCards(state: PokerState): PokerState {
  const deck = getShuffledDeck();
  const playing = playingPlayers(state).length;
  const dealtCards = deck.splice(0, 2 * playing);
  return {
    ...state,
    status: "PLAYING",
    deck,
    // TODO: use conjugateEntries
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, p], i) => [
        id,
        {
          ...p,
          hand: dealtCards.slice(2 * i, 2 * i + 1),
          status: "PLAYING",
        },
      ]),
    ),
  };
}

// precondition: waiting for players | finished previous round
export function rotateBlinds(state: PokerState): PokerState {
  const players = playersInRound(state).length;
  return {
    ...state,
    dealerIndex: (state.dealerIndex + 1) % players,
    currentPlayerIndex: (state.dealerIndex + (players === 2 ? 1 : 2)) % players,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, p]) => [
        id,
        p.status === "FOLDED" ? { ...p, status: "PLAYING" } : p,
      ]),
    ),
  };
}

// precondition: cards are dealt
export function collectBlinds(state: PokerState): PokerState {
  const bigBlindId = bigBlind(state).id;
  const bigBlindPlayer = state.players[bigBlindId];
  const bigBlindAmount = Math.min(BIG_BLIND, bigBlindPlayer.chips);

  const smallBlindId = smallBlind(state).id;
  const smallBlindPlayer = state.players[smallBlindId];
  const smallBlindAmount = Math.min(SMALL_BLIND, smallBlindPlayer.chips);

  return {
    ...state,
    pot: state.pot + bigBlindAmount + smallBlindAmount,
    bet: Math.max(bigBlindAmount, smallBlindAmount),
    players: {
      ...state.players,
      [bigBlindId]: {
        ...bigBlindPlayer,
        chips: bigBlindPlayer.chips - bigBlindAmount,
        bet: bigBlindAmount,
      },
      [smallBlindId]: {
        ...smallBlindPlayer,
        chips: smallBlindPlayer.chips - smallBlindAmount,
        bet: smallBlindAmount,
      },
    },
  };
}

function shiftBetRotation(state: PokerState): PokerState {
  const players = roundRotation(state);
  console.log(players.map((p) => p.id));

  // needs to be >= because player might have folded
  const isLastPlayer =
    state.currentPlayerIndex >=
    players.findLastIndex((p) => p.status === "PLAYING");

  const allCalled = players.every(
    (p) => p.status === "FOLDED" || p.bet === state.bet,
  );

  const nextPlayerIndex =
    isLastPlayer && allCalled
      ? -1 // transition to next phase
      : isLastPlayer && !allCalled
        ? players.findIndex((p) => p.status === "PLAYING") // rotates back to the beggining
        : players.findIndex(
            // find next player still in round
            (p, i) => p.status === "PLAYING" && state.currentPlayerIndex < i,
          );

  console.log("shiftBetRotation", {
    bets: players.map((p) => p.bet),
    bet: state.bet,
    cur: state.currentPlayerIndex,
    next: nextPlayerIndex,
    // nextBet: players[nextPlayerIndex].bet,
    isLastPlayer,
    allCalled,
  });

  return {
    ...state,
    currentPlayerIndex: nextPlayerIndex,
  };
}

export function processPlayerMove(state: PokerState, move: Move): PokerState {
  const players = roundRotation(state);
  const playerId = players[state.currentPlayerIndex].id;

  let nextState = structuredClone(state);
  switch (move.type) {
    case "fold": {
      // TODO: check if the player already has enough bet
      nextState.players[playerId].status = "FOLDED";
      break;
    }

    case "call": {
      const player = state.players[playerId];
      const diff = Math.min(state.bet - player.bet, player.chips);

      nextState.players[playerId].chips -= diff;
      nextState.players[playerId].bet = state.bet;
      nextState.pot += diff;
      break;
    }

    case "raise": {
      const player = state.players[playerId];
      const amount = Math.min(player.chips + player.bet, move.amount);
      const diff = Math.min(amount - player.bet, player.chips);

      nextState.players[playerId].chips -= diff;
      nextState.players[playerId].bet = amount;
      nextState.pot += diff;
      nextState.bet = amount;
    }
  }

  return shiftBetRotation(nextState);
}

// precondition: all players settled on a bet size
export function transitionPhase(state: PokerState): PokerState {
  let nextState = structuredClone(state);
  nextState.currentPlayerIndex = playersInRound(state).length === 2 ? 1 : 0;

  switch (state.community.length) {
    // deal flop
    case 0: {
      // TODO: what to do about invalid states? (i.e. has burnt but no community)
      nextState.burnt = [nextState.deck.pop()!];
      nextState.community = [
        nextState.deck.pop()!,
        nextState.deck.pop()!,
        nextState.deck.pop()!,
      ];
      break;
    }

    // deal turn
    case 3:
    // deal river
    case 4: {
      nextState.burnt.push(nextState.deck.pop()!);
      nextState.community.push(nextState.deck.pop()!);
      break;
    }
    // showdown
    case 5: {
      const players = playingPlayers(state);
      const playerHands = players.map((p) => [...p.hand, ...state.community]);
      const playerHandTypes = playerHands.map((h) => determineHandType(h));
      const winningHand = determineWinningHand(playerHandTypes);

      const winningPlayerIndex = playerHandTypes.findIndex(
        (t) => t === winningHand,
      );
      nextState.winningPlayerId = players[winningPlayerIndex].id;
    }
  }

  return nextState;
}

export type PlayerView = {
  tableStatus: TableStatus;
  dealerId: string;
  bigBlindId: string;
  smallBlindId: string;
  community: Card[];
  burnt: Card[];
  pot: number;
  bet: number;
  player: PlayerState;
  opponents: { [id: string]: Pick<PlayerState, "status" | "chips"> };
};

export class PokerRoomStateMachine {
  private subject = new BehaviorSubject<PokerState>(POKER_ROOM_DEFAULT_STATE);
  public state$ = this.subject.asObservable();
  public value = this.subject.value;

  constructor() {
    this.state$.subscribe((state) => {
      this.value = state;
      if (state.status === "WAITING" && seatedPlayers(state) >= 2) {
        this.startRound();
        return;
      }

      if (playersInRound(state).length === 1) {
        // the remaining player wins
        console.log("winningPlayerId: ", state.winningPlayerId);
        return;
      }

      if (
        state.status === "PLAYING" &&
        // this indicates that this phase is finished
        state.currentPlayerIndex === -1
      ) {
        this.transitionPhase();
      }
    });
  }

  addPlayer(id: string) {
    const { value } = this;
    this.subject.next({
      ...value,
      players: {
        ...value.players,
        [id]: {
          ...PLAYER_DEFAULT_STATE,
          id: id,
        },
      },
    });
  }

  startRound() {
    const nextState = [dealCards, rotateBlinds, collectBlinds].reduce(
      (state, f) => f(state),
      this.value,
    );
    this.subject.next(nextState);
  }

  playerView(playerId: string): PlayerView {
    const state = this.value;
    return {
      tableStatus: state.status,
      dealerId: dealer(state).id,
      bigBlindId: bigBlind(state).id,
      smallBlindId: smallBlind(state).id,
      community: state.community,
      burnt: state.burnt,
      pot: state.pot,
      bet: state.bet,
      player: state.players[playerId],
      opponents: Object.fromEntries(
        Object.entries(state.players)
          .filter(([id, _]) => id != playerId)
          .map(([id, { status, chips }]) => [id, { status, chips }]),
      ),
    };
  }

  currentPlayerId() {
    const state = this.value;
    return roundRotation(state)[state.currentPlayerIndex].id;
  }

  processPlayerMove(move: Move) {
    this.subject.next(processPlayerMove(this.value, move));
  }

  transitionPhase() {
    this.subject.next(transitionPhase(this.value));
  }
}
