import { BehaviorSubject, Subject } from "rxjs";
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
  // README: dealerIndex is relative to the players(state) ordering (lexicographical id)
  // and currentPlayerIndex to roundRotation(state) (first player in the round is index 0)
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

const players = (state: PokerState) => Object.values(state.players).sort()

export const seatedPlayers = (state: PokerState) =>
  Object.keys(state.players).length;

export const playingPlayers = (state: PokerState) =>
  players(state).filter((p) => p.status === "PLAYING");

export const playersInRound = (state: PokerState) =>
  players(state).filter(
    p => p.status === "PLAYING" || p.status === "FOLDED",
  );

export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

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

// state transition functions

// precondition: waiting for players | finished previous round
export function dealCards(state: PokerState): PokerState {
  const deck = getShuffledDeck();
  const dealtCards = deck.splice(0, 2 * seatedPlayers(state));

  return {
    ...state,
    status: "PLAYING",
    deck,
    community: [],
    burnt: [],
    currentPlayerIndex: 0,
    // TODO: use conjugateEntries
    players: Object.fromEntries(
      players(state).map((p, i) => [
        p.id,
        {
          ...p,
          hand: dealtCards.slice(2 * i, 2 * i + 2),
          status: "PLAYING",
          bet: 0,
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

export function startRound(current: PokerState): PokerState {
  const nextState = [dealCards, rotateBlinds, collectBlinds].reduce(
    (state, f) => f(state),
    current,
  )

  console.log('starting round', { nextState })
  return nextState
}

function shiftBetRotation(state: PokerState): PokerState {
  const players = roundRotation(state);
  // needs to be >= because current player might have folded and be the last
  const isLastPlayer = state.currentPlayerIndex >= players.findLastIndex((p) => p.status === "PLAYING");

  const allCalled = players.every(
    (p) => p.status === "FOLDED" || p.bet === state.bet,
  );

  const nextState = structuredClone(state)
  const playersLeft = players.filter(p => p.status === "PLAYING");
  if (playersLeft.length === 1) {
    nextState.winningPlayerId = playersLeft[0].id;
    nextState.currentPlayerIndex = -1
    return nextState
  }

  if (isLastPlayer && allCalled) {
    nextState.currentPlayerIndex = -1
    return nextState
  }

  const nextPlayerIndex = isLastPlayer && !allCalled
    ? players.findIndex((p) => p.status === "PLAYING") // rotates back to the beggining
    : players.findIndex(
      // find next player still in round
      (p, i) => p.status === "PLAYING" && state.currentPlayerIndex < i,
    );

  nextState.currentPlayerIndex = nextPlayerIndex

  return nextState;
}

function playerBet(state: PokerState, playerId: string, bet: number): PokerState {
  const player = state.players[playerId]
  const diff = Math.min(bet - player.bet, player.chips)
  const amount = player.bet + diff
  const remaining = player.chips - diff
  const raised = bet > state.bet

  return {
    ...state,
    pot: state.pot + diff,
    bet: Math.max(state.bet, amount),
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        bet: amount,
        chips: remaining,
        status: 'PLAYING'
      }
    },
  }
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
      nextState = playerBet(nextState, playerId, state.bet)
      break;
    }

    case "raise": {
      nextState = playerBet(nextState, playerId, move.amount)
      break;
    }
  }

  return shiftBetRotation(nextState);
}

// precondition: all players settled on a bet size
export function transitionPhase(state: PokerState): PokerState {
  if (state.winningPlayerId) {
    return dealCards(state)
  }

  let nextState = structuredClone(state);
  nextState.currentPlayerIndex = 0;
  nextState.bet = 0
  nextState.players = Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, { ...player, bet: 0 }]));

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
    case 3: {
      nextState.burnt.push(nextState.deck.pop()!);
      nextState.community.push(nextState.deck.pop()!);
      break;
    }
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
      const winningPlayer = players[winningPlayerIndex]

      nextState.winningPlayerId = winningPlayer.id;
      nextState.players[winningPlayer.id].chips += state.pot;
    }
  }

  return nextState;
}

export type PlayerView = {
  // here because sometimes agents don't bother reading it further inside
  hand: Card[];
  tableStatus: TableStatus;
  currentPlayerId?: string;
  dealerId?: string;
  bigBlindId?: string;
  smallBlindId?: string;
  winningPlayerId?: string;
  community: Card[];
  burnt: Card[];
  pot: number;
  bet: number;
  player: PlayerState;
  opponents: { [id: string]: Pick<PlayerState, "status" | "chips" | "bet"> };
};

export class PokerRoomStateMachine {
  private subject = new BehaviorSubject<PokerState>(POKER_ROOM_DEFAULT_STATE);
  public state$ = this.subject.asObservable();

  private movesSubject = new Subject<Move>();
  public moves$ = this.movesSubject.asObservable();

  constructor(private minimumPlayers: number) {
    this.state$.subscribe((state) => {
      if (state.status === "WAITING" && seatedPlayers(state) >= this.minimumPlayers) {
        console.log('starting round...')
        this.subject.next(startRound(state))
        return;
      }

      if (state.status === "PLAYING" && playersInRound(state).length === 1) {
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

  get value() {
    return this.subject.value
  }

  addPlayer(id: string) {
    const state = this.subject.value;
    this.subject.next({
      ...state,
      players: {
        ...state.players,
        [id]: {
          ...PLAYER_DEFAULT_STATE,
          id: id,
        },
      },
    });
  }

  playerView(playerId: string): PlayerView {
    const state = this.subject.value
    return {
      hand: state.players[playerId]?.hand ?? [],
      community: state.community,
      tableStatus: state.status,
      dealerId: dealer(state)?.id,
      bigBlindId: bigBlind(state)?.id,
      smallBlindId: smallBlind(state)?.id,
      currentPlayerId: currentPlayer(state)?.id,
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
    };
  }

  currentPlayerId() {
    const state = this.value;
    return roundRotation(state)[state.currentPlayerIndex].id;
  }

  processPlayerMove(move: Move) {
    this.movesSubject.next(move);
    this.subject.next(processPlayerMove(this.value, move));
  }

  transitionPhase() {
    this.subject.next(transitionPhase(this.value));
  }
}
