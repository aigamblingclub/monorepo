import { z } from "zod";
import { getShuffledDeck, type Card, type Deck } from "./poker";
import { publicProcedure, router } from "./trpc";
import { TRPCError } from "@trpc/server";
import { BehaviorSubject } from "rxjs";

type PlayerStatus = "PLAYING" | "OUT";

type PlayerState = {
  id: string;
  status: PlayerStatus;
  hand: Card[];
  chips: number;
};

type TableStatus = "WAITING" | "PLAYING";

type PokerState = {
  status: TableStatus;
  players: { [userId: string]: PlayerState };
  deck: Deck;
  pot: number;
  bigBlindIndex: number;
  smallBlindIndex: number;
  currentPlayerIndex: number;
};

const dealCard = (deck: Deck) => deck.pop()!;

const seatedPlayers = (state: PokerState) => Object.keys(state.players).length;
const playingPlayers = (state: PokerState) =>
  Object.values(state.players).filter((p) => p.status === "PLAYING");

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const smallBlind = (state: PokerState) =>
  playingPlayers(state)[state.smallBlindIndex!];
const bigBlind = (state: PokerState) =>
  playingPlayers(state)[state.bigBlindIndex!];

function dealCards(state: PokerState): PokerState {
  const deck = getShuffledDeck();
  const playing = playingPlayers(state).length;
  const dealtCards = deck.splice(0, 2 * playing);
  return {
    ...state,
    deck,
    players: Object.fromEntries(
      Object.entries(state.players).map((p, i) => ({
        ...p,
        hand: dealtCards.slice(2 * i, 2 * i + 1),
        status: "PLAYING",
      })),
    ),
  };
}

function rotateBlinds(state: PokerState): PokerState {
  return {
    ...state,
    bigBlindIndex: (state.bigBlindIndex + 1) % playingPlayers(state).length,
    smallBlindIndex: (state.smallBlindIndex + 1) % playingPlayers(state).length,
    currentPlayerIndex:
      (state.currentPlayerIndex + 1) % playingPlayers(state).length,
  };
}

function collectBlinds(state: PokerState): PokerState {
  const bigBlindId = playingPlayers(state)[state.bigBlindIndex].id;
  const bigBlindPlayer = state.players[bigBlindId];
  const bigBlind = Math.min(BIG_BLIND, bigBlindPlayer.chips);

  const smallBlindId = playingPlayers(state)[state.bigBlindIndex].id;
  const smallBlindPlayer = state.players[smallBlindId];
  const smallBlind = Math.min(SMALL_BLIND, smallBlindPlayer.chips);

  return {
    ...state,
    pot: state.pot + bigBlind + smallBlind,
    players: {
      ...state.players,
      [bigBlindId]: {
        ...bigBlindPlayer,
        chips: bigBlindPlayer.chips - bigBlind,
      },
      [smallBlindId]: {
        ...smallBlindPlayer,
        chips: smallBlindPlayer.chips - smallBlind,
      },
    },
  };
}

class PokerRoomState {
  private subject = new BehaviorSubject<PokerState>({
    status: "WAITING",
    players: {},
    deck: [],
    pot: 0,
    bigBlindIndex: -1,
    smallBlindIndex: -1,
    currentPlayerIndex: -1,
  });
  public state$ = this.subject.asObservable();
  public value = this.subject.value;

  constructor() {
    this.state$.subscribe((state) => {
      if (seatedPlayers(state) >= 2) {
        this.startRound();
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
          id: id,
          status: "OUT",
          hand: [],
          chips: 100,
        },
      },
    });
  }

  startRound() {
    this.subject.next(collectBlinds(rotateBlinds(dealCards(this.value))));
  }
}

const ROOM = new PokerRoomState();
const pokerRouter = router({
  joinTable: publicProcedure.mutation(async () => {
    if (seatedPlayers(ROOM.value) >= 8) {
      console.log("Player tried to join full table.");
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Table currently full, cannot join.",
      });
    }

    const playerId = Bun.randomUUIDv7();
    ROOM.addPlayer(playerId);

    return { playerId };
  }),

  getState: publicProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const { playerId } = input;
      const state = ROOM.value;
      const player = state.players[playerId];
      return {
        tableStatus: state.status,
        bigBlind: bigBlind(state),
        smallBlind: smallBlind(state),
        player,
        opponents: Object.fromEntries(
          Object.entries(state.players)
            .filter(([id, p]) => p.status == "PLAYING" && id != playerId)
            .map(([id, { chips }]) => [id, { chips }]),
        ),
      };
    }),
});
