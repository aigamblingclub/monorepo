import { expect, test, describe } from "bun:test";
import { 
  setupTestEnvironment, 
  setupThreePlayerGame,
  PLAYER_IDS, 
  Effect, 
  makePokerRoomForTests,
  waitForGameState,
  currentPlayer,
  setupDeterministicTest
} from "./test-helpers";
import type { PokerState } from "../src/schemas";
import { nextRound, playerBet, finalizeRound } from "../src/transitions";
import { PLAYER_DEFAULT_STATE } from "../src/state_machine";

/**
 * 🎯 PLAYER ELIMINATION TESTS
 * 
 * Tests to ensure players with 0 chips are properly eliminated from the game
 * but remain in the players array for history. They should not receive cards
 * or participate in active game logic.
 */
describe("🚮 Player Elimination System", () => {
  setupTestEnvironment();

  test("Eliminated players should stay in array but be inactive", async () => {
    console.log("\n=== PLAYER ELIMINATION TEST ===");
    
    // Setup 3-player game
    const { pokerRoom } = await setupThreePlayerGame();
    let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    
    console.log("Initial state:");
    state.players.forEach(p => {
      console.log(`  ${p.playerName}: ${p.chips} chips, status: ${p.status}, hand: ${p.hand.length} cards`);
    });
    
    // Manually eliminate one player by setting chips to 0
    const eliminatedPlayerId = state.players[0].id;
    const modifiedState: PokerState = {
      ...state,
      players: state.players.map(p => 
        p.id === eliminatedPlayerId 
          ? { ...p, chips: 0, status: "ELIMINATED" as const }
          : p
      )
    };
    
    console.log(`\n💀 Eliminating player: ${eliminatedPlayerId}`);
    
    // Simulate next round with eliminated player
    const nextRoundResult = await Effect.runPromise(nextRound(modifiedState));
    
    console.log("\nAfter nextRound():");
    console.log(`Total players in state: ${nextRoundResult.players.length}`);
    nextRoundResult.players.forEach(p => {
      console.log(`  ${p.playerName}: ${p.chips} chips, status: ${p.status}, hand: ${p.hand.length} cards`);
    });
    
    // ASSERTIONS
    // 1. ALL players should still be in the array (eliminated + active)
    expect(nextRoundResult.players.length).toBe(3);
    
    // 2. Eliminated player should be in array but with 0 chips and no cards
    const eliminatedPlayer = nextRoundResult.players.find(p => p.id === eliminatedPlayerId);
    expect(eliminatedPlayer).toBeDefined();
    expect(eliminatedPlayer!.chips).toBe(0);
    expect(eliminatedPlayer!.hand.length).toBe(0);
    expect(eliminatedPlayer!.status).toBe("ELIMINATED");
    
    // 3. Active players should have cards and chips
    const activePlayers = nextRoundResult.players.filter(p => p.chips > 0);
    expect(activePlayers.length).toBe(2);
    activePlayers.forEach(p => {
      expect(p.chips).toBeGreaterThan(0);
      expect(p.hand.length).toBe(2);
      expect(p.status).toBe("PLAYING");
    });
    
    console.log("✅ Player elimination working correctly!");
  });

  test("Game should end when only one player has chips", async () => {
    console.log("\n=== GAME OVER ON ELIMINATION TEST ===");
    
    // Setup 3-player game
    const { pokerRoom } = await setupThreePlayerGame();
    let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    
    // Eliminate two players, leave only one with chips
    const winnerPlayerId = state.players[0].id;
    const modifiedState: PokerState = {
      ...state,
      players: state.players.map((p, index) => ({
        ...p,
        chips: index === 0 ? 600 : 0, // Winner gets all chips, others eliminated
        status: index === 0 ? "PLAYING" as const : "ELIMINATED" as const
      }))
    };
    
    console.log(`\n🏆 Setting up game over scenario - winner: ${winnerPlayerId}`);
    
    // Attempt next round - should trigger game over
    const result = await Effect.runPromise(nextRound(modifiedState));
    
    console.log("\nAfter nextRound() with only one player with chips:");
    console.log(`Table status: ${result.tableStatus}`);
    console.log(`Winner: ${result.winner}`);
    console.log(`Total players in final state: ${result.players.length}`);
    
    // ASSERTIONS
    expect(result.tableStatus).toBe("GAME_OVER");
    expect(result.winner).toBe(winnerPlayerId);
    expect(result.players.length).toBe(3); // All players still in array
    
    console.log("✅ Game over condition working correctly!");
  });

  test("dealCards should not give cards to eliminated players", async () => {
    console.log("\n=== DEAL CARDS ELIMINATION TEST ===");
    
    // Create a state with mixed active and eliminated players
    const testState: PokerState = {
      tableId: "test",
      tableStatus: "WAITING",
      players: [
        { ...PLAYER_DEFAULT_STATE, id: "player1", playerName: "Active Player 1", chips: 100 },
        { ...PLAYER_DEFAULT_STATE, id: "player2", playerName: "Eliminated Player", chips: 0 },
        { ...PLAYER_DEFAULT_STATE, id: "player3", playerName: "Active Player 2", chips: 150 },
      ],
      lastMove: null,
      currentPlayerIndex: 0,
      deck: [],
      community: [],
      phase: { street: "PRE_FLOP", actionCount: 0, volume: 0 },
      round: { roundNumber: 1, volume: 0, currentBet: 0, foldedPlayers: [], allInPlayers: [] },
      dealerId: "player1",
      winner: null,
      config: { maxRounds: null, startingChips: 200, smallBlind: 10, bigBlind: 20 },
      lastRoundResult: null,
    };
    
    // Import dealCards function
    const { dealCards } = await import("../src/transitions");
    
    console.log("Before dealCards:");
    testState.players.forEach(p => {
      console.log(`  ${p.playerName}: ${p.chips} chips, hand: ${p.hand.length} cards`);
    });
    
    // Deal cards
    const result = dealCards(testState);
    
    console.log("\nAfter dealCards:");
    result.players.forEach(p => {
      console.log(`  ${p.playerName}: ${p.chips} chips, status: ${p.status}, hand: ${p.hand.length} cards`);
    });
    
    // ASSERTIONS
    // 1. All players should still be in the array
    expect(result.players.length).toBe(3);
    
    // 2. Active players should have 2 cards each
    const activePlayers = result.players.filter(p => p.chips > 0);
    expect(activePlayers.length).toBe(2);
    activePlayers.forEach(p => {
      expect(p.hand.length).toBe(2);
      expect(p.status).toBe("PLAYING");
    });
    
    // 3. Eliminated player should have no cards and be eliminated
    const eliminatedPlayer = result.players.find(p => p.chips === 0);
    expect(eliminatedPlayer).toBeDefined();
    expect(eliminatedPlayer!.hand.length).toBe(0);
    expect(eliminatedPlayer!.status).toBe("ELIMINATED");
    
    console.log("✅ dealCards elimination logic working correctly!");
  });

  test("Full elimination scenario with realistic 0 chips", async () => {
    console.log("\n=== FULL ELIMINATION SCENARIO TEST ===");
    
    const cleanup = setupDeterministicTest("ELIMINATION");
    
    try {
      // Setup 3-player game
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(3));
      
      // Add 3 players
      for (let i = 0; i < 3; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            action: "join",
            playerId: PLAYER_IDS[i],
            playerName: `Player ${i + 1}`,
          })
        );
      }
      
      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      console.log(`Initial 3-player setup: ${state.players.length} players`);
      
      // Instead of artificially modifying chips, let's directly test nextRound behavior
      // with a manually created state that would result from a real elimination
      const simulatedPostEliminationState: PokerState = {
        ...state,
        tableStatus: "ROUND_OVER",
        players: state.players.map((p, index) => ({
          ...p,
          chips: index === 2 ? 0 : p.chips, // Third player eliminated with 0 chips
          status: index === 2 ? "ELIMINATED" as const : "PLAYING" as const,
          bet: { amount: 0, volume: 0 }, // Reset bets as if round finished
        })),
        round: {
          ...state.round,
          volume: 0, // Reset volume as if round finished
          currentBet: 0,
        },
        phase: {
          street: 'SHOWDOWN',
          actionCount: 0,
          volume: 0,
        }
      };
      
      const losingPlayerId = simulatedPostEliminationState.players[2].id;
      console.log(`💸 Simulating post-elimination state for player ${losingPlayerId}`);
      
      // Now test nextRound with this clean state
      const nextRoundState = await Effect.runPromise(nextRound(simulatedPostEliminationState));
      
      console.log("\nAfter next round:");
      console.log(`Players in state: ${nextRoundState.players.length}`);
      nextRoundState.players.forEach(p => {
        console.log(`  ${p.playerName}: ${p.chips} chips, status: ${p.status}, hand: ${p.hand.length} cards`);
      });
      
      // ASSERTIONS
      expect(nextRoundState.players.length).toBe(3); // ALL players still in array
      expect(nextRoundState.tableStatus).toBe("PLAYING"); // Game continues with 2 active players
      
      // Check eliminated player
      const eliminatedPlayer = nextRoundState.players.find(p => p.id === losingPlayerId);
      expect(eliminatedPlayer).toBeDefined();
      expect(eliminatedPlayer!.chips).toBe(0);
      expect(eliminatedPlayer!.hand.length).toBe(0);
      expect(eliminatedPlayer!.status).toBe("ELIMINATED");
      
      // Check active players
      const activePlayers = nextRoundState.players.filter(p => p.chips > 0);
      expect(activePlayers.length).toBe(2);
      activePlayers.forEach(p => {
        expect(p.chips).toBeGreaterThan(0);
        expect(p.hand.length).toBe(2);
        expect(p.status).toBe("PLAYING");
      });
      
      console.log("✅ Full elimination scenario working correctly!");
      
    } finally {
      cleanup();
    }
  });
}); 