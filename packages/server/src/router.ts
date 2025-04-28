import { makePokerRoom } from "poker-state-machine";
import { ProcessingStateStreamErrorsSchema, GameEventSchema, PlayerViewSchema, PokerStateSchema, ProcessEventErrorSchema } from "poker-state-machine/schemas";
import { Rpc, RpcGroup, RpcClient } from "@effect/rpc";
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
        error: ProcessingStateStreamErrorsSchema,
        payload: { playerId: Schema.String },
        stream: true
    }),
    Rpc.make('stateUpdates', {
        success: PokerStateSchema,
        error: ProcessingStateStreamErrorsSchema,
        stream: true
    }),
) {}

export const PokerRpcLive = PokerRpc.toLayer(Effect.gen(function* () {
    // TODO: convert poker room to an Effect.Service and provide it
    const ROOM = yield* makePokerRoom(2)

    return {
        currentState: (_, headers) => {
            console.log('ta chamano aq?')
            return ROOM.currentState()
        },
        processEvent: (payload, headers) => {
            console.log('ta chamano aq?')
            return ROOM.processEvent(payload.event)
        },
        playerView: (payload, headers) => {
            console.log('ta chamano aq?')
            return ROOM.playerView(payload.playerId)
        },
        stateUpdates: (_, headers) => {
            console.log('ta chamano aq?')
            return ROOM.stateUpdates
        },
    }
}))

Effect.gen(function* () {
    const client = yield*  RpcClient.make(PokerRpc)

    const state = yield* client.currentState()


    const _ = yield* client.processEvent({
        event: {
            type: 'table',
            action: 'join',
            playerId: 'asdasda'
        }
    })

})
