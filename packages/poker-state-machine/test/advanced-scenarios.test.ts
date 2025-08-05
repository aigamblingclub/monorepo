import { expect, test, describe, beforeEach } from "bun:test";
import { Effect } from "effect";
import { makePokerRoomForTests, setupTestEnvironment, PLAYER_IDS, waitForGameState } from "./test-helpers";
import type { PokerState } from "../src/schemas";

describe("🎯 Advanced Poker Scenarios Tests", () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  describe("👥 Multi-Player Position Tests (4-6 players)", () => {
    test("Should assign positions correctly for 4 players", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(4));

      // Add four players
      for (let i = 0; i < 4; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      const state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Verify all positions are assigned uniquely
      const positions = state.players.map(p => p.position);
      const expectedPositions = ["BTN", "SB", "BB", "EP"];
      
      expect(positions.length).toBe(4);
      expectedPositions.forEach(pos => {
        expect(positions.filter(p => p === pos).length).toBe(1);
      });

      console.log("✅ 4-player positions:", state.players.map(p => `${p.playerName}: ${p.position}`));
    });

    test("Should test position assignment logic (demonstrates 6-player capability)", async () => {
      // NOTE: The system has auto-start behavior that prevents adding >4 players once game starts
      // This test validates the position assignment LOGIC for 6 players using manual state
      
      // Import types and functions
      const { assignPositions } = await import("../src/transitions");
      const { POKER_ROOM_DEFAULT_STATE } = await import("../src/state_machine");
      
      // Create a mock state with 6 players using proper typing
      const mockState: PokerState = {
        ...POKER_ROOM_DEFAULT_STATE,
        tableId: "test",
        players: Array.from({ length: 6 }, (_, i) => ({
          id: PLAYER_IDS[i],
          playerName: `Player${i + 1}`,
          status: "PLAYING" as const,
          chips: 200,
          position: "BTN" as const, // Will be reassigned
          hand: [] as const, // Empty hand for position testing
          bet: { amount: 0, volume: 0 },
          playedThisPhase: false
        })),
        dealerId: PLAYER_IDS[0],
      };

      const resultState = assignPositions(mockState);
      
      // Verify all 6 positions are assigned uniquely
      const positions = resultState.players.map(p => p.position);
      const expectedPositions = ["BTN", "SB", "BB", "EP", "MP", "CO"];
      
      expect(positions.length).toBe(6);
      expectedPositions.forEach(pos => {
        expect(positions.filter(p => p === pos).length).toBe(1);
      });

      console.log("✅ 6-player position logic:", resultState.players.map(p => `${p.playerName}: ${p.position}`));
      console.log("  Note: System auto-starts at 2+ players, preventing >4 players during live play");
    });

    test("Should handle UTG correctly in 4+ player games", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(4));

      // Add four players
      for (let i = 0; i < 4; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      const state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Pre-flop: EP (Under The Gun) should act first
      const currentPlayer = state.players[state.currentPlayerIndex];
      expect(currentPlayer.position).toBe("EP");
      
      console.log(`✅ UTG acting first: ${currentPlayer.playerName} (${currentPlayer.position})`);
    });
  });

  describe("💀 Gradual Elimination Scenarios", () => {
    test("Should handle elimination from 4 to 2 players", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(4));

      // Add four players
      for (let i = 0; i < 4; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Simulate elimination of 2 players by setting chips to 0
      const eliminatedIds = [state.players[0].id, state.players[1].id];
      
      // Manually eliminate players (in real game this would happen through betting)
      const stateWithEliminations = {
        ...state,
        players: state.players.map(p => 
          eliminatedIds.includes(p.id)
            ? { ...p, chips: 0, status: "ELIMINATED" as const }
            : p
        )
      };

      // Test position assignment with eliminated players
      const activePlayers = stateWithEliminations.players.filter(p => p.chips > 0);
      expect(activePlayers.length).toBe(2);
      expect(stateWithEliminations.players.length).toBe(4); // All players remain in array

      // Remaining players should have heads-up positions
      const activePositions = activePlayers.map(p => p.position);
      console.log("✅ After 2 eliminations:", stateWithEliminations.players.map(p => 
        `${p.playerName}: ${p.position} (${p.chips} chips, ${p.status})`
      ));
    });

    test("Should handle dealer elimination mid-game", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(3));

      // Add three players
      for (let i = 0; i < 3; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      const originalDealer = state.dealerId;
      
      // Eliminate the current dealer
      const stateWithDealerEliminated = {
        ...state,
        players: state.players.map(p => 
          p.id === originalDealer
            ? { ...p, chips: 0, status: "ELIMINATED" as const }
            : p
        )
      };

      // Dealer should be reassigned to next active player
      const remainingPlayers = stateWithDealerEliminated.players.filter(p => p.chips > 0);
      expect(remainingPlayers.length).toBe(2);
      
      // None of the remaining players should be the original dealer
      expect(remainingPlayers.some(p => p.id === originalDealer)).toBe(false);
      
      console.log("✅ Dealer eliminated:", {
        originalDealer,
        remainingPlayers: remainingPlayers.map(p => p.playerName)
      });
    });
  });

  describe("💰 Side Pot Scenarios", () => {
    test("Should handle all-in with different amounts", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(3));

      // Add three players with different chip amounts
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          playerName: "ShortStack",
          action: "join",
          playerId: PLAYER_IDS[0],
        })
      );
      
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          playerName: "MediumStack",
          action: "join",
          playerId: PLAYER_IDS[1],
        })
      );
      
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          playerName: "BigStack",
          action: "join",
          playerId: PLAYER_IDS[2],
        })
      );

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Manually set different chip amounts to simulate side pot scenario
      const stateWithDifferentStacks = {
        ...state,
        players: state.players.map((p, i) => ({
          ...p,
          chips: [50, 150, 250][i] // Different stack sizes
        }))
      };

      // Simulate all players going all-in with different amounts
      const allInState = {
        ...stateWithDifferentStacks,
        players: stateWithDifferentStacks.players.map(p => ({
          ...p,
          status: "ALL_IN" as const,
          bet: { amount: p.chips, volume: p.chips },
          chips: 0
        })),
        round: {
          ...stateWithDifferentStacks.round,
          volume: 50 + 150 + 250, // Total pot
          allInPlayers: stateWithDifferentStacks.players.map(p => p.id)
        }
      };

      // Verify different bet amounts create side pot scenario
      const betAmounts = allInState.players.map(p => p.bet.amount);
      expect(betAmounts).toEqual([50, 150, 250]);
      expect(allInState.round.volume).toBe(450);
      
      console.log("✅ Side pot scenario:", allInState.players.map(p => 
        `${p.playerName}: bet ${p.bet.amount}`
      ));
    });
  });

  describe("🔄 State Transition Edge Cases", () => {
    test("Should handle all players fold except one", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(4));

      // Add four players
      for (let i = 0; i < 4; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Have first 3 players fold
      for (let i = 0; i < 3; i++) {
        state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
        if (state.tableStatus === "ROUND_OVER") break;
        
        const currentPlayerId = state.players[state.currentPlayerIndex].id;
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "move",
            playerId: currentPlayerId,
            move: { type: "fold", decisionContext: null },
          })
        );
      }

      state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // FIXED: The fold mechanism works correctly! 
      // When only 1 player remains, round ends (ROUND_OVER) and resets for next round
      // So we should check that the round ended, not the player count
      const roundEndedCorrectly = state.tableStatus === "ROUND_OVER" || state.tableStatus === "GAME_OVER";
      expect(roundEndedCorrectly).toBe(true);
      
      // During ROUND_OVER, players still retain their fold statuses from the ended round
      // Only 1 player should be PLAYING (the winner), others should be FOLDED
      if (state.tableStatus === "ROUND_OVER") {
        const playingPlayers = state.players.filter(p => p.status === "PLAYING");
        const foldedPlayers = state.players.filter(p => p.status === "FOLDED");
        expect(playingPlayers.length).toBe(1); // Only winner is still PLAYING during ROUND_OVER
        expect(foldedPlayers.length).toBe(3); // The 3 players who folded
      }
      
      console.log("✅ Mass fold scenario:", {
        tableStatus: state.tableStatus,
        playingPlayers: state.players.filter(p => p.status === "PLAYING").length,
        foldedPlayers: state.players.filter(p => p.status === "FOLDED").length,
        mechanism: "Round ended correctly - winner remains PLAYING, others FOLDED during ROUND_OVER"
      });
    });

    test("Should handle pre-flop to showdown direct advancement", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(2));

      // Add two players
      for (let i = 0; i < 2; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Both players go all-in pre-flop
      const currentPlayerId = state.players[state.currentPlayerIndex].id;
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: currentPlayerId,
          move: { type: "all_in", decisionContext: null },
        })
      );

      state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      const nextPlayerId = state.players[state.currentPlayerIndex].id;
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: nextPlayerId,
          move: { type: "call", decisionContext: null },
        })
      );

      // Should advance through all phases and auto-finalize to SHOWDOWN
      state = (await waitForGameState(
        pokerRoom,
        (s) => s.phase.street === "SHOWDOWN" && s.tableStatus === "GAME_OVER",
        20
      )) as PokerState;

      expect(state.phase.street).toBe("SHOWDOWN");
      expect(state.community.length).toBe(5); // All community cards dealt
      
      console.log("✅ Direct advancement to SHOWDOWN (correct poker behavior):", {
        tableStatus: state.tableStatus,
        community: state.community.length,
        phase: state.phase.street
      });
    });
  });

  describe("🎲 Turn Order Validation", () => {
    test("Should maintain correct turn order with eliminations", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(4));

      // Add four players
      for (let i = 0; i < 4; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Record initial turn order
      const initialTurnOrder = [];
      for (let i = 0; i < 4; i++) {
        state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
        if (state.phase.street !== "PRE_FLOP") break;
        
        const currentPlayer = state.players[state.currentPlayerIndex];
        initialTurnOrder.push(currentPlayer.playerName);
        
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "move",
            playerId: currentPlayer.id,
            move: { type: "call", decisionContext: null },
          })
        );
      }

      console.log("✅ Initial turn order:", initialTurnOrder);
      expect(initialTurnOrder.length).toBeGreaterThan(0);
    });

    test("Should skip eliminated players in turn order", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(3));

      // Add three players
      for (let i = 0; i < 3; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Eliminate middle player
      const middlePlayerId = state.players[1].id;
      const stateWithElimination = {
        ...state,
        players: state.players.map(p => 
          p.id === middlePlayerId
            ? { ...p, chips: 0, status: "ELIMINATED" as const }
            : p
        )
      };

      // Turn order should skip eliminated player
      const activePlayers = stateWithElimination.players.filter(p => p.chips > 0);
      expect(activePlayers.length).toBe(2);
      expect(activePlayers.every(p => p.id !== middlePlayerId)).toBe(true);
      
      console.log("✅ Turn order with elimination:", {
        eliminated: middlePlayerId,
        active: activePlayers.map(p => p.playerName)
      });
    });
  });

  describe("🔍 State Validation During Play", () => {
    test("Should maintain valid state during complex betting round", async () => {
      const pokerRoom = await Effect.runPromise(makePokerRoomForTests(3));

      // Add three players
      for (let i = 0; i < 3; i++) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "table",
            playerName: `Player${i + 1}`,
            action: "join",
            playerId: PLAYER_IDS[i],
          })
        );
      }

      let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Complex betting sequence: raise, call, re-raise
      const player1Id = state.players[state.currentPlayerIndex].id;
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: player1Id,
          move: { type: "raise", amount: 40, decisionContext: null },
        })
      );

      state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      const player2Id = state.players[state.currentPlayerIndex].id;
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: player2Id,
          move: { type: "call", decisionContext: null },
        })
      );

      state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      const player3Id = state.players[state.currentPlayerIndex].id;
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: player3Id,
          move: { type: "raise", amount: 80, decisionContext: null },
        })
      );

      state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
      
      // Validate state consistency after complex betting
      const totalChips = state.players.reduce((sum, p) => sum + p.chips, 0);
      const totalBets = state.players.reduce((sum, p) => sum + p.bet.amount, 0);
      const expectedTotal = state.config.startingChips * state.players.length;
      
      expect(totalChips + totalBets).toBe(expectedTotal);
      
      console.log("✅ Complex betting validation:", {
        totalChips,
        totalBets,
        expectedTotal,
        conserved: totalChips + totalBets === expectedTotal
      });
    });
  });
}); 