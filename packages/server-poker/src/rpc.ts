import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import { GameEventSchema, PlayerViewSchema, PokerStateSchema, ProcessEventErrorSchema, ProcessingStateStreamErrorsSchema } from "poker-state-machine";

// FIXME: duplicated to work around type issues
export class RoomPokerRpc extends RpcGroup.make(
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
) {}
