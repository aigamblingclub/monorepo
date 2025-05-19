import { expect, test, describe } from "bun:test";
import { PLAYER_DEFAULT_STATE } from "../src/state_machine";
import { processPlayerMove } from "../src/transitions";
import { Effect } from "effect";
import type { PlayerState, PokerState, Move } from "../src/schemas";

describe('Player Actions', () => {
  // Helper function to create a test player
  function createPlayer(id: string, chips: number, bet = { round: 0, total: 0 }, status: 'PLAYING' | 'FOLDED' | 'ALL_IN' = 'PLAYING'): PlayerState {
    return {
      ...PLAYER_DEFAULT_STATE,
      id,
      chips,
      bet,
      status
    };
  }

  // Helper function to create a basic poker state for testing
  function createTestState(players: PlayerState[], currentPlayerIndex = 0): PokerState {
    return {
      status: "PLAYING",
      players,
      deck: [],
      community: [],
      pot: 0,
      round: {
        phase: "PRE_FLOP",
        roundNumber: 1,
        roundPot: 0,
        currentBet: 0,
        foldedPlayers: [],
        allInPlayers: [],
      },
      dealerId: players[0]?.id || '',
      currentPlayerIndex,
      winner: null,
      config: {
        maxRounds: null,
        startingChips: 100,
        smallBlind: 10,
        bigBlind: 20
      }
    };
  }

  test('player fold action should update player status and foldedPlayers array', async () => {
    // Setup with three players
    const player1 = createPlayer('player1', 100);
    const player2 = createPlayer('player2', 100);
    const player3 = createPlayer('player3', 100);
    
    const initialState = createTestState([player1, player2, player3], 0);
    
    // Player 1 folds
    const fold: Move = { type: 'fold' };
    const result = await Effect.runPromise(processPlayerMove(initialState, fold));
    
    // Check that player status is updated
    const foldedPlayer = result.players.find(p => p.id === 'player1');
    expect(foldedPlayer?.status).toBe('FOLDED');
    
    // Check that foldedPlayers array is updated
    expect(result.round.foldedPlayers).toContain('player1');
    
    // Check that currentPlayerIndex moves to next player
    expect(result.currentPlayerIndex).not.toBe(0);
  });

  test('player call action should update pot and player chips', async () => {
    // Setup with three players, second player has already bet 20
    const player1 = createPlayer('player1', 100);
    const player2 = createPlayer('player2', 80, { round: 20, total: 20 });
    const player3 = createPlayer('player3', 100);
    
    const initialState = {
      ...createTestState([player1, player2, player3], 0),
      pot: 20,
      round: {
        phase: "PRE_FLOP" as const,
        roundNumber: 1,
        roundPot: 0,
        currentBet: 20,
        foldedPlayers: [],
        allInPlayers: [],
      }
    };
    
    // Player 1 calls the current bet of 20
    const call: Move = { type: 'call' };
    const result = await Effect.runPromise(processPlayerMove(initialState, call));
    
    // Check that player chips are updated
    const callingPlayer = result.players.find(p => p.id === 'player1');
    expect(callingPlayer?.chips).toBe(80); // 100 - 20
    expect(callingPlayer?.bet.round).toBe(20);
    expect(callingPlayer?.bet.total).toBe(20);
    
    // Check that pot is updated
    expect(result.pot).toBe(40); // Initial 20 + call of 20
  });

  test('player raise action should update pot, current bet, and player chips', async () => {
    // Setup with three players, current bet is 20
    const player1 = createPlayer('player1', 100);
    const player2 = createPlayer('player2', 80, { round: 20, total: 20 });
    const player3 = createPlayer('player3', 100);
    
    const initialState = {
      ...createTestState([player1, player2, player3], 0),
      pot: 20,
      round: {
        phase: "PRE_FLOP" as const,
        roundNumber: 1,
        roundPot: 0,
        currentBet: 20,
        foldedPlayers: [],
        allInPlayers: [],
      }
    };
    
    // Player 1 raises to 50
    const raise: Move = { type: 'raise', amount: 50 };
    const result = await Effect.runPromise(processPlayerMove(initialState, raise));
    
    // Check that player chips are updated
    const raisingPlayer = result.players.find(p => p.id === 'player1');
    expect(raisingPlayer?.chips).toBe(50); // 100 - 50
    expect(raisingPlayer?.bet.round).toBe(50);
    expect(raisingPlayer?.bet.total).toBe(50);
    
    // Check that pot is updated
    expect(result.pot).toBe(70); // Initial 20 + raise of 50
    
    // Check that current bet is updated
    expect(result.round.currentBet).toBe(50);
  });

  test('player call with insufficient chips should go all-in', async () => {
    // Setup with player having only 15 chips but need to call 20
    const player1 = createPlayer('player1', 15);
    const player2 = createPlayer('player2', 80, { round: 20, total: 20 });
    const player3 = createPlayer('player3', 100);
    
    const initialState = {
      ...createTestState([player1, player2, player3], 0),
      pot: 20,
      round: {
        phase: "PRE_FLOP" as const,
        roundNumber: 1,
        roundPot: 0,
        currentBet: 20,
        foldedPlayers: [],
        allInPlayers: [],
      }
    };
    
    // Player 1 calls but only has 15 chips
    const call: Move = { type: 'call' };
    const result = await Effect.runPromise(processPlayerMove(initialState, call));
    
    // Check that player went all-in
    const callingPlayer = result.players.find(p => p.id === 'player1');
    expect(callingPlayer?.chips).toBe(0);
    expect(callingPlayer?.status).toBe('ALL_IN');
    expect(callingPlayer?.bet.round).toBe(15); // All they had
    expect(callingPlayer?.bet.total).toBe(15);
    
    // Check that pot is updated
    expect(result.pot).toBe(35); // Initial 20 + all-in of 15
  });

  test('player raise with insufficient chips should go all-in', async () => {
    // Setup with player having only 40 chips but trying to raise to 60
    const player1 = createPlayer('player1', 40);
    const player2 = createPlayer('player2', 80, { round: 20, total: 20 });
    const player3 = createPlayer('player3', 100);
    
    const initialState = {
      ...createTestState([player1, player2, player3], 0),
      pot: 20,
      round: {
        phase: "PRE_FLOP" as const,
        roundNumber: 1,
        roundPot: 0,
        currentBet: 20,
        foldedPlayers: [],
        allInPlayers: [],
      }
    };
    
    // Player 1 tries to raise to 60 but only has 40 chips total
    const raise: Move = { type: 'raise', amount: 60 };
    const result = await Effect.runPromise(processPlayerMove(initialState, raise));
    
    // Check that player went all-in
    const raisingPlayer = result.players.find(p => p.id === 'player1');
    expect(raisingPlayer?.chips).toBe(0);
    expect(raisingPlayer?.status).toBe('ALL_IN');
    expect(raisingPlayer?.bet.round).toBe(40); // All they had
    expect(raisingPlayer?.bet.total).toBe(40);
    
    // Check that pot is updated
    expect(result.pot).toBe(60); // Initial 20 + all-in of 40
    
    // Check that current bet is updated to player's all-in amount
    expect(result.round.currentBet).toBe(40);
  });
}); 