import { expect } from "bun:test";
import { PLAYER_DEFAULT_STATE, POKER_ROOM_DEFAULT_STATE } from "../src/state_machine";
import { bigBlind, currentPlayer, firstPlayerIndex, smallBlind } from "../src/queries";
import { Effect } from "effect";
import { makePokerRoomForTests } from "../src/room";
import { TEST_SCENARIOS, resetTestDeck } from "../src/poker";
import type { GameEvent, Phase, PlayerState, PokerState, RoundState, SystemEvent } from "../src/schemas";

// Unique player IDs to avoid duplication issues (supports up to 6 players)
export const PLAYER_IDS = ["player1", "player2", "player3", "player4", "player5", "player6"];

// REFACTORED: Ultra-robust test environment setup
export function setupTestEnvironment() {
  console.log(`🧹 setupTestEnvironment: Starting environment cleanup`);
  
  // AGGRESSIVE CLEANUP: Remove all poker-related environment variables
  const pokerEnvVars = [
    'POKER_TEST_SCENARIO',
    'POKER_DETERMINISTIC_CARDS',
    'AUTO_RESTART_ENABLED',
    'AUTO_RESTART_DELAY',
    'START_SLEEP_TIME',
    'ROUND_OVER_DELAY_MS'
  ];
  
  pokerEnvVars.forEach(envVar => {
    delete process.env[envVar];
  });
  
  // SET DEFAULTS: Explicitly configure for test environment
  process.env.POKER_DETERMINISTIC_CARDS = "false";
  process.env.AUTO_RESTART_ENABLED = "true";
  process.env.AUTO_RESTART_DELAY = "30000"; // 30 seconds
  process.env.START_SLEEP_TIME = "0"; // No delay
  process.env.ROUND_OVER_DELAY_MS = "50"; // Fast for tests
  
  // RESET STATE: Aggressively clean deck state
  resetTestDeck();
  
  // VALIDATION: Ensure environment is clean
  const finalMode = process.env.POKER_DETERMINISTIC_CARDS;
  if (finalMode !== "false") {
    console.error(`❌ Failed to disable deterministic cards! Current value: ${finalMode}`);
    throw new Error("Test environment setup failed: could not disable deterministic cards");
  }
  
  console.log(`✅ Test environment ready: random cards, auto-restart enabled`);
}

// Set up deterministic cards with specific scenario (for tests that need predictable outcomes)
export function setupDeterministicTest(scenario: keyof typeof TEST_SCENARIOS) {
  setupTestEnvironment();
  process.env.POKER_DETERMINISTIC_CARDS = "true";
  process.env.POKER_TEST_SCENARIO = scenario;
  console.log(`🎯 Setting up deterministic cards with scenario: ${scenario}`);
  
  // Return cleanup function to be called after test
  return function cleanupDeterministicTest() {
    console.log(`🧹 Cleaning up deterministic test scenario: ${scenario}`);
    // Force reset to random mode
    process.env.POKER_DETERMINISTIC_CARDS = "false";
    delete process.env.POKER_TEST_SCENARIO;
    
    // Force reset deck for next test
    resetTestDeck();
  };
}

// Setup test environment with auto-restart disabled (for tests that need to validate GAME_OVER state)
export function setupTestEnvironmentWithoutAutoRestart() {
  setupTestEnvironment();
  process.env.AUTO_RESTART_ENABLED = "false"; // Completely disable auto-restart
  console.log(`🛑 Auto-restart disabled for this test`);
}

// Helper function to create a test player
export function createPlayer(
  id: string,
  chips = 1000, // Use 1000 chips in tests to ensure enough for multiple rounds
  status: "PLAYING" | "FOLDED" | "ALL_IN" = "PLAYING"
): PlayerState {
  return {
    ...PLAYER_DEFAULT_STATE,
    id,
    chips,
    playerName: `Player ${id}`,
    status,
  };
}

// Define the expected state shape with proper typing for partial objects
export type ExpectedState = {
  tableStatus?: PokerState["tableStatus"];
  players?: Partial<PlayerState>[];
  currentPlayerIndex?: number;
  deck?: { length: number };
  community?: { length: number };
  pot?: number;
  phase?: Partial<Phase>;
  round?: Partial<RoundState>;
  dealerId?: string;
  winner?: string | null;
  config?: PokerState["config"];
};

// Helper function to create a more flexible assertion for comparing state objects
// Allowing partial matches to reduce test brittleness
export function compareStates(actual: PokerState, expected: ExpectedState): void {
  // For each key in expected, check if the actual value matches
  for (const [key, value] of Object.entries(expected)) {
    if (key === "players") {
      // Special handling for players array
      const expectedPlayers = value as Partial<PlayerState>[];
      expect(actual.players.length).toBe(expectedPlayers.length);

      for (let i = 0; i < expectedPlayers.length; i++) {
        const expectedPlayer = expectedPlayers[i];
        const actualPlayer = actual.players[i];

        // For each player, check the specified properties
        for (const [playerKey, playerValue] of Object.entries(
          expectedPlayer
        )) {
          if (playerKey === "hand") {
            // For hand, just verify the length if specified
            if (playerValue) {
              expect(actualPlayer.hand.length).toBe(
                (playerValue as any).length
              );
            }
          } else {
            expect(actualPlayer[playerKey as keyof PlayerState]).toEqual(
              playerValue
            );
          }
        }
      }
    } else if (key === "community") {
      // For community cards, just verify the length if specified
      if (value && typeof value === "object" && "length" in value) {
        expect(actual.community.length).toBe(value.length);
      }
    } else if (key === "deck") {
      // For deck, just verify the length if specified
      if (value && typeof value === "object" && "length" in value) {
        // Allow explicit numbers or use expect.any() for more flexibility
        if (typeof value.length === "number") {
          expect(actual.deck.length).toBe(value.length);
        } else {
          // For expect.any(), just check that the deck has cards
          expect(actual.deck.length).toBeGreaterThan(0);
        }
      }
    } else if (key === "round") {
      // Special handling for round object, which needs full type safety
      const expectedRound = value as Partial<RoundState>;
      for (const [roundKey, roundValue] of Object.entries(expectedRound)) {
        expect(actual.round[roundKey as keyof RoundState]).toEqual(
          roundValue
        );
      }
    } else {
      // For all other properties, do direct comparison
      expect(actual[key as keyof PokerState]).toEqual(value as any);
    }
  }
}

// Helper function to wait for game state to reach certain conditions
export async function waitForGameState(
  pokerRoom: any,
  condition: (state: PokerState) => boolean,
  maxAttempts: number = 20
): Promise<PokerState> {
  let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
  let attempts = 0;

  while (!condition(state) && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 100));
    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
  }

  if (attempts >= maxAttempts) {
    console.log(`⚠️  waitForGameState timed out after ${maxAttempts} attempts`);
    console.log(`Current state: tableStatus=${state.tableStatus}, phase=${state.phase.street}`);
  }

  return state;
}

// Helper function to wait for PRE_FLOP phase with valid current player
export async function waitForPreFlopReady(pokerRoom: any): Promise<PokerState> {
  return waitForGameState(pokerRoom, (state) => {
    const current = currentPlayer(state);
    return state.phase.street === "PRE_FLOP" && current !== null && current.id !== "";
  });
}

// Helper function to setup a basic 2-player game with deterministic cards
export async function setupDeterministicTwoPlayerGame(
  scenario: keyof typeof TEST_SCENARIOS = "ELIMINATION"
): Promise<{ pokerRoom: any, state: PokerState, cleanup: () => void }> {
  const cleanup = setupDeterministicTest(scenario);
  const pokerRoom = await Effect.runPromise(makePokerRoomForTests(2));

  // Player 1 joins
  await Effect.runPromise(
    pokerRoom.processEvent({
      type: "table",
      action: "join",
      playerId: PLAYER_IDS[0],
      playerName: PLAYER_IDS[0],
    })
  );

  // Player 2 joins
  await Effect.runPromise(
    pokerRoom.processEvent({
      type: "table",
      action: "join",
      playerId: PLAYER_IDS[1],
      playerName: PLAYER_IDS[1],
    })
  );

  const state = await waitForPreFlopReady(pokerRoom);
  console.log(`🃏 Game setup complete with scenario "${scenario}":`, {
    player1Cards: state.players[0].hand,
    player2Cards: state.players[1].hand,
    player1Chips: state.players[0].chips,
    player2Chips: state.players[1].chips,
  });
  
  return { pokerRoom, state, cleanup };
}

// Helper to force a player to have minimal chips for fast elimination
// Note: This is primarily for demonstration - in real tests, use deterministic scenarios
export async function setupPlayerWithMinimalChips(
  pokerRoom: any,
  playerId: string,
  chips: number = 30
): Promise<PokerState> {
  console.log(`💰 Note: In deterministic tests, use scenarios like 'ELIMINATION' instead of manually adjusting chips`);
  console.log(`💰 Target: Set ${playerId} to ${chips} chips for elimination testing`);
  
  // Return current state - manual chip adjustment should be done through game mechanics
  const state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
  return state;
}


  export async function playUntilElimination(
  pokerRoom: any,
  maxRounds: number = 15,
  logProgress: boolean = false
): Promise<{ finalState: PokerState; roundsPlayed: number; eliminatedPlayer: string | null; }> {
  let roundsPlayed = 0;
  let consecutiveSameChips = 0;
  let lastChipState: Record<string, number> = {};
  let state: PokerState;

  while (roundsPlayed < maxRounds) {
    roundsPlayed++;
    
    if (logProgress) {
      console.log(`
🎮 ============ ROUND ${roundsPlayed} ============`);
    }
    
    await playOneRoundFast(pokerRoom, logProgress);
      
    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    const activePlayers = state.players.filter(p => p.chips > 0);
    const eliminatedPlayers = state.players.filter(p => p.chips === 0);
      
    const currentChips = Object.fromEntries(state.players.map(p => [p.id, p.chips]));
      
    if (JSON.stringify(currentChips) === JSON.stringify(lastChipState)) {
      consecutiveSameChips++;
      if (consecutiveSameChips >= 3) {
        if (logProgress) console.log("🚨 LOOP DETECTED: Ending game.");
        return {
          finalState: state,
          roundsPlayed,
          eliminatedPlayer: eliminatedPlayers.length > 0 ? eliminatedPlayers[0].id : null
        };
      }
    } else {
      consecutiveSameChips = 0;
    }
    lastChipState = currentChips;
      
    if (logProgress) {
      console.log(`💰 Chips: ${activePlayers.map(p => `${p.id}=${p.chips}`).join(', ')}`);
    }
      
    if (activePlayers.length <= 1) {
      return {
        finalState: state,
        roundsPlayed,
        eliminatedPlayer: eliminatedPlayers.length > 0 ? eliminatedPlayers[0].id : null
      };
    }
  }
  
  state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
  const eliminated = state.players.filter(p => p.chips === 0);
  return {
    finalState: state,
    roundsPlayed,
    eliminatedPlayer: eliminated.length > 0 ? eliminated[0].id : null
  };
}

// SIMPLIFIED ROUND PLAY: Fast and aggressive to force elimination
async function playOneRoundFast(pokerRoom: any, logProgress: boolean = false): Promise<void> {
  let actionCount = 0;
  const maxActions = 20; // Prevent infinite betting loops
  
  while (actionCount < maxActions) {
    actionCount++;
    
    let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
    
        // Check if round is complete
    if (state.tableStatus === "ROUND_OVER" || state.tableStatus === "GAME_OVER" || state.phase?.street === "SHOWDOWN") {
      if (logProgress) console.log("🎯 Round complete");
      return;
    }

    // Get current player
    if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.players.length) {
      if (logProgress) console.log("❓ No current player - ending round");
      return;
    }
    
    const currentPlayerState = state.players[state.currentPlayerIndex];
    const currentBet = state.round.currentBet;
    const amountOwed = currentBet - currentPlayerState.bet.amount;
    
    // Make more aggressive decisions to create chip movement
    let move: any;
    
    if (amountOwed > 0) {
      // Player owes chips - decide between call, raise, or fold
      if (currentPlayerState.chips <= amountOwed + 15) {
        // Very low on chips - go all-in most of the time
        if (Math.random() < 0.8) {
          move = { type: "all_in", decisionContext: null };
          if (logProgress) console.log(`🚀 ${currentPlayerState.id} ALL-IN with ${currentPlayerState.chips} chips`);
        } else {
          move = { type: "fold", decisionContext: null };
          if (logProgress) console.log(`❌ ${currentPlayerState.id} FOLD`);
        }
      } else if (Math.random() < 0.6) {
        // 60% chance to call
        move = { type: "call", decisionContext: null };
        if (logProgress) console.log(`💰 ${currentPlayerState.id} CALL ${amountOwed}`);
      } else {
        // 40% chance to fold when facing large bets relative to stack
        const betSizeRelativeToStack = amountOwed / currentPlayerState.chips;
        if (betSizeRelativeToStack > 0.5) {
          move = { type: "fold", decisionContext: null };
          if (logProgress) console.log(`❌ ${currentPlayerState.id} FOLD (big bet relative to stack)`);
        } else {
          move = { type: "call", decisionContext: null };
          if (logProgress) console.log(`💰 ${currentPlayerState.id} CALL ${amountOwed}`);
        }
      }
    } else {
      // Player doesn't owe chips - can check or raise
      if (Math.random() < 0.5) {
        // 50% chance to check
        move = { type: "call", decisionContext: null }; // Will auto-convert to check
        if (logProgress) console.log(`✓ ${currentPlayerState.id} CHECK`);
      } else {
        // 50% chance to raise aggressively
        const raiseAmount = Math.min(80, Math.floor(currentPlayerState.chips * 0.4));
        if (raiseAmount > 5) {
          move = { type: "raise", amount: raiseAmount, decisionContext: null };
          if (logProgress) console.log(`📈 ${currentPlayerState.id} aggressive RAISE ${raiseAmount}`);
        } else {
          move = { type: "call", decisionContext: null };
          if (logProgress) console.log(`✓ ${currentPlayerState.id} CHECK`);
        }
      }
    }
    
    try {
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "move",
          playerId: currentPlayerState.id,
          move,
        })
      );
    } catch (error) {
      if (logProgress) console.log(`❌ Move failed: ${error}`);
      break;
    }
  }
  
  if (actionCount >= maxActions) {
    if (logProgress) console.log("⚠️ Max actions reached, forcing round end");
  }
}

// Helper function to setup a basic 2-player game
export async function setupTwoPlayerGame(): Promise<{ pokerRoom: any, state: PokerState }> {
  setupTestEnvironment();
  const pokerRoom = await Effect.runPromise(makePokerRoomForTests(2));

  // Both players join
  await Effect.runPromise(
    pokerRoom.processEvent({
      type: "table",
      action: "join",
      playerId: PLAYER_IDS[0],
      playerName: PLAYER_IDS[0],
    })
  );

  await Effect.runPromise(
    pokerRoom.processEvent({
      type: "table",
      action: "join",
      playerId: PLAYER_IDS[1],
      playerName: PLAYER_IDS[1],
    })
  );

  const state = await waitForPreFlopReady(pokerRoom);
  return { pokerRoom, state };
}

// Helper function to setup a 3-player game
export async function setupThreePlayerGame(): Promise<{ pokerRoom: any, state: PokerState }> {
  setupTestEnvironment();
  const pokerRoom = await Effect.runPromise(makePokerRoomForTests(3));

  // All players join
  for (let i = 0; i < 3; i++) {
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "table",
        action: "join",
        playerId: PLAYER_IDS[i],
        playerName: PLAYER_IDS[i],
      })
    );
  }

  const state = await waitForPreFlopReady(pokerRoom);
  return { pokerRoom, state };
}

// Helper function to play through a betting round
export async function playBettingRound(pokerRoom: any, moves: { playerId: string, move: any }[]): Promise<PokerState> {
  for (const { playerId, move } of moves) {
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "move",
        playerId,
        move,
      })
    );
  }
  return await Effect.runPromise(pokerRoom.currentState()) as PokerState;
}

// Helper function to advance to a specific phase
export async function advanceToPhase(pokerRoom: any, targetPhase: string): Promise<PokerState> {
  const phases = ["PRE_FLOP", "FLOP", "TURN", "RIVER"];
  let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

  while (state.phase.street !== targetPhase && phases.includes(state.phase.street)) {
    // Have all active players check/call until the betting round is complete
    let bettingComplete = false;
    let attempts = 0;

    while (!bettingComplete && attempts < 10) {
      attempts++;
      try {
        state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;

        // Check if there are any players who can still act
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
        const newState = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
        if (newState.phase.street !== state.phase.street) {
          bettingComplete = true;
          state = newState;
        }
      } catch (error) {
        // If there's an error, we might be trying to act when no more action is needed
        bettingComplete = true;
      }
    }
  }

  return state;
}

// Re-export commonly used functions
export { Effect, makePokerRoomForTests, currentPlayer, bigBlind, smallBlind, firstPlayerIndex };
export { PLAYER_DEFAULT_STATE, POKER_ROOM_DEFAULT_STATE }; 