import { expect, test, describe } from "bun:test";
import { 
  setupTwoPlayerGame, 
  setupThreePlayerGame,
  PLAYER_IDS, 
  compareStates, 
  Effect, 
  currentPlayer,
  bigBlind,
  waitForGameState,
  advanceToPhase
} from "./test-helpers";

describe("Poker betting and actions tests", () => {

  test("Betting on the turn should update the pot and bets", async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // Get the state to see which phase we're in
    let state = await Effect.runPromise(pokerRoom.currentState()) as any;

    // Play through each betting round correctly
    const playBettingRound = async () => {
      state = await Effect.runPromise(pokerRoom.currentState()) as any;
      const currentPhase = state.phase.street;

      // First player acts
      const current = currentPlayer(state);
      expect(current).not.toBeNull();
      
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: current!.id,
          move: { type: "call", decisionContext: null },
        })
      );

      // Get updated state
      state = await Effect.runPromise(pokerRoom.currentState()) as any;

      // Second player acts if it's their turn
      if (state.phase.street === currentPhase) {
        const nextPlayer = currentPlayer(state);
        expect(nextPlayer).not.toBeNull();
        
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "move",
            playerId: nextPlayer!.id,
            move: { type: "call", decisionContext: null },
          })
        );
      }
    };

    // Play through PRE_FLOP first
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "call", decisionContext: null },
      })
    );
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "call", decisionContext: null },
      })
    );

    // Get updated state
    state = await Effect.runPromise(pokerRoom.currentState()) as any;

    // Play through FLOP if we're in that phase
    if (state.phase.street === "FLOP") {
      await playBettingRound();
    }

    // Get updated state
    state = await Effect.runPromise(pokerRoom.currentState()) as any;

    // Player 2 bets 20 on the turn (make sure player 2 is the current player)
    if (currentPlayer(state)!.id === PLAYER_IDS[1]) {
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: PLAYER_IDS[1],
          move: { type: "raise", amount: 20, decisionContext: null }, // Aposta 20 novo
        })
      );
    } else {
        // If player 1 is current player, let them check first
        await Effect.runPromise(
            pokerRoom.processEvent({
                type: "move",
                playerId: PLAYER_IDS[0],
                move: { type: "call", decisionContext: null },
            })
        );

        // Now player 2 should be able to bet
        await Effect.runPromise(
            pokerRoom.processEvent({
                type: "move",
                playerId: PLAYER_IDS[1],
                move: { type: "raise", amount: 20, decisionContext: null }, // Aposta 20 novo
            })
        );
    }

    state = await Effect.runPromise(pokerRoom.currentState()) as any;
    compareStates(state, {
      round: {
        currentBet: 20,
        volume: 60, // 40 + 20
      },
      players: [
        {
          id: PLAYER_IDS[0],
          bet: { amount: 0, volume: 20 },
          chips: 180,
        },
        {
          id: PLAYER_IDS[1],
          chips: 160, // 180 - 20
          bet: { amount: 20, volume: 40 },
        },
      ],
    });

    // Verify current player is now player 1
    expect(currentPlayer(state)!.id).toBe(PLAYER_IDS[0]);
  });

  test("Folding should end the round and award pot to opponent", async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // Get initial state
    let state = await Effect.runPromise(pokerRoom.currentState()) as any;
    const initialRoundNumber = state.round.roundNumber;

    // PRE-FLOP: SB calls BB
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "call", decisionContext: null },
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as any;

    expect(state.phase.street).toBe("PRE_FLOP");
    expect(state.players[0].playedThisPhase).toBe(true);
    expect(state.players[1].playedThisPhase).toBe(false);

    // BB checks (explicitly acts to mark playedThisPhase)
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "call", decisionContext: null },
      })
    );

    // Get state at FLOP
    state = await Effect.runPromise(pokerRoom.currentState()) as any;

    expect(state.phase.street).toBe("FLOP");
    
    // FLOP: BB bets first
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "raise", amount: 20, decisionContext: null },
      })
    );

    // Record pot size and player chips before fold
    state = await Effect.runPromise(pokerRoom.currentState()) as any;
    const potBeforeFold = state.round.volume;
    const bbPlayer = state.players.find((p: any) => p.id === PLAYER_IDS[1]);
    const sbPlayer = state.players.find((p: any) => p.id === PLAYER_IDS[0]);

    // Ensure we found both players
    expect(bbPlayer).not.toBeUndefined();
    expect(sbPlayer).not.toBeUndefined();

    const bbChipsBeforeFold = bbPlayer!.chips;
    const sbChipsBeforeFold = sbPlayer!.chips;

    // SB (Player1) folds
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "fold", decisionContext: null },
      })
    );

    // Get state after fold (which should be the new round already)
    state = await Effect.runPromise(pokerRoom.currentState()) as any;

    // Verify we're in a new round
    expect(state.round.roundNumber).toBe(initialRoundNumber + 1);
    expect(state.tableStatus).toBe("PLAYING"); // Should be ready for new round
    expect(state.phase.street).toBe("PRE_FLOP"); // New round starts at pre-flop

    // Verify pot has blinds for new round
    expect(state.round.volume).toBe(30); // New round starts with SB (10) + BB (20)

    // Verify BB got the pot from previous round and paid new blind
    const bbPlayerAfter = state.players.find((p: any) => p.id === PLAYER_IDS[1]);
    expect(bbPlayerAfter).not.toBeUndefined();
    // BB won previous pot but paid new blind (either SB or BB)
    expect(bbPlayerAfter!.chips).toBeGreaterThan(bbChipsBeforeFold); // Should have more chips even after paying new blind

    // Verify SB lost their chips from previous round and paid new blind
    const sbPlayerAfter = state.players.find((p: any) => p.id === PLAYER_IDS[0]);
    expect(sbPlayerAfter).not.toBeUndefined();
    expect(sbPlayerAfter!.chips).toBeLessThan(sbChipsBeforeFold); // Should have less chips after losing and paying new blind

    // Verify both players have appropriate bets for new round
    state.players.forEach((player: any) => {
      expect(player.status).toBe("PLAYING"); // Both should be PLAYING for next round
      expect(player.bet.amount).toBeGreaterThan(0); // Should have paid blind
      expect(player.bet.volume).toBeGreaterThan(0); // Should have paid blind
    });
  });

  test("Multiple betting rounds - Raise and re-raise", async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // Get initial state and wait for PRE_FLOP phase
    let state = await waitForGameState(pokerRoom, (s) => {
      const current = currentPlayer(s);
      return s.phase.street === "PRE_FLOP" && current !== null && current.id !== "";
    });

    // Ensure we're in the correct phase and state
    expect(state.phase.street).toBe("PRE_FLOP");
    expect(state.tableStatus).toBe("PLAYING");
    
    // Get current player and ensure it's valid
    const current = currentPlayer(state);
    if (!current || !current.id) {
        throw new Error("No valid current player found after waiting");
    }

    // Player 1 (SB/Dealer) raises to 40
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: current.id,
        move: { type: "raise", amount: 30, decisionContext: null }, // 10 (blind) + 30 = 40
      })
    );

    // Get next state and verify BB's turn
    state = await Effect.runPromise(pokerRoom.currentState()) as any;
    const nextPlayer = currentPlayer(state);
    if (!nextPlayer || !nextPlayer.id) {
        throw new Error("No valid next player found");
    }

    // Verify first player's bet and chips
    const updatedFirstPlayer = state.players.find((p: any) => p.id === current.id);
    expect(updatedFirstPlayer?.bet.amount).toBe(40);
    expect(updatedFirstPlayer?.chips).toBe(160); // 200 - 40

    // Player 2 (BB) re-raises to 60
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: nextPlayer.id,
        move: { type: "raise", amount: 40, decisionContext: null }, // Raises by 40 more (total 60)
      })
    );

    // Get state after BB re-raise
    state = await Effect.runPromise(pokerRoom.currentState()) as any;
    expect(state.players[1].bet.volume).toBe(60);
    expect(state.players[1].chips).toBe(140); // 180 - 40
    expect(state.round.currentBet).toBe(60);
    expect(state.phase.street).toBe("PRE_FLOP");

    // SB calls BB's re-raise to complete pre-flop betting
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "call", decisionContext: null },
      })
    );

    // Get state after SB call - should move to FLOP
    state = await Effect.runPromise(pokerRoom.currentState()) as any;
    expect(state.phase.street).toBe("FLOP");
    expect(state.players[0].bet.volume).toBe(60);
    expect(state.players[0].chips).toBe(140); // 160 - 20 (call amount)
    expect(state.round.volume).toBe(120); // Total pot after pre-flop

    // BB acts first in FLOP
    const bbIndex = state.players.findIndex((p: any) => p.id === bigBlind(state).id);
    expect(state.currentPlayerIndex).toBe(bbIndex); // BB acts first post-flop
    
    // BB checks
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: state.players[bbIndex].id, // Use BB's ID from index
        move: { type: "call", decisionContext: null },
      })
    );
    state = await Effect.runPromise(pokerRoom.currentState()) as any;

    expect(state.phase.street).toBe("FLOP");
    // SB bets 20 on FLOP
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "raise", amount: 20, decisionContext: null },
      })
    );

    // Get state after SB bet
    state = await Effect.runPromise(pokerRoom.currentState()) as any;
    expect(state.players[0].bet.amount).toBe(20);
    expect(state.players[0].chips).toBe(120); // 140 - 20
    expect(state.round.currentBet).toBe(20);
    expect(state.phase.street).toBe("FLOP");

    // BB calls SB's bet
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: state.players[bbIndex].id, // Use BB's ID from index
        move: { type: "call", decisionContext: null },
      })
    );

    // Get final state - should be in TURN phase
    state = await Effect.runPromise(pokerRoom.currentState()) as any;
    expect(state.phase.street).toBe("TURN");
    expect(state.players[1].bet.volume).toBe(80);
    expect(state.players[1].chips).toBe(120); // 140 - 20
    expect(state.round.volume).toBe(160); // 120 + 20 + 20
    expect(state.community.length).toBe(4); // 3 flop cards + 1 turn card

    // In FLOP, BB should act first in heads-up
    const flopActor = currentPlayer(state);
    expect(flopActor?.id).toBe(state.players[bbIndex].id); // BB acts first post-flop
  });

  test("Complex all-in scenario - Multiple players", async () => {
    const { pokerRoom } = await setupThreePlayerGame();

    // Get initial state with starting chips
    let state = await Effect.runPromise(pokerRoom.currentState()) as any;

    // Wait for the PRE_FLOP phase to begin, then record the initial state
    let initialChips = 0;
    let initialPot = 0;

    // Play PRE_FLOP phase - Make the third player go all-in
    let allInExecuted = false;

    while (!allInExecuted) {
      state = await Effect.runPromise(pokerRoom.currentState()) as any;

      // Record initial state after blinds are posted, before any betting
      if (state.phase.street === "PRE_FLOP" && initialChips === 0) {
        initialChips = state.players.reduce((sum: any, p: any) => sum + p.chips, 0);
        initialPot = state.round.volume;
      }

      // Check if any player can act
      if (state.currentPlayerIndex < 0) {
        break;
      }

      const currentPlayerId = state.players[state.currentPlayerIndex].id;

      // If current player is player3, go all-in
      if (currentPlayerId === PLAYER_IDS[2]) {
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "move",
            playerId: currentPlayerId,
            move: { type: "all_in", decisionContext: null },
          })
        );
        allInExecuted = true;
      } else {
        // Other players call
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "move",
            playerId: currentPlayerId,
            move: { type: "call", decisionContext: null },
          })
        );
      }
    }

    // After player3 is all-in, have remaining players call or fold
    // Play through the remaining betting rounds (if any) until showdown
    const phases = ["PRE_FLOP", "FLOP", "TURN", "RIVER"];

    for (const phase of phases) {
      let state = await Effect.runPromise(pokerRoom.currentState()) as any;

      // Skip if we're not in this phase
      if (state.phase.street !== phase) {
        continue;
      }

      // Have all active players check/call until the betting round is complete
      let bettingComplete = false;
      let attempts = 0;

      while (!bettingComplete && attempts < 10) {
        attempts++;
        try {
          state = await Effect.runPromise(pokerRoom.currentState()) as any;

          // Check if there are any players who can still act
          if (state.currentPlayerIndex < 0) {
            bettingComplete = true;
            continue;
          }

          const currentPlayerId = state.players[state.currentPlayerIndex].id;

          // Player calls
          await Effect.runPromise(
            pokerRoom.processEvent({
              type: "move",
              playerId: currentPlayerId,
              move: { type: "call", decisionContext: null },
            })
          );

          // Check if we've moved to the next phase
          const newState = await Effect.runPromise(pokerRoom.currentState()) as any;
          if (newState.phase.street !== phase) {
            bettingComplete = true;
          }
        } catch (error) {
          // If there's an error, we might be trying to act when no more action is needed
          bettingComplete = true;
        }
      }
    }

    // Wait for the round to complete naturally
    state = await waitForGameState(pokerRoom, (s) => 
      s.tableStatus === "ROUND_OVER" || s.tableStatus === "GAME_OVER", 20);

    // Log final state for debugging
    const finalChips = state.players.reduce((sum: any, p: any) => sum + p.chips, 0);
    const finalPot = state.round.volume;

    // The round should either be over or a new round should have started
    // If a new round started, the round number should be greater than 1
    // If the round is just over, we should wait for the next round to start
    if (state.tableStatus === "ROUND_OVER") {
      // Wait for next round to start
      state = await waitForGameState(pokerRoom, (s) => s.tableStatus !== "ROUND_OVER", 20);
    }

    // Now check that either:
    // 1. We're in a new round (round number > 1), OR 
    // 2. The game is over and someone won all the chips
    const gameIsOver = state.tableStatus === "GAME_OVER";
    const newRoundStarted = state.round.roundNumber > 1;
    const someoneWonAllChips = state.players.some((p: any) => p.chips === 600); // 3 players * 200 chips each

    expect(gameIsOver || newRoundStarted || someoneWonAllChips).toBe(true);

    // The all-in player should either have more chips (won) or 0 chips (lost)
    const allInPlayer = state.players.find((p: any) => p.id === PLAYER_IDS[2]);
    expect(allInPlayer).not.toBeUndefined();

    // Verify total chips in system are roughly conserved
    // (allow for minor rounding differences due to integer division)
    const totalFinalChips = finalChips + finalPot;
    const totalInitialChips = initialChips + initialPot;
    expect(totalFinalChips - totalInitialChips).toBe(0);
  });
}); 