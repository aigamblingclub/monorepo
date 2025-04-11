import { FetchHttpClient } from "@effect/platform"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import { Chunk, Console, Effect, Layer, Stream } from "effect"
import {  } from 'poker-state-machine'
import { PokerRpc } from "../server/src/router"

// Choose which protocol to use
const ProtocolLive = RpcClient.layerProtocolHttp({
  url: "http://localhost:3001 /rpc"
}).pipe(
  Layer.provide([
    // use fetch for http requests
    FetchHttpClient.layer,
    // use ndjson for serialization
    RpcSerialization.layerJson
  ])
)

// Use the client
const program = Effect.gen(function* () {
  const client = yield* RpcClient.make(PokerRpc)
  let state = yield* Stream.runCollect(client.currentState())
  return Console.log(state)
}).pipe(Effect.scoped)

program.pipe(Effect.provide(ProtocolLive), Effect.runPromise).then(console.log)
