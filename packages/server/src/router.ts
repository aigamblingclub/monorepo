import { makePokerRoom } from "poker-state-machine";
import { ErrorsSchema, GameEventSchema, PlayerViewSchema, PokerStateSchema, ProcessEventErrorSchema } from "poker-state-machine/schemas";
import { Rpc, RpcGroup, } from "@effect/rpc";
import { Effect, pipe, Schema } from "effect";


export class PokerRpc extends RpcGroup.make(
    Rpc.make('currentState', {
        success: PokerStateSchema
    }),
    Rpc.make('processEvent', {
        success: PokerStateSchema,
        error: ProcessEventErrorSchema,
        payload: { event: GameEventSchema },
    }),
    Rpc.make('playerView', {
        success: PlayerViewSchema,
        error: ErrorsSchema,
        payload: { playerId: Schema.String },
        stream: true
    }),
    Rpc.make('stateUpdates', {
        success: PokerStateSchema,
        error: ErrorsSchema,
        stream: true
    }),
) {}

export const PokerRpcLive = PokerRpc.toLayer(Effect.gen(function* () {
    // TODO: convert poker room to an Effect.Service and provide it
    const ROOM = yield* makePokerRoom(2)

    return {
        currentState: (_, headers) => {
            return ROOM.currentState()
        },
        processEvent: (payload, headers) => {
            return ROOM.processEvent(payload.event)
        },
        playerView: (payload, headers) => {
            return ROOM.playerView(payload.playerId)
        },
        stateUpdates: (_, headers) => {
            return ROOM.stateUpdates
        },
    }
}))
