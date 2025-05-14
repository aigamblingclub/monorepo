import { HttpRouter, HttpServer } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer } from "effect";
import { PokerRpc, PokerRpcLive } from "./router";

const WebAppLayer = Layer.unwrapScoped(
  Effect.gen(function* () {
    const webSocketApp = yield* RpcServer.toHttpAppWebsocket(PokerRpc);
    const restApp = yield* RpcServer.toHttpApp(PokerRpc);

    return HttpRouter.empty.pipe(
      HttpRouter.mountApp("/rpc", webSocketApp),
      HttpRouter.mountApp("/api", restApp),
      HttpServer.serve()
    );
  })
);

BunRuntime.runMain(
  Layer.launch(
    WebAppLayer.pipe(
      Layer.provide([
        PokerRpcLive,
        RpcSerialization.layerJson,
        BunHttpServer.layer({ port: 3001 }),
      ])
    )
  )
);
