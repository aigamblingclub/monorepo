import { HttpRouter, HttpServer, HttpMiddleware, HttpServerResponse } from "@effect/platform";
import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { RpcSerialization, RpcServer } from "@effect/rpc";
import { Effect, Layer, pipe } from "effect";
import { RoomPokerRpcLive } from "./room-router";
import { RoomManagerLive } from "./room-manager";
import { makeAgentApp } from "./agent-api";
import { RoomPokerRpc } from "./rpc";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
  "Access-Control-Allow-Headers": "*"
};

// CORS middleware  
const corsMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const response = yield* app;
    return HttpServerResponse.setHeaders(response, corsHeaders);
  })
);

const MultiRoomWebAppLayer = Layer.unwrapScoped(
  Effect.gen(function* () {
    const webSocketApp = yield* RpcServer.toHttpAppWebsocket(RoomPokerRpc);
    const restApp = yield* RpcServer.toHttpApp(RoomPokerRpc);
    const agentApp = makeAgentApp();
    
    const router = HttpRouter.empty.pipe(
      HttpRouter.options("/api/*", 
        Effect.gen(function* () {
          return yield* HttpServerResponse.empty({ status: 200, headers: corsHeaders });
        })
      ),
      HttpRouter.mountApp("/manage", agentApp),
      HttpRouter.mountApp("/rpc", webSocketApp),
      HttpRouter.mountApp("/api", restApp), 
      corsMiddleware,
      HttpServer.serve()
    );
    
    return router;
  })
);

const layers = pipe(
  MultiRoomWebAppLayer,
  Layer.provide([
    RpcSerialization.layerJson,
    RoomPokerRpcLive,
    BunHttpServer.layer({ port: 3001 })
  ]),
  Layer.provideMerge(RoomManagerLive),
)

BunRuntime.runMain(Layer.launch(layers))

console.log(`
Multi-room Poker server started on port 3001

RPC endpoints (room specified in payload):
- WebSocket: ws://localhost:3001/rpc
- REST API: http://localhost:3001/api

Agent management endpoints:
- POST http://localhost:3001/manage/spawn - Spawn agents for a room
- POST http://localhost:3001/manage/stop - Stop agents for a room
- GET http://localhost:3001/manage/:roomId - Get running agents for a room

Each RPC call must include roomId in the payload.
`);