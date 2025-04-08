import { HttpRouter, HttpServer } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer, pipe } from "effect";
import { PokerRpc, PokerRpcLive } from "./router";

Effect.fork(Effect.gen(function* () {
    const webApp = yield* pipe(
        RpcServer.toHttpAppWebsocket(PokerRpc),
        Effect.provide(PokerRpcLive),
        Effect.provide(RpcSerialization.layerJson),
    )

    const HttpLive = HttpRouter.empty.pipe(
        HttpRouter.mountApp('/rpc', webApp),
        HttpServer.serve(),
        Layer.provide(BunHttpServer.layer({ port: 3000 }))
    )

    return BunRuntime.runMain(Layer.launch(HttpLive))
}))
