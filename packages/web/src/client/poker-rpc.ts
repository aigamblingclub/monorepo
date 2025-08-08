import { RpcClient, RpcClientError, RpcSerialization } from "@effect/rpc";
import { FetchHttpClient } from "@effect/platform";
import { Effect, pipe, Layer, Runtime } from "effect";
import { RoomPokerRpc } from "rpc";

// Create layers following the multi-room demo pattern
const createClientLayers = () => {
  const HttpClientLayer = FetchHttpClient.layer;
  const SerializationLayer = RpcSerialization.layerJson;
  const ProtocolLayer = pipe(
    RpcClient.layerProtocolHttp({
      url: `http://localhost:3001/api`
    }),
    Layer.provide(HttpClientLayer)
  );

  return pipe(
    ProtocolLayer,
    Layer.provide(SerializationLayer)
  );
};

const layers = createClientLayers();
const runtime = Runtime.defaultRuntime;

// Simple wrapper functions for use in React components
export const fetchPokerState = async (roomId: string) => {
  const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(RoomPokerRpc);
    return yield* client.currentState({ roomId });
  });

  return await pipe(
    program,
    Effect.provide(layers),
    Effect.scoped,
    Effect.catchAll(error => {
      return Effect.succeed({})
    }),
    Effect.runPromise
  )
};

export const startPokerGame = async (roomId: string) => {
  const program = Effect.gen(function* () {
    const client = yield* RpcClient.make(RoomPokerRpc);
    return yield* client.startGame({ roomId });
  });

  return await pipe(
    program,
    Effect.provide(layers),
    Effect.scoped,
    Effect.catchAll(error => {
      return Effect.succeed({})
    }),
    Effect.runPromise
  )
};

// Agent management API (keep this simple HTTP since it's not RPC)
export interface AgentApiClient {
  spawnAgents: (roomId: string, numAgents?: number, customCharacter?: Record<string, unknown>) => Promise<any>;
  stopAgents: (roomId: string) => Promise<any>;
  getRunningAgents: (roomId: string) => Promise<any>;
}

export const createAgentApiClient = (serverUrl: string): AgentApiClient => {
  return {
    spawnAgents: async (roomId: string, numAgents = 2, customCharacter?: Record<string, unknown>) => {
      const response = await fetch(`${serverUrl}/manage/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, numAgents, customCharacter })
      });
      return response.json();
    },

    stopAgents: async (roomId: string) => {
      const response = await fetch(`${serverUrl}/manage/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId })
      });
      return response.json();
    },

    getRunningAgents: async (roomId: string) => {
      const response = await fetch(`${serverUrl}/manage/${roomId}`);
      return response.json();
    }
  };
};