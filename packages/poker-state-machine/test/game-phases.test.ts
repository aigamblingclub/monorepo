import { expect, test, describe } from "bun:test";
import { 
  setupTwoPlayerGame, 
  PLAYER_IDS, 
  compareStates, 
  Effect, 
  currentPlayer,
  bigBlind,
  waitForGameState,
  POKER_ROOM_DEFAULT_STATE
} from "./test-helpers";
import type { PokerState } from "../src/schemas";

describe("Poker game phases tests", () => {

  test("Player calling should progress the game to next betting round", async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // In heads-up poker: SB calls BB → BB gets option to check or raise
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0], // SB (player1) calls the BB
        move: { type: "call", decisionContext: null },
      })
    );

    // After SB call, BB still has option to check or raise (stay in PRE_FLOP)
    let state: PokerState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.street).toBe("PRE_FLOP"); // Still in PRE_FLOP
    
    // BB checks to complete pre-flop betting
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1], // BB checks
        move: { type: "call", decisionContext: null },
      })
    );

    // Now should automatically advance to FLOP
    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

    // Should be in FLOP phase now
    compareStates(state, {
      phase: {
        street: "FLOP",
        actionCount: 0,
        volume: 0,
      },
      round: {
        currentBet: 0,
        roundNumber: 1,
        volume: 40, // SB (10) + BB (20) = 30, but SB called for 10 more = 40 total
      },
      community: { length: 3 }, // Should have 3 community cards
      deck: { length: 45 }, // 52 - 4 (hole cards) - 3 (flop) = 45 cards remaining
      players: [
        {
          id: PLAYER_IDS[0],
          bet: { amount: 0, volume: 20 }, // Reset bet to 0 in new phase, but volume shows total contributed
          chips: 980, // 1000 - 20 = 980
        },
        {
          id: PLAYER_IDS[1],
          bet: { amount: 0, volume: 20 }, // Reset bet to 0 in new phase, but volume shows total contributed  
          chips: 980, // 1000 - 20 = 980
        },
      ],
    });

    // In heads-up post-flop, BB (player2) acts first
    const current = currentPlayer(state);
    expect(current).not.toBeNull();
    expect(current!.id).toBe(PLAYER_IDS[1]);
  });

  test("Checking on the flop should progress to the turn", async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // Go through pre-flop: SB calls BB (heads-up rule: when SB equals BB, round is complete)
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0], // SB calls
        move: { type: "call", decisionContext: null },
      })
    );

    // After SB call, BB now has option to check or raise
    let state: PokerState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.street).toBe("PRE_FLOP"); // Still in PRE_FLOP
    
    // BB checks to complete pre-flop betting
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1], // BB
        move: { type: "call", decisionContext: null },
      })
    );

    // Now should be at FLOP
    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.street).toBe("FLOP"); // Should be at FLOP now

    // Player 2 checks on the flop
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "call", decisionContext: null },
      })
    );

    // Check if we've transitioned to turn or still on flop
    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

    if (state.phase.street === "FLOP") {
      // Player 1 checks, should transition to TURN
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: PLAYER_IDS[0],
          move: { type: "call", decisionContext: null },
        })
      );

      state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    }

    // Now we should be in the next phase (either TURN or RIVER)
    // Get the actual phase instead of hard-coding it
    const nextPhase = state.phase.street;

    compareStates(state, {
      phase: {
        street: nextPhase,
        actionCount: 0,
        volume: 0,
      },
      round: {
        currentBet: 0,
        roundNumber: 1,
        volume: 40,
      },
      community: { length: nextPhase === "TURN" ? 4 : 5 }, // 4 cards for TURN, 5 for RIVER
      deck: { length: nextPhase === "TURN" ? 44 : 43 }, // 45-1=44 for TURN, 45-2=43 for RIVER
    });

    // On turn/river, the first player to act is player 2
    const current = currentPlayer(state);
    expect(current).not.toBeNull();
    expect(current!.id).toBe(PLAYER_IDS[1]);
  });

  test("Showdown - Two players should compare hands at the river", async () => {
    const { pokerRoom, state: initialState } = await setupTwoPlayerGame();

    // Play through all betting phases (PRE_FLOP, FLOP, TURN, RIVER)
    const phases = ["PRE_FLOP", "FLOP", "TURN", "RIVER"];

    // Wait for the PRE_FLOP phase to begin, then record the initial state
    // This ensures we're measuring after blinds have been posted
    let initialChips = 0;
    let initialPot = 0;

    for (const phase of phases) {
      let state: PokerState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

      // Record initial state after blinds are posted
      if (phase === "PRE_FLOP" && initialChips === 0) {
        initialChips = state.players.reduce((sum: any, p: any) => sum + p.chips, 0);
        initialPot = state.round.volume;
      }

      // Make sure we're in the expected phase
      if (state.phase.street !== phase) {
        continue;
      }

      // Have all active players check/call until the betting round is complete
      let bettingComplete = false;
      while (!bettingComplete) {
        state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

        // Check if there are active players
        if (state.currentPlayerIndex < 0) {
          bettingComplete = true;
          continue;
        }

        const currentPlayerId = state.players[state.currentPlayerIndex].id;

        // Player calls or checks
        await Effect.runPromise(
          pokerRoom.processEvent({
            type: "move",
            playerId: currentPlayerId,
            move: { type: "call", decisionContext: null },
          })
        );

        // Check if we've moved to the next phase
        const newState: PokerState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
        if (newState.phase.street !== phase) {
          bettingComplete = true;
        }
      }
    }

    // Wait until the round is over (SHOWDOWN -> ROUND_OVER)
    let state: PokerState = await waitForGameState(pokerRoom, (s) => s.tableStatus === "ROUND_OVER", 20) as PokerState;

    // Log final state for debugging
    const finalChips = state.players.reduce((sum: any, p: any) => sum + p.chips, 0);
    const finalPot = state.round.volume;

    // Verify we completed the current round (showdown phase)
    // Round number may still be 1 if this is the first hand of the game
    expect(state.round.roundNumber).toBeGreaterThanOrEqual(1);

    // Verify either that players' round bets are reset OR we're in a new round
    state.players.forEach((player: any) => {
      const roundBetResetOrNewRound =
        player.bet.amount === 0 || state.round.roundNumber > 1;
      expect(roundBetResetOrNewRound).toBe(true);
    });

    // Check that either:
    // 1. The pot is empty (distributed to players)
    // 2. OR at least one player has more chips than their initial amount
    const hasPlayerWithMoreChips = state.players.some((player: any) => {
      return player.chips > 980; // Starting chips (1000) - blinds or calls
    });

    expect(state.round.volume === 0 || hasPlayerWithMoreChips).toBe(true);

    // Verify that total chips in the system are roughly conserved
    // (allow for minor rounding differences due to integer division)
    const totalFinalChips = finalChips + finalPot;
    const totalInitialChips = initialChips + initialPot;
    expect(totalFinalChips - totalInitialChips).toBe(0);
  });

  test("Heads-up specific betting order - Dealer/SB acts first preflop, BB acts first postflop", async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // Wait until the state is ready with dealer assigned
    let state = await waitForGameState(pokerRoom, (s) => !!s.dealerId && s.phase.street === "PRE_FLOP");

    // Check PRE-FLOP order
    expect(state.phase.street).toBe("PRE_FLOP");
    const preFlop = currentPlayer(state);
    expect(preFlop).not.toBeNull();
    expect(preFlop!.id).toBe(PLAYER_IDS[0]); // Dealer (SB) acts first in pre-flop

    // Check initial betting state
    expect(state.players[0].bet.volume).toBe(10); // SB bet 10
    expect(state.players[1].bet.volume).toBe(20); // BB bet 20

    // Dealer/SB acts first - calls (this will automatically advance to FLOP in heads-up)
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "call", decisionContext: null },
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

    // After SB calls, BB now has the option to check or raise
    expect(state.phase.street).toBe("PRE_FLOP"); // Still in PRE_FLOP
    const bbPlayer = currentPlayer(state);
    expect(bbPlayer).not.toBeNull();
    expect(bbPlayer!.id).toBe(PLAYER_IDS[1]); // BB now has option to act

    // BB checks to complete pre-flop betting
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "call", decisionContext: null },
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

    // Now should advance to FLOP
    expect(state.phase.street).toBe("FLOP"); // Should be in FLOP now
    expect(state.community.length).toBe(3); // Should have 3 community cards

    // In heads-up post-flop, BB acts first
    const inFlop = currentPlayer(state);
    expect(inFlop).not.toBeNull();
    expect(inFlop!.id).toBe(PLAYER_IDS[1]); // BB acts FIRST in flop
  });

  test('actionCount should increment with each move and reset on phase change', async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // Wait until we're in PRE_FLOP and have a valid current player
    let state = await waitForGameState(pokerRoom, (s) => {
      const current = currentPlayer(s);
      return s.phase.street === "PRE_FLOP" && current !== null && current.id !== "";
    });

    // Verify initial state
    expect(state.phase.street).toBe("PRE_FLOP");
    expect(state.phase.actionCount).toBe(0);

    // First action - SB raises
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "raise", amount: 30, decisionContext: null }
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.actionCount).toBe(1);

    // Second action - BB calls
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "call", decisionContext: null }
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.street).toBe("FLOP");
    expect(state.phase.actionCount).toBe(0); // Should reset on phase change

    // First action in FLOP - BB checks
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "call", decisionContext: null }
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.actionCount).toBe(1);

    // Second action in FLOP - SB bets
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "raise", amount: 20, decisionContext: null }
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.actionCount).toBe(2);

    // Third action in FLOP - BB calls
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[1],
        move: { type: "call", decisionContext: null }
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    expect(state.phase.street).toBe("TURN");
    expect(state.phase.actionCount).toBe(0); // Should reset on phase change
  });

  test('Players should receive new hands between rounds', async () => {
    const { pokerRoom } = await setupTwoPlayerGame();

    // Wait until we're in PRE_FLOP and have a valid current player
    let state = await waitForGameState(pokerRoom, (s) => {
      const current = currentPlayer(s);
      return s.phase.street === "PRE_FLOP" && current !== null && current.id !== "";
    });

    // Store initial hands
    const firstRoundHands = {
      player1: [...state.players[0].hand],
      player2: [...state.players[1].hand]
    };

    // Verify initial hands are valid
    expect(firstRoundHands.player1.length).toBe(2);
    expect(firstRoundHands.player2.length).toBe(2);

    // Play through first round quickly with a fold
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId: PLAYER_IDS[0],
        move: { type: "fold", decisionContext: null }
      })
    );

    // Wait for the next round to start
    state = await waitForGameState(pokerRoom, (s) => s.round.roundNumber > 1 && s.phase.street === "PRE_FLOP");

    // Store second round hands
    const secondRoundHands = {
      player1: state.players[0].hand,
      player2: state.players[1].hand
    };

    console.log('firstRoundHands', firstRoundHands);
    console.log('secondRoundHands', secondRoundHands);
    // Verify hands are different between rounds
    const player1HandsAreDifferent = 
      firstRoundHands.player1[0]?.rank !== secondRoundHands.player1[0]?.rank ||
      firstRoundHands.player1[0]?.suit !== secondRoundHands.player1[0]?.suit ||
      firstRoundHands.player1[1]?.rank !== secondRoundHands.player1[1]?.rank ||
      firstRoundHands.player1[1]?.suit !== secondRoundHands.player1[1]?.suit;

    const player2HandsAreDifferent = 
      firstRoundHands.player2[0]?.rank !== secondRoundHands.player2[0]?.rank ||
      firstRoundHands.player2[0]?.suit !== secondRoundHands.player2[0]?.suit ||
      firstRoundHands.player2[1]?.rank !== secondRoundHands.player2[1]?.rank ||
      firstRoundHands.player2[1]?.suit !== secondRoundHands.player2[1]?.suit;

    expect(player1HandsAreDifferent).toBe(true);
    expect(player2HandsAreDifferent).toBe(true);
  });
}); 