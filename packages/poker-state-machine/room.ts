import { Context, Effect, Option, Queue, Ref, Scope, Stream } from "effect";
import { POKER_ROOM_DEFAULT_STATE, type Move, type PokerState } from "./state_machine";
import { currentPlayer } from "./queries";
import { addPlayer, processPlayerMove, removePlayer } from "./transitions";

type TableAction = 'join' | 'leave'

export type PokerEvent =
  | { type: 'move', playerId: string, move: Move }
  | { type: 'table', playerId: string, action: TableAction }

export type ProcessEventError =
  | { type: 'not_your_turn' }
  | { type: 'table_locked' }

export interface PokerGameService {
  readonly processEvent: (event: PokerEvent) => Effect.Effect<unknown, ProcessEventError, never>
  readonly currentState: () => Effect.Effect<PokerState, never, never>
}

export class PokerGame extends Context.Tag('PokerGame')<PokerGame, PokerGameService>() {}

export const makePokerRoom = (minPlayers: number): Effect.Effect<PokerGameService, never, Scope.Scope> => Effect.gen(function* (_) {
  const stateRef = yield* Ref.make(POKER_ROOM_DEFAULT_STATE)

  return {
    processEvent(event: PokerEvent) {
      return stateRef.pipe(
        Ref.get,
        Effect.flatMap(state => {
          switch (event.type) {
            case 'table': {
              if (state.status === 'PLAYING') {
                return Effect.fail<ProcessEventError>({ type: 'table_locked' })
              }

              switch (event.action) {
                case 'join': return Ref.set(stateRef, addPlayer(state, event.playerId))
                case 'leave': return Ref.set(stateRef, removePlayer(state, event.playerId))
              }
            }

            case 'move': {
              if (event.playerId !== currentPlayer(state).id) {
                return Effect.fail<ProcessEventError>({ type: 'not_your_turn' })
              }
              // TODO: turn state transitions into effects (validate moves)
              return Ref.set(stateRef, processPlayerMove(state, event.move))
            }
          }
        }),
      )
    },

    currentState() {
      return Ref.get(stateRef)
    },
  }
})
