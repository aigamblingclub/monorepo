import { spawn, type Subprocess } from "bun";
import { FetchHttpClient } from "@effect/platform";
import { RpcClient, RpcSerialization } from "@effect/rpc";
import { Console, Effect, pipe, Fiber, Layer, Stream } from "effect";
import { PokerRpc } from "./src/router";

// Function to start the server with custom environment
async function startServer(): Promise<Subprocess> {
  console.log("Starting poker server with reduced sleep time...");
  
  const server = spawn(["bun", "run", "./src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      START_SLEEP_TIME: "1000", // 1 second instead of 2 minutes
      ROUND_OVER_DELAY_MS: "50", // 50ms delay between rounds
      MIN_PLAYERS: "2",
      LOG_LEVEL: "info"
    },
    stdout: "inherit",
    stderr: "inherit"
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return server;
}

// Function to stop the server
async function stopServer(server: Subprocess) {
  console.log("\nStopping server...");
  server.kill();
  await server.exited;
}

// Create the demo program
const demoProgram = Effect.gen(function* () {
  yield* Console.log("=== Poker RPC Client Demo ===\n");

  // Create the client
  const client = yield* RpcClient.make(PokerRpc);
  
  // 1. Get initial state
  yield* Console.log("1. Getting initial state:");
  const initialState = yield* client.currentState({});
  yield* Console.log(`   Table ID: ${initialState.tableId}`);
  yield* Console.log(`   Status: ${initialState.tableStatus}`);
  yield* Console.log(`   Players: ${initialState.players.length}\n`);

  // 2. Add players
  yield* Console.log("2. Adding players:");
  
  yield* client.processEvent({
    event: {
      type: "table",
      playerId: "alice",
      playerName: "Alice",
      action: "join",
    }
  });
  yield* Console.log("   Added Alice");

  yield* client.processEvent({
    event: {
      type: "table",
      playerId: "bob",
      playerName: "Bob",
      action: "join",
    }
  });
  yield* Console.log("   Added Bob\n");

  // 3. Start the game
  yield* Console.log("3. Starting the game (1 second delay):");
  const startGameFiber = yield* pipe(
    client.startGame({}),
    Effect.tap(() => Console.log("   Game started!")),
    Effect.fork
  );

  // Wait for game to actually start
  yield* Effect.sleep("1.5 seconds");
  
  const gameState = yield* client.currentState({});
  if (gameState.tableStatus === "PLAYING") {
    yield* Console.log(`   Game is now playing!`);
    yield* Console.log(`   Round: ${gameState.round.roundNumber}`);
    yield* Console.log(`   Phase: ${gameState.phase.street}`);
    yield* Console.log(`   Current player: ${gameState.players[gameState.currentPlayerIndex].playerName}\n`);
    
    // 4. Get player views
    yield* Console.log("4. Getting player views:");
    const aliceView = yield* client.playerView({ playerId: "alice" });
    yield* Console.log(`   Alice's hand: ${aliceView.hand.map(c => `${c.rank}${c.suit[0]}`).join(", ")}`);
    yield* Console.log(`   Alice's chips: ${aliceView.player.chips}`);
    yield* Console.log(`   Alice's position: ${aliceView.player.position}`);
    
    const bobView = yield* client.playerView({ playerId: "bob" });
    yield* Console.log(`   Bob's hand: ${bobView.hand.map(c => `${c.rank}${c.suit[0]}`).join(", ")}`);
    yield* Console.log(`   Bob's chips: ${bobView.player.chips}`);
    yield* Console.log(`   Bob's position: ${bobView.player.position}\n`);

    // 5. Play through the entire game
    yield* Console.log("5. Playing through the entire game:\n");
    
    // Helper function to make a move
    const makeMove = function* (moveType: "call" | "check" | "raise" | "fold", amount?: number) {
      const state = yield* client.currentState({});
      const currentPlayer = state.players[state.currentPlayerIndex];
      
      yield* Console.log(`   ${currentPlayer.playerName} (${currentPlayer.position}) action:`);
      
      const move = moveType === "raise" 
        ? { type: moveType as const, amount: amount || 50, decisionContext: null }
        : { type: moveType as const, decisionContext: null };
      
      yield* client.processEvent({
        event: {
          type: "move",
          playerId: currentPlayer.id,
          move,
        }
      });
      
      const afterMove = yield* client.currentState({});
      const actionStr = moveType === "raise" ? `raised to ${amount}` : moveType === "call" ? "called" : moveType;
      yield* Console.log(`     → ${currentPlayer.playerName} ${actionStr}`);
      yield* Console.log(`     → Pot: ${afterMove.round.volume}, Current bet: ${afterMove.round.currentBet}`);
      
      return afterMove;
    };
    
    // Play through all streets
    let currentState = gameState;
    
    while (currentState.tableStatus === "PLAYING" && currentState.phase.street !== "SHOWDOWN") {
      yield* Console.log(`\n   === ${currentState.phase.street} ===`);
      
      if (currentState.phase.street !== "PRE_FLOP") {
        yield* Console.log(`   Community cards: ${currentState.community.map(c => `${c.rank}${c.suit[0]}`).join(", ")}`);
      }
      
      // Make moves based on the current phase
      const playersInRound = currentState.players.filter(p => p.status === "PLAYING").length;
      let movesInPhase = 0;
      
      const currentPhase = currentState.phase.street;
      while (currentState.phase.street === currentPhase && 
             currentState.tableStatus === "PLAYING" && 
             movesInPhase < playersInRound * 2) { // Safety limit
        
        const player = currentState.players[currentState.currentPlayerIndex];
        const owesChips = player.bet.amount < currentState.round.currentBet;
        
        // Simple strategy: call/check most of the time, occasionally raise
        if (owesChips) {
          currentState = yield* makeMove("call");
        } else {
          // Check or occasionally raise
          if (movesInPhase === 0 && Math.random() > 0.7) {
            currentState = yield* makeMove("raise", 50);
          } else {
            currentState = yield* makeMove("check");
          }
        }
        
        movesInPhase++;
        
        // Check if phase changed
        const newState = yield* client.currentState({});
        if (newState.phase.street !== currentState.phase.street) {
          currentState = newState;
          break;
        }
        currentState = newState;
      }
    }
    
    // Check final state
    yield* Console.log("\n6. Game Result:");
    const finalState = yield* client.currentState({});
    
    if (finalState.tableStatus === "ROUND_OVER" || finalState.tableStatus === "GAME_OVER") {
      yield* Console.log(`   Status: ${finalState.tableStatus}`);
      
      if (finalState.lastRoundResult) {
        yield* Console.log(`   Winners: ${finalState.lastRoundResult.winnerIds.join(", ")}`);
        yield* Console.log(`   Final pot: ${finalState.lastRoundResult.pot}`);
      }
      
      // Show final chip counts
      yield* Console.log("\n   Final chip counts:");
      for (const player of finalState.players) {
        yield* Console.log(`     ${player.playerName}: ${player.chips} chips`);
      }
      
      // Show hands at showdown
      if (finalState.phase.street === "SHOWDOWN") {
        yield* Console.log("\n   Hands at showdown:");
        for (const player of finalState.players) {
          if (player.hand.length === 2) {
            const hand = player.hand.map(c => `${c.rank}${c.suit[0]}`).join(", ");
            yield* Console.log(`     ${player.playerName}: ${hand}`);
          }
        }
      }
    }
  } else {
    yield* Console.log("   ERROR: Game did not start!");
  }

  // Clean up
  yield* Fiber.interrupt(startGameFiber);
  
  yield* Console.log("\n=== Demo Complete ===");
});

// Create the layers with proper dependency ordering
const HttpClientLayer = FetchHttpClient.layer;
const SerializationLayer = RpcSerialization.layerJson;
const ProtocolLayer = pipe(
  RpcClient.layerProtocolHttp({
    url: "http://localhost:3001/api"
  }),
  Layer.provide(HttpClientLayer)
);

const layers = pipe(
  ProtocolLayer,
  Layer.provide(SerializationLayer)
);

// Main function
async function main() {
  let server: Subprocess | null = null;
  
  try {
    // Start the server
    server = await startServer();
    
    // Run the demo
    const runnable = pipe(
      demoProgram,
      Effect.scoped,
      Effect.provide(layers),
      Effect.catchAll((error) =>
        Console.error(`Error: ${JSON.stringify(error, null, 2)}`)
      )
    );
    
    await Effect.runPromise(runnable);
    
  } catch (error) {
    console.error("Demo failed:", error);
  } finally {
    // Always stop the server
    if (server) {
      await stopServer(server);
    }
  }
}

// Run the demo
main();