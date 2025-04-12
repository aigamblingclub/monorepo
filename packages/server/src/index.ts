import { HttpRouter, HttpServer } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer } from "effect";
import { PokerRpc, PokerRpcLive } from "./router";

const WebAppLayer = Layer.unwrapScoped(Effect.gen(function* () {
  const webApp = yield* RpcServer.toHttpAppWebsocket(PokerRpc)

  return HttpRouter.empty.pipe(
    HttpRouter.mountApp('/rpc', webApp),
    HttpServer.serve(),
  )
}))

BunRuntime.runMain(
    Layer.launch(
        WebAppLayer.pipe(
            Layer.provideMerge(PokerRpcLive),
            Layer.provideMerge(RpcSerialization.layerJson),
            Layer.provideMerge(BunHttpServer.layer({ port: 3000 }))
        )
    )
)
