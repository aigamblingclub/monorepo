import { useState, useEffect } from 'react';
import { getPokerRoomClient, type PokerRoomClient } from "client";
import { POKER_ROOM_DEFAULT_STATE } from "poker-state-machine";
import { currentPlayer } from 'poker-state-machine/queries';
import { Console, Duration, Effect, Fiber, Schedule, Stream } from 'effect';
import type { Move, PokerState } from 'poker-state-machine/schemas';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const random = (length: number) => Math.floor(Math.random() * length)

// TODO: convert to effect
async function ticks(client: PokerRoomClient, step: number, state: PokerState) {
  let moves: Move[] = [
    {
      type: 'raise',
      amount: 30,
    },
    { type: 'call' },
    { type: 'call' },
    { type: 'call' },
    {
      type: 'raise',
      amount: 40,
    },
    { type: 'call' },
    { type: 'fold' },
  ]

  switch (step) {
    case 0: {
      await client.joinTable.mutate()
      return;
    }
    case 1: {
      await client.joinTable.mutate()
      return;
    }
    default: {
      const move = moves[step - 2] ?? { type: 'fold' }
      await client.move.mutate({
        playerId: currentPlayer(state).id,
        move
      })
      return;
    }
  }
}

export function useForkEffect<A, E>(effect: Effect.Effect<A, E, never>) {
  useEffect(() => {
    const fiber = Effect.runFork(effect)
    return () => {
      Effect.runPromise(Fiber.interrupt(fiber))
    }
  }, [])
}

function counter() {
  let count = 0
  return Effect.sync(() => count++)
}

export function usePokerState(wsUrl: string) {
  const [state, setState] = useState<PokerState>(POKER_ROOM_DEFAULT_STATE);

  useEffect(() => {
    const client = getPokerRoomClient(wsUrl)
    const subscription = client.onStateChange.subscribe(undefined, {
      onData(data) {
        setState(data)
      }
    });

    const repeat = Effect.repeat(
      counter().pipe(
        Effect.flatMap(step => Effect.promise(async () => ({
          step,
          state: await client.getState.query()
        }))),
        Effect.tap(({ step, state }) => Console.log({ step, state })),
        Effect.map(({ step, state }) => ticks(client, step, state))
      ),
      Schedule.spaced(Duration.seconds(3))
    )
    // refactor fiber out of here
    const fiber = Effect.runFork(repeat)

    return () => {
      subscription.unsubscribe();
      Effect.runPromise(Fiber.interrupt(fiber))
    };
  }, []);

  return state;
}
