import { HttpRouter, HttpServer } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer, pipe } from "effect";
import { PokerRpc, PokerRpcLive } from "./router";

const webAppFiber = Effect.gen(function* () {
    const webApp = yield* pipe(
        RpcServer.toHttpApp(PokerRpc),
        Effect.provide([
            PokerRpcLive,
            RpcSerialization.layerJson
        ]),
    )

    const HttpLive = HttpRouter.empty.pipe(
        HttpRouter.mountApp('/rpc', webApp),
        HttpServer.serve(),
        // HttpServer.withLogAddress,
        Layer.provide(BunHttpServer.layer({ port: 3000 }))
    )

    return BunRuntime.runMain(Layer.launch(HttpLive))
})

const _ = Effect.runSync(webAppFiber.pipe(Effect.scoped))
