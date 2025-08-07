import { Rpc, RpcGroup } from "@effect/rpc";
import { Effect, LogLevel, Schema } from "effect";
import { makePokerRoom } from "poker-state-machine";
import {
  ProcessingStateStreamErrorsSchema,
  GameEventSchema,
  PlayerViewSchema,
  PokerStateSchema,
  ProcessEventErrorSchema,
} from "poker-state-machine";

export class PokerRpc extends RpcGroup.make(
  Rpc.make("currentState", {
    success: PokerStateSchema,
  }),
  Rpc.make("processEvent", {
    success: PokerStateSchema,
    error: ProcessEventErrorSchema,
    payload: { event: GameEventSchema },
  }),
  Rpc.make("playerView", {
    success: PlayerViewSchema,
    error: ProcessingStateStreamErrorsSchema,
    payload: { playerId: Schema.String },
    // stream: true
  }),
  Rpc.make("stateUpdates", {
    success: PokerStateSchema,
    error: ProcessingStateStreamErrorsSchema,
    stream: true,
  }),
  Rpc.make("startGame", {
    success: PokerStateSchema,
    error: ProcessingStateStreamErrorsSchema,
  })
) {}

export const PokerRpcLive = PokerRpc.toLayer(
  Effect.gen(function* () {
    const minPlayers = process.env.MIN_PLAYERS
      ? Number(process.env.MIN_PLAYERS)
      : 2;
      
    const logLevel =
      process.env.LOG_LEVEL === "debug" ? LogLevel.Debug : LogLevel.Info;

    const ROOM = yield* makePokerRoom(minPlayers, logLevel);

    return {
      currentState: (_payload, _headers) => {
        return ROOM.currentState();
      },
      processEvent: (payload, _headers) => {
        return ROOM.processEvent(payload.event);
      },
      playerView: (payload, _headers) => {
        return ROOM.playerView(payload.playerId);
      },
      stateUpdates: (_payload, _headers) => {
        return ROOM.stateUpdates
      },
      startGame: (_payload, _headers) => {
        return ROOM.startGame();
      },
    };
  })
);
