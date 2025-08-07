import { spawn, type Subprocess } from "bun";
import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, pipe, Layer, Fiber } from "effect";
import { RoomPokerRpc } from "./src/room-router";

async function startMultiRoomServer(): Promise<Subprocess> {
  console.log("Starting multi-room poker server...");
  
  const server = spawn(["bun", "run", "./src/multi-room-index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      START_SLEEP_TIME: "500", // 0.5 second
      ROUND_OVER_DELAY_MS: "50",
      MIN_PLAYERS: "2",
      LOG_LEVEL: "info"
    },
    stdout: "inherit",
    stderr: "inherit"
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  return server;
}

async function stopServer(server: Subprocess) {
  console.log("\nStopping server...");
  server.kill();
  await server.exited;
}

// Demo program for a specific room
const createRoomDemo = (roomId: string, playerPrefix: string) => Effect.gen(function* () {
  yield* Console.log(`\n=== Room ${roomId} Demo ===`);

  const client = yield* RpcClient.make(RoomPokerRpc);
  
  // 1. Get initial state
  const initialState = yield* client.currentState({ roomId });
  yield* Console.log(`Table ID: ${initialState.tableId}`);
  yield* Console.log(`Status: ${initialState.tableStatus}`);
  
  // 2. Add players
  yield* client.processEvent({
    roomId,
    event: {
      type: "table",
      playerId: `${playerPrefix}1`,
      playerName: `${playerPrefix}1`,
      action: "join",
    }
  });
  yield* Console.log(`Added ${playerPrefix}1`);

  yield* client.processEvent({
    roomId,
    event: {
      type: "table",
      playerId: `${playerPrefix}2`,
      playerName: `${playerPrefix}2`,
      action: "join",
    }
  });
  yield* Console.log(`Added ${playerPrefix}2`);

  // 3. Start game
  yield* Console.log("Starting game...");
  const startGameFiber = yield* pipe(
    client.startGame({ roomId }),
    Effect.fork
  );

  yield* Effect.sleep("1 second");
  
  const gameState = yield* client.currentState({ roomId });
  if (gameState.tableStatus === "PLAYING") {
    yield* Console.log(`Game started! Current player: ${gameState.players[gameState.currentPlayerIndex].playerName}`);
    
    // Make a move
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    yield* client.processEvent({
      roomId,
      event: {
        type: "move",
        playerId: currentPlayer.id,
        move: {
          type: "call",
          decisionContext: null,
        },
      }
    });
    yield* Console.log(`${currentPlayer.playerName} called`);
    
    // Check state
    const afterMove = yield* client.currentState({ roomId });
    yield* Console.log(`Pot: ${afterMove.round.volume}`);
  }
  
  yield* Fiber.interrupt(startGameFiber);
});

// Create layers for multi-room endpoints
const createRoomLayers = () => {
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

async function main() {
  let server: Subprocess | null = null;
  
  try {
    server = await startMultiRoomServer();
    
    // Demo with multiple rooms
    console.log("\n=== Multi-Room Poker Demo ===");
    console.log("Creating 3 different poker rooms...\n");
    
    // Run demos for 3 different rooms in parallel
    const layers = createRoomLayers();
    
    const room1 = pipe(
      createRoomDemo("texas-holdem-1", "Alice"),
      Effect.provide(layers)
    );
    
    const room2 = pipe(
      createRoomDemo("texas-holdem-2", "Bob"),
      Effect.provide(layers)
    );
    
    const room3 = pipe(
      createRoomDemo("vip-room", "Charlie"),
      Effect.provide(layers)
    );
    
    // Run all rooms in parallel with scoped
    const allRooms = Effect.all([room1, room2, room3], { concurrency: "unbounded" });
    
    await Effect.runPromise(
      pipe(
        allRooms,
        Effect.scoped,
        Effect.catchAll((error) =>
          Console.error(`Error: ${JSON.stringify(error, null, 2)}`)
        )
      )
    );
    
    console.log("\n=== All rooms completed ===");
    
  } catch (error) {
    console.error("Demo failed:", error);
  } finally {
    if (server) {
      await stopServer(server);
    }
  }
}

main();