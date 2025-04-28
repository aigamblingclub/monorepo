import { RpcClient, RpcSerialization } from "@effect/rpc"
import { Console, Effect, Layer, pipe } from "effect"
import { PokerRpc } from "../server/src/router"
import { layerWebSocket } from "@effect/platform-bun/BunSocket"

const ProtocolLive = pipe(
    RpcClient.layerProtocolSocket,
    Layer.provide([
        // is this completely unnecessary? looks like it
        // FetchHttpClient.layer,
        RpcSerialization.layerJson,
        layerWebSocket("http://localhost:3000/rpc")
    ])
)

const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(PokerRpc)
    const state = yield* client.currentState()
    yield* Console.log(state)
    return state
})

const _ = await pipe(
    program,
    Effect.scoped,
    Effect.provide(ProtocolLive),
    Effect.runPromise
)
