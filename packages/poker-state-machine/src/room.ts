import { Console, Effect, pipe, Queue, Ref, Sink, Logger, LogLevel } from "effect";
import  * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { POKER_ROOM_DEFAULT_STATE } from "./state_machine";
import { currentPlayer, playerView } from "./queries";
import { addPlayer, processPlayerMove, removePlayer, startRound, transition, nextRound, endGame } from "./transitions";
import type { GameEvent, PlayerView, PokerState, ProcessEventError, ProcessStateError, SystemEvent } from "./schemas";

export interface PokerGameService {
  readonly currentState: () => Effect.Effect<PokerState, never, never>

  readonly processEvent: (event: GameEvent) => Effect.Effect<PokerState, ProcessEventError, never>

  readonly playerView: (playerId: string) => Effect.Effect<
      PlayerView,
      ProcessEventError | ProcessStateError,
      never
  >

  readonly stateUpdates: Stream.Stream<
      PokerState,
      ProcessEventError | ProcessStateError,
      never
  >
}

function computeNextState(
    state: PokerState,
    event: GameEvent,
): Effect.Effect<PokerState, ProcessEventError, never> {
    switch (event.type) {
        case 'table': {
            if (state.tableStatus === 'PLAYING') {
                return Effect.fail<ProcessEventError>({ type: 'table_locked' })
            }
            switch (event.action) {
                case 'join': return Effect.succeed({...addPlayer(state, event.playerId, event.playerName), lastMove: null})
                case 'leave': return Effect.succeed({...removePlayer(state, event.playerId), lastMove: null})
            }
        }
        case 'move': {
            if (event.playerId !== currentPlayer(state).id) {
                return Effect.fail<ProcessEventError>({ type: 'not_your_turn' })
            }
            // Store the move event
            return processPlayerMove(state, event.move).pipe(
                Effect.map(newState => ({
                    ...newState,
                    lastMove: event
                }))
            )
        }
        case 'start': {
            // console.log('computeNextState', { event })
            const next = startRound(state)
            return Effect.succeed({...next})
            // TODO: sanity check for status?
            // return Effect.succeed(startRound(state))
        }
        case 'transition_phase': {
            return transition(state)
        }
        case 'next_round': {
            return nextRound(state).pipe(
                Effect.map(newState => ({
                    ...newState,
                }))
            )
        }
        case 'end_game': {
            return endGame(state).pipe(
                Effect.map(newState => ({
                    ...newState,
                    //lastMove: null
                }))
            )
        }
    }
}

// TODO: the point of having system events is that we could add debounce or throttling
// before emitting them, but maybe all of that should just be emulated on the frontend.
// TODO: make minPlayers part of the Effect's context? (i.e. dependency)
function processState(state: PokerState, minPlayers: number): Effect.Effect<Option.Option<SystemEvent>, ProcessStateError> {
    if (state.tableStatus === "WAITING" && state.players.length >= minPlayers) {
        // TODO: add debounce here somehow
        // actually we can't add the debounce here because that would just stall
        // everything and not actually allow anyone else to join the table
        // the correct way is to make this system event trigger a fork which will
        // wait for a certain amount of time and then emit the new state, tricky though
        return Effect.succeed(Option.some({ type: 'start' }))
    }
    if (state.tableStatus === "ROUND_OVER") {
        return Effect.succeed(Option.some({ type: 'next_round' }))
    }
    return Effect.succeed(Option.none())
}

export const makePokerRoom = (minPlayers: number, logLevel: LogLevel.LogLevel): Effect.Effect<PokerGameService, never, never> => Effect.gen(function* (_adapter) {
    const stateRef = yield* Ref.make({...POKER_ROOM_DEFAULT_STATE, tableId: "table-id"}) // TODO: get from adapter (db)
    const stateUpdateQueue = yield* Queue.unbounded<PokerState>()
    const stateStream = Stream.fromQueue(stateUpdateQueue).pipe(
        Stream.tap(() => Effect.logDebug('state stream received update'))
    )
    

    const currentState = () => Ref.get(stateRef)

    const processEvent = (event: GameEvent): Effect.Effect<PokerState, ProcessEventError, never> => {
        return pipe(
          currentState(),
          Effect.tap(({ deck, ...state }) =>
            Effect.whenLogLevel(
              Effect.logDebug("processing event", { event, state }),
              LogLevel.Debug
            )
          ),
          Effect.flatMap((state) => computeNextState(state, event)),
          Effect.tap(({ deck, ...state }) =>
            Effect.logDebug(
              Effect.logInfo("post-processing", { event, state }),
              LogLevel.Debug
            )
          ),
          Effect.tap((state) => Ref.set(stateRef, state)),
          Effect.tap((state) => stateUpdateQueue.offer(state)),
          Logger.withMinimumLogLevel(logLevel)
        );
    }

    const stateProcessingStream: Stream.Stream<
        PokerState,
        ProcessStateError | ProcessEventError
    > = pipe(
        stateStream,
        Stream.mapEffect(state => pipe(
            processState(state, minPlayers),
            Effect.flatMap(Option.match({
                onNone: () => Effect.succeed(state),
                onSome: event => {
                    const next = processEvent(event)
                    return next
                },
            }),
            ))),
        // Stream.tap(({ deck, ...state }) => Effect.whenLogLevel(Effect.logInfo('after processing', { state }), LogLevel.Info)),
        Stream.tapError(error => Effect.whenLogLevel(Effect.logError('error in state processing', error), LogLevel.Error)),
    );

    // return this or put in a context somehow
    const _systemFiber = pipe(
        stateProcessingStream,
        Stream.run(Sink.drain),
        Effect.runFork,
    )

    return {
        currentState: () => pipe(
            currentState(),
            // Effect.tap(({ deck, ...state }) => Effect.whenLogLevel(Effect.logInfo('[currentState]', { state }), LogLevel.Info)),
        ),
        processEvent,
        playerView: playerId => pipe(
            currentState(),
            Effect.map(state => playerView(state, playerId)),
            // Effect.tap(pv => Effect.whenLogLevel(Effect.logInfo('[playerView]', { pv }), LogLevel.Info))
        ),
        stateUpdates: stateProcessingStream,
    }
})

// Version with disabled logging for tests
export const makePokerRoomForTests = (minPlayers: number): Effect.Effect<PokerGameService, never, never> => {
    return makePokerRoom(minPlayers, LogLevel.None)
}
