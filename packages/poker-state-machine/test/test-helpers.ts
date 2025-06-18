import { expect } from "bun:test";
import { PLAYER_DEFAULT_STATE, POKER_ROOM_DEFAULT_STATE } from "../src/state_machine";
import { bigBlind, currentPlayer, firstPlayerIndex, smallBlind } from "../src/queries";
import { Effect } from "effect";
import { makePokerRoomForTests } from "../src/room";
import type { GameEvent, Phase, PlayerState, PokerState, RoundState, SystemEvent } from "../src/schemas";

// Unique player IDs to avoid duplication issues
export const PLAYER_IDS = ["player1", "player2", "player3"];

// Test environment setup
export function setupTestEnvironment() {
  // set the environment variable to true to enable auto restart
  process.env.AUTO_RESTART_ENABLED = "true";
  // set the START_SLEEP_TIME to 0 to avoid waiting for 2 minutes
  process.env.START_SLEEP_TIME = "0";
}

// Helper function to create a test player
export function createPlayer(
  id: string,
  chips = 200,
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
  maxAttempts: number = 10
): Promise<PokerState> {
  let state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
  let attempts = 0;

  while (!condition(state) && attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 50));
    state = await Effect.runPromise(pokerRoom.currentState()) as PokerState;
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

// Helper function to setup a basic 2-player game
export async function setupTwoPlayerGame(): Promise<{ pokerRoom: any, state: PokerState }> {
  setupTestEnvironment();
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