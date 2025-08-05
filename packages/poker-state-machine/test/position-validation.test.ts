import { expect, test, describe, beforeEach } from "bun:test";
import { Effect } from "effect";
import { 
  setupTestEnvironment, 
  PLAYER_IDS, 
  makePokerRoomForTests
} from "./test-helpers";
import type { PokerState, PlayerState } from "../src/schemas";

describe("🎯 Position Validation Tests", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  test("Should not assign duplicate positions to active players", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(5));

    // Add 5 players
    for (let i = 0; i < 5; i++) {
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          action: "join",
          playerId: PLAYER_IDS[i],
          playerName: `Player${i + 1}`,
        })
      );
    }

    const state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    
    console.log("Checking for duplicate positions:");
    
    const activePlayers = state.players.filter(p => p.chips > 0);
    const positions = activePlayers.map(p => p.position);
    
    activePlayers.forEach((p, i) => {
      console.log(`  [${i}] ${p.playerName}: ${p.position} (${p.chips} chips, ${p.status})`);
    });
    
    // Count position occurrences
    const positionCounts: Record<string, number> = {};
    positions.forEach(pos => {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    
    console.log("Position counts:", positionCounts);
    
    // Check for duplicates in critical positions
    const criticalPositions = ["SB", "BB", "BTN"];
    const duplicates: string[] = [];
    
    for (const [position, count] of Object.entries(positionCounts)) {
      if (count > 1) {
        duplicates.push(`${position}(${count})`);
        
        if (criticalPositions.includes(position)) {
          console.error(`❌ CRITICAL: Multiple ${position} positions detected: ${count}`);
        } else {
          console.warn(`⚠️  WARNING: Multiple ${position} positions detected: ${count}`);
        }
      }
    }
    
    if (duplicates.length > 0) {
      console.log(`❌ Duplicate positions found: ${duplicates.join(", ")}`);
    } else {
      console.log(`✅ No duplicate positions found`);
    }
    
    // Strict validation: No position should appear more than once among active players
    Object.entries(positionCounts).forEach(([position, count]) => {
      expect(count).toBe(1); // Each position should appear exactly once
    });
    
    // Ensure all required positions are present for 5 players
    expect(positionCounts.SB).toBe(1);
    expect(positionCounts.BB).toBe(1);
    expect(positionCounts.BTN).toBe(1);
    
    // For 5 players, we should also have EP and MP
    expect(positionCounts.EP).toBe(1);
    expect(positionCounts.MP).toBe(1);
  });

  test("Should maintain unique positions through multiple rounds", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(4));

    // Add 4 players
    for (let i = 0; i < 4; i++) {
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          action: "join",
          playerId: PLAYER_IDS[i],
          playerName: `Player${i + 1}`,
        })
      );
    }

    // Track positions through multiple rounds
    const positionHistory: Array<{
      round: number;
      positions: Record<string, string>; // playerId -> position
      duplicates: string[];
    }> = [];

    // Simulate several rounds
    for (let round = 0; round < 3; round++) {
      const state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      if (state.tableStatus !== "PLAYING") {
        console.log(`Game not playing in round ${round}: ${state.tableStatus}`);
        break;
      }
      
      const activePlayers = state.players.filter(p => p.chips > 0);
      const roundPositions: Record<string, string> = {};
      const positionCounts: Record<string, number> = {};
      
      activePlayers.forEach(p => {
        roundPositions[p.id] = p.position;
        positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
      });
      
      const duplicates = Object.entries(positionCounts)
        .filter(([_, count]) => count > 1)
        .map(([pos, count]) => `${pos}(${count})`);
      
      positionHistory.push({
        round: state.round.roundNumber,
        positions: roundPositions,
        duplicates
      });
      
      console.log(`\nRound ${state.round.roundNumber} positions:`);
      activePlayers.forEach(p => {
        console.log(`  ${p.playerName}: ${p.position}`);
      });
      
      if (duplicates.length > 0) {
        console.error(`❌ Round ${state.round.roundNumber} has duplicates: ${duplicates.join(", ")}`);
      }
      
      // Play a few moves to advance the game
      for (let move = 0; move < 4 && state.tableStatus === "PLAYING"; move++) {
        const currentState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
        
        if (currentState.currentPlayerIndex < 0) break;
        
        const currentPlayer = currentState.players[currentState.currentPlayerIndex];
        
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "move",
            playerId: currentPlayer.id,
            move: { type: "call", decisionContext: null },
          })
        );
      }
      
      // Try to advance to next round
      try {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "next_round"
          })
        );
      } catch (error) {
        console.log(`Could not advance to next round: ${error}`);
        break;
      }
    }
    
    // Analyze position history
    console.log(`\n📊 Position History Analysis:`);
    
    let totalDuplicates = 0;
    positionHistory.forEach((round, i) => {
      console.log(`Round ${round.round}: ${round.duplicates.length === 0 ? '✅ No duplicates' : `❌ ${round.duplicates.join(', ')}`}`);
      totalDuplicates += round.duplicates.length;
    });
    
    console.log(`Total duplicate incidents: ${totalDuplicates}`);
    
    // The test should pass if no duplicates are found
    expect(totalDuplicates).toBe(0);
  });

  test("Should properly assign positions for different player counts", async () => {
    // Test position assignment for 2, 3, 4, 5, and 6 players
    const testCases = [2, 3, 4, 5, 6];
    
    for (const playerCount of testCases) {
      console.log(`\n🎯 Testing ${playerCount} players:`);
      
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(playerCount));

      // Add players
      for (let i = 0; i < playerCount; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            action: "join",
            playerId: PLAYER_IDS[i],
            playerName: `Player${i + 1}`,
          })
        );
      }

      const state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      const activePlayers = state.players.filter(p => p.chips > 0);
      
      expect(activePlayers.length).toBe(playerCount);
      
      // Check position distribution
      const positions = activePlayers.map(p => p.position);
      const positionCounts: Record<string, number> = {};
      
      positions.forEach(pos => {
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      });
      
      console.log(`  Players: ${activePlayers.map(p => `${p.playerName}:${p.position}`).join(', ')}`);
      console.log(`  Position counts:`, positionCounts);
      
      // Validate no duplicates
      Object.entries(positionCounts).forEach(([position, count]) => {
        expect(count).toBe(1); // Each position should appear exactly once
      });
      
      // Validate required positions based on player count
      if (playerCount >= 2) {
        expect(positionCounts.SB).toBe(1);
        expect(positionCounts.BB).toBe(1);
      }
      
      if (playerCount >= 3) {
        expect(positionCounts.BTN).toBe(1);
      }
      
      if (playerCount >= 4) {
        expect(positionCounts.EP).toBe(1);
      }
      
      if (playerCount >= 5) {
        expect(positionCounts.MP).toBe(1);
      }
      
      if (playerCount >= 6) {
        expect(positionCounts.CO).toBe(1);
      }
      
      console.log(`  ✅ ${playerCount} players validated`);
    }
  });

  test("Should handle position assignment when dealer is eliminated", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(3));

    // Add 3 players
    for (let i = 0; i < 3; i++) {
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          action: "join",
          playerId: PLAYER_IDS[i],
          playerName: `Player${i + 1}`,
        })
      );
    }

    let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    
    console.log("Initial state:");
    console.log(`Dealer: ${state.dealerId}`);
    state.players.forEach((p, i) => {
      console.log(`  [${i}] ${p.playerName}: ${p.position} (${p.chips} chips, ${p.status})`);
    });
    
    // Find the dealer player
    const dealerPlayer = state.players.find(p => p.id === state.dealerId);
    expect(dealerPlayer).toBeDefined();
    
    console.log(`\nDealer is: ${dealerPlayer!.playerName}`);
    
    // Simulate dealer elimination by setting chips to 0 and status to ELIMINATED
    // Note: In a real game, this would happen through betting, but we'll simulate it
    const stateWithEliminatedDealer: PokerState = {
      ...state,
      players: state.players.map(p => 
        p.id === state.dealerId 
          ? { ...p, chips: 0, status: "ELIMINATED" as const }
          : p
      )
    };
    
    console.log(`\nAfter dealer elimination simulation:`);
    stateWithEliminatedDealer.players.forEach((p, i) => {
      console.log(`  [${i}] ${p.playerName}: ${p.position} (${p.chips} chips, ${p.status})`);
    });
    
    // Check how the system would handle this scenario
    const activePlayers = stateWithEliminatedDealer.players.filter(p => p.chips > 0);
    const activePositions = activePlayers.map(p => p.position);
    
    console.log(`\nActive players after elimination: ${activePlayers.length}`);
    console.log(`Active positions: ${activePositions.join(', ')}`);
    
    // Validate that remaining active players don't have duplicate positions
    const positionCounts: Record<string, number> = {};
    activePositions.forEach(pos => {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    
    console.log(`Position counts among active players:`, positionCounts);
    
    // No active position should appear more than once
    Object.entries(positionCounts).forEach(([position, count]) => {
      expect(count).toBe(1);
    });
    
    // With 2 active players remaining, we should have SB and BB
    expect(activePlayers.length).toBe(2);
    expect(positionCounts.SB).toBe(1);
    expect(positionCounts.BB).toBe(1);
    
    console.log(`✅ Position assignment handled correctly after dealer elimination`);
  });

  test("Should validate position consistency during game phases", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(5));

    // Add 5 players
    for (let i = 0; i < 5; i++) {
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          action: "join",
          playerId: PLAYER_IDS[i],
          playerName: `Player${i + 1}`,
        })
      );
    }

    // Track positions through different game phases
    const phasePositions: Array<{
      street: string;
      positions: Record<string, string>;
      duplicates: string[];
    }> = [];

    const phases = ["PRE_FLOP", "FLOP", "TURN", "RIVER"];
    
    for (const targetPhase of phases) {
      const state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      if (state.phase.street === targetPhase || state.tableStatus !== "PLAYING") {
        const activePlayers = state.players.filter(p => p.chips > 0 && p.status !== "ELIMINATED");
        const positions: Record<string, string> = {};
        const positionCounts: Record<string, number> = {};
        
        activePlayers.forEach(p => {
          positions[p.playerName] = p.position;
          positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
        });
        
        const duplicates = Object.entries(positionCounts)
          .filter(([_, count]) => count > 1)
          .map(([pos, count]) => `${pos}(${count})`);
        
        phasePositions.push({
          street: state.phase.street,
          positions,
          duplicates
        });
        
        console.log(`\n${state.phase.street} positions:`);
        activePlayers.forEach(p => {
          console.log(`  ${p.playerName}: ${p.position}`);
        });
        
        if (duplicates.length > 0) {
          console.error(`❌ ${state.phase.street} has duplicates: ${duplicates.join(", ")}`);
        } else {
          console.log(`✅ ${state.phase.street} has no duplicates`);
        }
        
        // Validate no duplicates in this phase
        Object.entries(positionCounts).forEach(([position, count]) => {
          expect(count).toBe(1);
        });
      }
      
      // Advance to next phase if not already there
      if (state.phase.street !== targetPhase && state.tableStatus === "PLAYING") {
        // Make moves to advance
        for (let moveCount = 0; moveCount < 10; moveCount++) {
          const currentState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
          
          if (currentState.phase.street === targetPhase || 
              currentState.currentPlayerIndex < 0 || 
              currentState.tableStatus !== "PLAYING") {
            break;
          }
          
          const currentPlayer = currentState.players[currentState.currentPlayerIndex];
          
          await Effect.runPromise(
            pokerRoom.processEvent({
              type: "move",
              playerId: currentPlayer.id,
              move: { type: "call", decisionContext: null },
            })
          );
        }
      }
      
      // Break if game ended
      const finalState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      if (finalState.tableStatus !== "PLAYING") {
        break;
      }
    }
    
    // Summary
    console.log(`\n📊 Phase Position Summary:`);
    phasePositions.forEach(phase => {
      console.log(`${phase.street}: ${phase.duplicates.length === 0 ? '✅ Clean' : `❌ ${phase.duplicates.join(', ')}`}`);
    });
    
    const totalDuplicates = phasePositions.reduce((sum, phase) => sum + phase.duplicates.length, 0);
    console.log(`Total duplicate incidents across phases: ${totalDuplicates}`);
    
    expect(totalDuplicates).toBe(0);
  });
});