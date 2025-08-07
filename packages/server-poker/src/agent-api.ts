import { HttpRouter, HttpServerRequest, HttpServerResponse, HttpMiddleware } from "@effect/platform";
import { Schema, Effect } from "effect";
import { spawnAgentsInline, stopAgentsInline, getRunningAgentsInline } from "./spawn-agents-inline";

const SpawnAgentsRequest = Schema.Struct({
  roomId: Schema.String,
  numAgents: Schema.optionalWith(Schema.Number, { default: () => 2 }),
  startPort: Schema.optionalWith(Schema.Number, { default: () => 3300 })
});

const StopAgentsRequest = Schema.Struct({
  roomId: Schema.String
});

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

// CORS preflight handler
const handleOptions = Effect.gen(function* () {
  return yield* HttpServerResponse.empty({ status: 200, headers: corsHeaders });
});

// Add CORS headers to response
const withCors = (response: any) => {
  return HttpServerResponse.setHeaders(response, corsHeaders);
};

export const makeAgentApp = () => {
  const router = HttpRouter.empty.pipe(
    // Handle OPTIONS requests for CORS preflight
    HttpRouter.options("/spawn", handleOptions),
    HttpRouter.options("/stop", handleOptions),
    HttpRouter.options("/:roomId", handleOptions),
    
    HttpRouter.post("/spawn", 
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = yield* request.json;
        const parsed = yield* Schema.decodeUnknown(SpawnAgentsRequest)(body);
        
        const agents = yield* Effect.tryPromise({
          try: () => spawnAgentsInline(parsed.roomId, parsed.numAgents, parsed.startPort),
          catch: (error) => new Error(error instanceof Error ? error.message : "Failed to spawn agents")
        });
        
        const response = yield* HttpServerResponse.json({
          success: true,
          roomId: parsed.roomId,
          agents: agents.map(a => ({
            id: a.agentId,
            name: a.characterName,
            port: a.port,
            pid: a.process.pid
          }))
        });
        
        return withCors(response);
      })
    ),
    
    HttpRouter.post("/stop",
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = yield* request.json;
        const parsed = yield* Schema.decodeUnknown(StopAgentsRequest)(body);
        
        yield* Effect.tryPromise({
          try: () => stopAgentsInline(parsed.roomId),
          catch: (error) => new Error(error instanceof Error ? error.message : "Failed to stop agents")
        });
        
        const response = yield* HttpServerResponse.json({
          success: true,
          message: `Agents stopped for room ${parsed.roomId}`
        });
        
        return withCors(response);
      })
    ),
    
    HttpRouter.get("/:roomId",
      Effect.gen(function* () {
        const params = yield* HttpRouter.params;
        const roomId = params.roomId;
        
        if (!roomId) {
          const response = yield* HttpServerResponse.json({
            success: false,
            error: "Room ID is required"
          }, { status: 400 });
          return withCors(response);
        }
        
        const agents = getRunningAgentsInline(roomId);
        
        const response = yield* HttpServerResponse.json({
          success: true,
          roomId,
          agents: agents.map(a => ({
            id: a.agentId,
            name: a.characterName,
            port: a.port,
            pid: a.process.pid,
            running: a.process.exitCode === null
          }))
        });
        
        return withCors(response);
      })
    )
  );
  
  return router.pipe(HttpMiddleware.logger);
};