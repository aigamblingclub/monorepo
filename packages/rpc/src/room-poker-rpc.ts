import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import {
  ProcessingStateStreamErrorsSchema,
  GameEventSchema,
  PlayerViewSchema,
  PokerStateSchema,
  ProcessEventErrorSchema,
} from "poker-state-machine";

export const RoomPokerRpc = RpcGroup.make(
  Rpc.make("currentState", {
    success: PokerStateSchema,
    payload: { roomId: Schema.String },
  }),
  Rpc.make("processEvent", {
    success: PokerStateSchema,
    error: ProcessEventErrorSchema,
    payload: { 
      roomId: Schema.String,
      event: GameEventSchema 
    },
  }),
  Rpc.make("playerView", {
    success: PlayerViewSchema,
    error: ProcessingStateStreamErrorsSchema,
    payload: { 
      roomId: Schema.String,
      playerId: Schema.String 
    },
  }),
  Rpc.make("stateUpdates", {
    success: PokerStateSchema,
    error: ProcessingStateStreamErrorsSchema,
    payload: { roomId: Schema.String },
    stream: true,
  }),
  Rpc.make("startGame", {
    success: PokerStateSchema,
    error: ProcessingStateStreamErrorsSchema,
    payload: { roomId: Schema.String },
  })
)