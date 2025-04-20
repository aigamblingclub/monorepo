import { Console, Effect, pipe, Queue, Ref, Sink } from "effect";
import  * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { POKER_ROOM_DEFAULT_STATE } from "./state_machine";
import { currentPlayer, playersInRound, playerView, seatedPlayers } from "./queries";
import { addPlayer, processPlayerMove, removePlayer, startRound, transitionPhase } from "./transitions";
import type { GameEvent, PlayerView, PokerState, ProcessEventError, ProcessStateError, SystemEvent } from "./schemas";

export interface PokerGameService {
  readonly currentState: () => Effect.Effect<PokerState, never, never>

  readonly processEvent: (event: GameEvent) => Effect.Effect<PokerState, ProcessEventError, never>

  readonly playerView: (playerId: string) => Stream.Stream<
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
            if (state.status === 'PLAYING') {
                return Effect.fail<ProcessEventError>({ type: 'table_locked' })
            }
            switch (event.action) {
                case 'join': return Effect.succeed(addPlayer(state, event.playerId))
                case 'leave': return Effect.succeed(removePlayer(state, event.playerId))
            }
        }
        case 'move': {
            if (event.playerId !== currentPlayer(state).id) {
                return Effect.fail<ProcessEventError>({ type: 'not_your_turn' })
            }
            // TODO: turn state transitions into effects (validate moves)
            return Effect.succeed(processPlayerMove(state, event.move))
        }
        case 'start': {
            // TODO: sanity check for status?
            return Effect.succeed(startRound(state))
        }
        case 'transition_phase': {
            return Effect.succeed(transitionPhase(state))
        }
    }
}

// TODO: the point of having system events is that we could add debounce or throttling
// before emitting them, but maybe all of that should just be emulated on the frontend.
// TODO: make minPlayers part of the Effect's context? (i.e. dependency)
function processState(state: PokerState, minPlayers: number): Effect.Effect<Option.Option<SystemEvent>, ProcessStateError> {
    if (state.status === "WAITING" && seatedPlayers(state) >= minPlayers) {
        return Effect.succeed(Option.some({ type: 'start' }))
    }
    if (state.status === "PLAYING" && state.winningPlayerId) {
        // TODO: make effectful?
        console.log("winningPlayerId: ", state.winningPlayerId);
        // TODO: when we have player bets we need to emit an event here
        return Effect.succeed(Option.none());
    }
    // FIXME(?): make this state unrepresentable (refactor transitions)
    if (state.status === 'PLAYING' && playersInRound(state).length === 1) {
        return Effect.fail<ProcessStateError>({
            type: 'inconsistent_state',
            state,
            message: 'inconsistent state round is over but there are no remaining players'
        })
    }
    // FIXME: this logic should (probably) be inside the transitions
    if (
        state.status === "PLAYING" &&
        // this indicates that this phase is finished
        state.currentPlayerIndex === -1
    ) {
        return Effect.succeed(Option.some({ type: 'transition_phase' }))
    }
    return Effect.succeed(Option.none())
}

export const makePokerRoom = (minPlayers: number): Effect.Effect<PokerGameService, never, never> => Effect.gen(function* (_adapter) {
    const stateRef = yield* Ref.make(POKER_ROOM_DEFAULT_STATE)
    const stateUpdateQueue = yield* Queue.unbounded<PokerState>()
    const stateStream = Stream.fromQueue(stateUpdateQueue)

    const currentState = () => Ref.get(stateRef)

    function processEvent(event: GameEvent): Effect.Effect<PokerState, ProcessEventError, never> {
        return pipe(
            currentState(),
            Effect.flatMap(state => computeNextState(state, event)),
            Effect.tap(state => Ref.set(stateRef, state)),
            Effect.tap(stateUpdateQueue.offer),
        )
    }

    const stateProcessingStream: Stream.Stream<
        PokerState,
        ProcessStateError | ProcessEventError
    > = pipe(
        stateStream,
        Stream.mapEffect(state => pipe(
            processState(state, minPlayers),
            // Effect.flatMap(writeToDb)
            Effect.flatMap(Option.match({
                onNone: () => Effect.succeed(state),
                onSome: processEvent,
            })),
        )),
        Stream.tapError(Console.error),
    );

    // return this or put in a context somehow
    const _systemFiber = pipe(
        stateProcessingStream,
        Stream.run(Sink.drain),
        Effect.runFork,
    )

    const _debugFiber = pipe(
        currentState(),
        Effect.tap(Console.log),
        Effect.runFork
    )

    return {
        currentState,
        processEvent,
        playerView: playerId => pipe(
            stateProcessingStream,
            Stream.map(state => playerView(state, playerId))
        ),
        stateUpdates: stateStream,
    }
})
