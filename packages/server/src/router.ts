import { TRPCError } from "@trpc/server";
import { EventEmitter, on } from "events";
import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { PokerRoomStateMachine, seatedPlayers, type Move, type PlayerView, type PokerState } from "poker-state-machine";
import { observable } from '@trpc/server/observable';
import { pluck } from "rxjs";


const ROOM = new PokerRoomStateMachine();

type PokerRoomEvents = {
  'STATE': [PokerState]
  'MOVE': [Move]
}

type EventMap<T> = Record<keyof T, any[]>;
class IterableEventEmitter<T extends EventMap<T>> extends EventEmitter<T> {
  toIterable<TEventName extends keyof T & string>(
    eventName: TEventName,
    opts?: NonNullable<Parameters<typeof on>[2]>,
  ): AsyncIterable<T[TEventName]> {
    return on(this as any, eventName, opts) as any;
  }
}

const stateEmitter = new  IterableEventEmitter<Pick<PokerRoomEvents, 'STATE'>>();
ROOM.state$.subscribe(state => {
  stateEmitter.emit('STATE', state)
})

const moveEmitter = new IterableEventEmitter<Pick<PokerRoomEvents, 'MOVE'>>();
ROOM.moves$.subscribe(move => {
  moveEmitter.emit('MOVE', move)
})

export const pokerRouter = router({
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
    console.log(`added ${playerId} to the table, table now at ${seatedPlayers(ROOM.value)} players`)

    return { playerId };
  }),

  getState: publicProcedure
    // .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      return ROOM.value;
    }),

  move: publicProcedure
    .input(
      z.object({
        playerId: z.string(),
        // move schema from here and create type with infer
        move: z
          .object({
            type: z.enum(["call", "fold"]),
          })
          .or(
            z.object({
              type: z.literal("raise"),
              amount: z.number(),
            }),
          ),
      }),
    )
    .mutation(({ input }) => {
      const { playerId, move } = input;

      if (playerId !== ROOM.currentPlayerId()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "It's not your turn yet.",
        });
      }

      return ROOM.processPlayerMove(move);
    }),

  onPlayerView: publicProcedure.input(z.object({
    playerId: z.string()
  })).subscription((opts) => {
    return observable<PlayerView>((emit) => {
      ROOM.state$.subscribe(state => {
        emit.next(ROOM.playerView(opts.input.playerId))
      })
    })
  }),

  onMove: publicProcedure.subscription(() => {
    return observable<Move>((emit) => {
      console.log("onMove subscription")

      const onMove = (move: Move)=> {
        console.log("emitting", {move})
        emit.next(move)
      }

      moveEmitter.on('MOVE', onMove);

      return () => {
        moveEmitter.off('MOVE', onMove);
      };
    })
  }),

  // debugging purposes only, shouldn't be called by agents
  onStateChange: publicProcedure.subscription( () => {
    return observable<PokerState>((emit) => {
      console.log("onStateChange subscription")

      const onStateChange = (state: PokerState)=> {
        console.log("emitting", {state})
        emit.next(state)
      }

      stateEmitter.on('STATE', onStateChange);

      return () => {
        stateEmitter.off('STATE', onStateChange);
      };
    })
  })
});

export type PokerRouter = typeof pokerRouter;
