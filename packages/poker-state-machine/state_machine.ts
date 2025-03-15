import { BehaviorSubject, Subject } from "rxjs";
import type { Card, Deck } from "./poker";
import { dealer, bigBlind, currentPlayer,playersInRound, roundRotation, seatedPlayers, smallBlind } from "./queries";
import { addPlayer, processPlayerMove, startRound, transitionPhase } from "./transitions";

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

export type TableEvent =
  | { type: 'join', playerId: string }
  | { type: 'leave', playerId: string };

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

  private tableEventsSubject = new Subject<TableEvent>();
  public tableEvents$ = this.tableEventsSubject.asObservable();

  constructor(private minimumPlayers: number) {
    this.state$.subscribe((state) => {
      // TODO: add a delay to start round
      if (state.status === "WAITING" && seatedPlayers(state) >= this.minimumPlayers) {
        this.startRound();
        return;
      }

      if (state.status === "PLAYING" && state.winningPlayerId) {
        console.log("winningPlayerId: ", state.winningPlayerId);
        return;
      }

      // TODO: handle error
      if (state.status === 'PLAYING' && playersInRound(state).length === 1) {
        throw 'inconsistent state round is over but there are no remaining players'
      }

      if (
        state.status === "PLAYING" &&
        // this indicates that this phase is finished
        state.currentPlayerIndex === -1
      ) {
        this.transitionPhase();
        return;
      }
    });
  }

  get value() {
    return this.subject.value
  }

  // TODO: implement leave table as well
  addPlayer(id: string) {
    const state = this.subject.value;
    this.tableEventsSubject.next({ type: 'join', playerId: id });
    this.subject.next(addPlayer(state, id));
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
    return currentPlayer(state)?.id!;
  }

  startRound() {
    console.log('starting round...')
    this.subject.next(startRound(this.value));
  }

  processPlayerMove(move: Move) {
    this.movesSubject.next(move);
    this.subject.next(processPlayerMove(this.value, move));
  }

  transitionPhase() {
    this.subject.next(transitionPhase(this.value));
  }
}
