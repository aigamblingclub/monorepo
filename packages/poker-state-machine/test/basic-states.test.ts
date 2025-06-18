import { expect, test, describe } from "bun:test";
import { 
  setupTestEnvironment, 
  PLAYER_IDS, 
  compareStates, 
  Effect, 
  makePokerRoomForTests,
  currentPlayer,
  bigBlind,
  smallBlind,
  firstPlayerIndex 
} from "./test-helpers";

describe("Poker basic states tests", () => {
  setupTestEnvironment();

  test("Initial state should be empty waiting state", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(2));
    const state = await Effect.runPromise(pokerRoom.currentState());

    // Initial state verification
    expect(state.tableStatus).toEqual("WAITING");
    expect(state.players.length).toEqual(0);
    expect(state.phase).toEqual({
      street: "PRE_FLOP",
      actionCount: 0,
      volume: 0,
    });
    expect(state.round).toEqual({
      roundNumber: 1,
      currentBet: 0,
      volume: 0,
      foldedPlayers: [],
      allInPlayers: [],
    });
    expect(state.community).toEqual([]);
    expect(state.deck).toEqual([]);
  });

  test("Player 1 joining should update state correctly", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(2));

    // Step 1: Player 1 joins
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "table",
        playerName: PLAYER_IDS[0],
        action: "join",
        playerId: PLAYER_IDS[0],
      })
    );

    const state = await Effect.runPromise(pokerRoom.currentState());
    compareStates(state, {
      tableStatus: "WAITING",
      players: [
        {
          id: PLAYER_IDS[0],
          status: "PLAYING",
          chips: 200,
          playerName: PLAYER_IDS[0],
          hand: [],
          bet: { amount: 0, volume: 0 },
        },
      ],
    });
  });

  test("Two players joining should start the game", async () => {
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

    const state = await Effect.runPromise(pokerRoom.currentState());
    compareStates(state, {
      tableStatus: "PLAYING",
      phase: {
        street: "PRE_FLOP",
        actionCount: 0,
        volume: 30, // Small blind (10) + Big blind (20)
      },
      round: {
        roundNumber: 1,
        currentBet: 20,
        volume: 30, // Small blind (10) + Big blind (20)
      },
      players: [
        {
          id: PLAYER_IDS[0],
          status: "PLAYING",
          chips: 190, // 200 - 10 total
          bet: { amount: 10, volume: 10 },
          playerName: PLAYER_IDS[0],
          hand: [expect.any(Object), expect.any(Object)],
        },
        {
          id: PLAYER_IDS[1],
          status: "PLAYING",
          chips: 180,
          bet: { amount: 20, volume: 20 },
          playerName: PLAYER_IDS[1],
          hand: [expect.any(Object), expect.any(Object)],
        },
      ],
      community: { length: 0 },
      deck: { length: 48 }, // 52 cards - 4 cards dealt to players = 48 cards remaining
    });

    // Verify dealer and blinds are set correctly
    expect(smallBlind(state).id).toBe(PLAYER_IDS[0]);
    expect(bigBlind(state).id).toBe(PLAYER_IDS[1]);

    // Verify first player to act (small blind in heads-up)
    const current = currentPlayer(state);
    expect(current).not.toBeNull();
    expect(firstPlayerIndex(state)).toBe(0);
    expect(current!.id).toBe(PLAYER_IDS[0]);
  });

  test("Player can only join when game is in WAITING state", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(2));

    // First player joins successfully when state is WAITING
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "table",
        action: "join",
        playerId: PLAYER_IDS[0],
        playerName: PLAYER_IDS[0],
      })
    );

    // Second player joins successfully when state is still WAITING
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "table",
        action: "join",
        playerId: PLAYER_IDS[1],
        playerName: PLAYER_IDS[1],
      })
    );

    // Get state to verify we're now in PLAYING state
    const state = await Effect.runPromise(pokerRoom.currentState());
    expect(state.tableStatus).toBe("PLAYING");

    // Verify players are in the state correctly
    expect(state.players.length).toBe(2);
    expect(state.players[0].id).toBe(PLAYER_IDS[0]);
    expect(state.players[1].id).toBe(PLAYER_IDS[1]);

    // Attempt to join a third player while PLAYING - this should throw
    let joinError = null;
    try {
      await Effect.runPromise(
        pokerRoom.processEvent({
          type: "table",
          action: "join",
          playerId: PLAYER_IDS[2],
          playerName: PLAYER_IDS[2],
        })
      );
    } catch (error) {
      joinError = error;
    }

    // Verify that attempting to join failed
    expect(joinError).not.toBeNull();
  });

  test("Player position assignment when joining", async () => {
    const pokerRoom = await Effect.runPromise(makePokerRoomForTests(2));

    // First player joins - should be assigned SB/dealer position
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "table",
        playerName: PLAYER_IDS[0],
        action: "join",
        playerId: PLAYER_IDS[0],
      })
    );

    let state = await Effect.runPromise(pokerRoom.currentState());
    expect(state.players[0].position).toBe("SB");
    expect(state.players.length).toBe(1);

    // Second player joins - should be assigned BB position
    await Effect.runPromise(
      pokerRoom.processEvent({
        type: "table",
        playerName: PLAYER_IDS[1],
        action: "join",
        playerId: PLAYER_IDS[1],
      })
    );

    state = await Effect.runPromise(pokerRoom.currentState());
    expect(state.players[1].position).toBe("BB");
    expect(state.players.length).toBe(2);

    // Verify first player's position hasn't changed
    expect(state.players[0].position).toBe("SB");
  });
}); 