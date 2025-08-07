import {
  Console,
  Effect,
  pipe,
  Queue,
  Ref,
  Sink,
  Logger,
  LogLevel,
} from "effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { POKER_ROOM_DEFAULT_STATE } from "./state_machine";
import { currentPlayer, playerView } from "./queries";
import {
  addPlayer,
  processPlayerMove,
  removePlayer,
  startRound,
  transition,
  nextRound,
  endGame,
} from "./transitions";
import type {
  GameEvent,
  PlayerView,
  PokerState,
  ProcessEventError,
  ProcessStateError,
  SystemEvent,
} from "./schemas";

export interface PokerGameService {
  readonly currentState: () => Effect.Effect<PokerState, never, never>;

  readonly processEvent: (
    event: GameEvent
  ) => Effect.Effect<PokerState, ProcessEventError, never>;

  readonly playerView: (
    playerId: string
  ) => Effect.Effect<PlayerView, ProcessEventError | ProcessStateError, never>;

  readonly stateUpdates: Stream.Stream<
    PokerState,
    ProcessEventError | ProcessStateError,
    never
  >;

  readonly startGame: () => Effect.Effect<PokerState, ProcessEventError, never>;
}

function computeNextState(
  state: PokerState,
  event: GameEvent
): Effect.Effect<PokerState, ProcessEventError, never> {
  switch (event.type) {
    case "table": {
      const playerPlaying = state.players.find((p) => p.id === event.playerId);
      if (playerPlaying) {
        return Effect.succeed<PokerState>({ ...state });
      }
      if (state.tableStatus === "PLAYING") {
        return Effect.fail<ProcessEventError>({ type: "table_locked" });
      }
      switch (event.action) {
        case "join":
          return Effect.succeed<PokerState>({
            ...addPlayer(state, event.playerId, event.playerName),
            lastMove: null,
          });
        case "leave":
          return Effect.succeed<PokerState>({
            ...removePlayer(state, event.playerId),
            lastMove: null,
          });
      }
    }
    case "move": {
      // sleep for 1 second
      // const sleep = setTimeout(() => {
      //   console.log("sleeping");
      // }, 5000);
      const current = currentPlayer(state);
      if (!current) {
        return Effect.fail<ProcessEventError>({ type: "not_your_turn" });
      }
      if (event.playerId !== current.id) {
        return Effect.fail<ProcessEventError>({ type: "not_your_turn" });
      }
      // Store the move event
      return processPlayerMove(state, event.move).pipe(
        Effect.map((newState) => ({
          ...newState,
          lastMove: event,
        }))
      );
    }
    case "start": {
      if (state.tableStatus !== "WAITING") {
        return Effect.fail<ProcessEventError>({
          type: "inconsistent_state",
          message: "table is not waiting",
        });
      }
      if (state.players.length < 2) {
        return Effect.fail<ProcessEventError>({ type: "insufficient_players" });
      }
      const next = startRound(state);
      return Effect.succeed<PokerState>({ ...next });
    }
    case "transition_phase": {
      // not used
      return transition(state);
    }
    case "next_round": {
      return nextRound(state).pipe(
        Effect.map((newState) => ({
          ...newState,
        }))
      );
    }
    case "end_game": {
      return endGame(state).pipe(
        Effect.map((newState) => ({
          ...newState,
        }))
      );
    }
    case "auto_restart": {
      // Reset the game state to initial values, but with new tableId and same players
      return Effect.succeed<PokerState>({
        ...POKER_ROOM_DEFAULT_STATE,
        tableId: createTableId(), // Generate new tableId for the new game
        tableStatus: "WAITING",
        players: state.players.map((p) => ({
          ...p,
          status: "PLAYING",
          hand: [],
          chips: state.config.startingChips,
          position: p.position,
          playedThisPhase: false,
          bet: { amount: 0, volume: 0 },
        })),
        config: state.config,
      });
    }
  }
}

// TODO: the point of having system events is that we could add debounce or throttling
// before emitting them, but maybe all of that should just be emulated on the frontend.
// TODO: make minPlayers part of the Effect's context? (i.e. dependency)
function processState(
  state: PokerState,
  minPlayers: number
): Effect.Effect<Option.Option<SystemEvent>, ProcessStateError> {
  if (
    state.tableStatus === "WAITING" &&
    state.players.length >= minPlayers &&
    process.env.AUTO_RESTART_ENABLED === "true"
  ) {
    // auto start / restart
    return Effect.succeed(Option.some({ type: "start" }));
  }
  if (state.tableStatus === "ROUND_OVER") {
    // Auto-advance to the next hand after a configurable delay for all tables.
    // Historically this happened only for heads-up games, but the test-suite
    // now expects it regardless of the number of players still in the game.

    const delay = process.env.ROUND_OVER_DELAY_MS
      ? parseInt(process.env.ROUND_OVER_DELAY_MS)
      : 50;

    if (delay <= 0) {
      return Effect.succeed(Option.some({ type: "next_round" }));
    }

    return Effect.gen(function* (_) {
      yield* Effect.sleep(delay);
      return Option.some({ type: "next_round" });
    });
  }
  if (state.tableStatus === "GAME_OVER") {
    // Get auto-restart delay from environment variable or use default (2 minutes)
    const autoRestartDelay = process.env.AUTO_RESTART_DELAY
      ? parseInt(process.env.AUTO_RESTART_DELAY)
      : 5000;

    return Effect.gen(function* (_) {
      yield* Effect.sleep(autoRestartDelay);
      return Option.some({ type: "auto_restart" }); // the state will be ready to start a new game
    });
  }
  return Effect.succeed(Option.none());
}

const createTableId = (): string => {
  return String(crypto.randomUUID());
};

export const makePokerRoom = (
  minPlayers: number,
  logLevel: LogLevel.LogLevel
): Effect.Effect<PokerGameService, never, never> =>
  Effect.gen(function* (_adapter) {
    const stateRef = yield* Ref.make({
      ...POKER_ROOM_DEFAULT_STATE,
      tableId: createTableId(),
    });

    const stateUpdateQueue = yield* Queue.unbounded<PokerState>();
    const stateStream = Stream.fromQueue(stateUpdateQueue).pipe(
      Stream.tap(() => Effect.logDebug("state stream received update"))
    );

    const currentState = () => Ref.get(stateRef);

    const processEvent = (
      event: GameEvent
    ): Effect.Effect<PokerState, ProcessEventError, never> => {
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
    };

    const stateProcessingStream: Stream.Stream<
      PokerState,
      ProcessStateError | ProcessEventError
    > = pipe(
      stateStream,
      Stream.mapEffect((state) =>
        pipe(
          processState(state, minPlayers),
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeed<PokerState>(state),
              onSome: (event) => {
                const next = processEvent(event);
                return next;
              },
            })
          )
        )
      ),
      // Stream.tap(({ deck, ...state }) => Effect.whenLogLevel(Effect.logInfo('after processing', { state }), LogLevel.Info)),
      Stream.tapError((error) =>
        Effect.whenLogLevel(
          Effect.logError("error in state processing", error),
          LogLevel.Error
        )
      )
    );

    const startGame = () => {
      const sleepTime = process.env.START_SLEEP_TIME
        ? parseInt(process.env.START_SLEEP_TIME)
        :  5_000;
      
      return pipe(
        Effect.logInfo("starting game, sleeping", { sleepTime }),
        Effect.flatMap(() => Effect.sleep(sleepTime)),
        Effect.tap(() => Effect.logInfo("done sleeping")),
        Effect.flatMap(() => currentState()),
        Effect.flatMap((state) => processEvent({ type: "start" })),
        Effect.tap(({ deck, ...state }) =>
          Effect.whenLogLevel(
            Effect.logInfo("post-processing", {
              event: { type: "start" },
              state,
            }),
            LogLevel.Debug
          )
        )
      );
    };
    // return this or put in a context somehow
    const _systemFiber = pipe(
      stateProcessingStream,
      Stream.run(Sink.drain),
      Effect.runFork
    );

    return {
      currentState: () =>
        pipe(
          currentState()
          // Effect.tap(({ deck, ...state }) => Effect.whenLogLevel(Effect.logInfo('[currentState]', { state }), LogLevel.Info)),
        ),
      processEvent,
      playerView: (playerId) =>
        pipe(
          currentState(),
          Effect.map((state) => playerView(state, playerId))
          // Effect.tap(pv => Effect.whenLogLevel(Effect.logInfo('[playerView]', { pv }), LogLevel.Info))
        ),
      stateUpdates: stateProcessingStream,
      startGame,
    };
  });

// Version with disabled logging for tests
export const makePokerRoomForTests = (
  minPlayers: number,
  testScenario?: string,
  startingChips?: number
): Effect.Effect<PokerGameService, never, never> => {
  if (process.env.ROUND_OVER_DELAY_MS === undefined) {
    // Zero delay makes unit tests deterministic and avoids race conditions
    process.env.ROUND_OVER_DELAY_MS = "0";
  }
  if (process.env.AUTO_RESTART_DELAY === undefined) {
    // Longer delay for tests to prevent auto-restart interfering with test validation
    process.env.AUTO_RESTART_DELAY = "30000"; // 30 seconds instead of 5
  }
  
  // CRITICAL: Only enable deterministic cards when EXPLICITLY requested with a scenario
  // AND when the environment is not already set to false by setupTestEnvironment
  if (testScenario && process.env.POKER_DETERMINISTIC_CARDS !== "false") {
    console.log(`🎯 Enabling deterministic cards for test scenario: ${testScenario}`);
    process.env.POKER_DETERMINISTIC_CARDS = "true";
    process.env.POKER_TEST_SCENARIO = testScenario;
  } else {
    // ALWAYS default to random cards to prevent infinite loops
    // This is the most important fix - ensuring we never inherit deterministic settings
    console.log(`🔀 Using random cards (deterministic=${process.env.POKER_DETERMINISTIC_CARDS})`);
    process.env.POKER_DETERMINISTIC_CARDS = "false";
    delete process.env.POKER_TEST_SCENARIO;
  }
  
  // Use 1000 chips as default for tests to match test expectations, unless explicitly overridden
  const testStartingChips = startingChips !== undefined ? startingChips : 1000;
  
  return Effect.gen(function* (_adapter) {
    // Create a test-specific initial state with correct starting chips
    const testInitialState = {
      ...POKER_ROOM_DEFAULT_STATE,
      tableId: createTableId(),
      config: {
        ...POKER_ROOM_DEFAULT_STATE.config,
        startingChips: testStartingChips,
      }
    };

    const stateRef = yield* Ref.make(testInitialState);

    const stateUpdateQueue = yield* Queue.unbounded<PokerState>();
    const stateStream = Stream.fromQueue(stateUpdateQueue).pipe(
      Stream.tap(() => Effect.logDebug("state stream received update"))
    );

    const currentState = () => Ref.get(stateRef);

    const processEvent = (
      event: GameEvent
    ): Effect.Effect<PokerState, ProcessEventError, never> => {
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
        Logger.withMinimumLogLevel(LogLevel.None)
      );
    };

    const stateProcessingStream: Stream.Stream<
      PokerState,
      ProcessStateError | ProcessEventError
    > = pipe(
      stateStream,
      Stream.mapEffect((state) =>
        pipe(
          processState(state, minPlayers),
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeed<PokerState>(state),
              onSome: (event) => {
                const next = processEvent(event);
                return next;
              },
            })
          )
        )
      ),
      // Stream.tap(({ deck, ...state }) => Effect.whenLogLevel(Effect.logInfo('after processing', { state }), LogLevel.Info)),
      Stream.tapError((error) =>
        Effect.whenLogLevel(
          Effect.logError("error in state processing", error),
          LogLevel.Error
        )
      )
    );

    const startGame = () => {
      const sleepTime = process.env.START_SLEEP_TIME
        ? parseInt(process.env.START_SLEEP_TIME)
        : 2 * 60 * 1000; // 2 * 60 * 1000 = 2 minutes DEFAULT

      return pipe(
        Effect.logInfo("starting game, sleeping", { sleepTime }),
        Effect.flatMap(() => Effect.sleep(sleepTime)),
        Effect.tap(() => Effect.logInfo("done sleeping")),
        Effect.flatMap(() => currentState()),
        Effect.flatMap((state) => processEvent({ type: "start" })),
        Effect.tap(({ deck, ...state }) =>
          Effect.whenLogLevel(
            Effect.logInfo("post-processing", {
              event: { type: "start" },
              state,
            }),
            LogLevel.Debug
          )
        )
      );
    };
    // return this or put in a context somehow
    const _systemFiber = pipe(
      stateProcessingStream,
      Stream.run(Sink.drain),
      Effect.runFork
    );

    return {
      currentState: () =>
        pipe(
          currentState()
          // Effect.tap(({ deck, ...state }) => Effect.whenLogLevel(Effect.logInfo('[currentState]', { state }), LogLevel.Info)),
        ),
      processEvent,
      playerView: (playerId) =>
        pipe(
          currentState(),
          Effect.map((state) => playerView(state, playerId))
          // Effect.tap(pv => Effect.whenLogLevel(Effect.logInfo('[playerView]', { pv }), LogLevel.Info))
        ),
      stateUpdates: stateProcessingStream,
      startGame,
    };
  });
};


