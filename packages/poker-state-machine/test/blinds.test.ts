import { expect, test, describe } from "bun:test";
import { PLAYER_DEFAULT_STATE } from "../src/state_machine";
import { collectBlinds, SMALL_BLIND, BIG_BLIND } from "../src/transitions";
import type { PlayerState, PokerState } from "../src/schemas";

describe('Blinds functionality', () => {
  // Helper function to create a test player
  function createPlayer(id: string, chips: number, bet = { round: 0, total: 0 }): PlayerState {
    return {
      ...PLAYER_DEFAULT_STATE,
      id,
      chips,
      bet,
      status: 'PLAYING'
    };
  }

  // Helper function to create a basic poker state for testing
  function createTestState(players: PlayerState[], dealerId = 'player1'): PokerState {
    return {
      tableId: "table-id",
      tableStatus: "PLAYING",
      players,
      deck: [],
      community: [],
      pot: 0,
      lastMove: null,
      round: {
        phase: "PRE_FLOP",
        roundNumber: 1,
        roundPot: 0,
        currentBet: 0,
        foldedPlayers: [],
        allInPlayers: [],
      },
      dealerId,
      currentPlayerIndex: 0,
      winner: null,
      config: {
        maxRounds: null,
        startingChips: 100,
        smallBlind: SMALL_BLIND,
        bigBlind: BIG_BLIND
      }
    };
  }

  test('collectBlinds should collect correct blinds from players', () => {
    // Create three test players with 100 chips each
    const player1 = createPlayer('player1', 100);
    const player2 = createPlayer('player2', 100);
    const player3 = createPlayer('player3', 100);
    
    const initialState = createTestState([player1, player2, player3], 'player1');
    
    // Collect blinds (player2 should be small blind, player3 should be big blind)
    const afterBlindsState = collectBlinds(initialState);
    
    // Check total pot
    expect(afterBlindsState.pot).toBe(SMALL_BLIND + BIG_BLIND);
    
    // Check small blind player
    const smallBlindPlayer = afterBlindsState.players.find(p => p.id === 'player2');
    expect(smallBlindPlayer).toBeDefined();
    expect(smallBlindPlayer?.chips).toBe(100 - SMALL_BLIND);
    expect(smallBlindPlayer?.bet.round).toBe(SMALL_BLIND);
    expect(smallBlindPlayer?.bet.total).toBe(SMALL_BLIND);
    
    // Check big blind player
    const bigBlindPlayer = afterBlindsState.players.find(p => p.id === 'player3');
    expect(bigBlindPlayer).toBeDefined();
    expect(bigBlindPlayer?.chips).toBe(100 - BIG_BLIND);
    expect(bigBlindPlayer?.bet.round).toBe(BIG_BLIND);
    expect(bigBlindPlayer?.bet.total).toBe(BIG_BLIND);
    
    // Check dealer (shouldn't have posted any blind yet)
    const dealerPlayer = afterBlindsState.players.find(p => p.id === 'player1');
    expect(dealerPlayer).toBeDefined();
    expect(dealerPlayer?.chips).toBe(100);
    expect(dealerPlayer?.bet.round).toBe(0);
    expect(dealerPlayer?.bet.total).toBe(0);
    
    // Check current bet
    expect(afterBlindsState.round.currentBet).toBe(BIG_BLIND);
  });

  test('collectBlinds should work with two players', () => {
    // With two players, dealer posts small blind, other player posts big blind
    const player1 = createPlayer('player1', 100);
    const player2 = createPlayer('player2', 100);
    
    const initialState = createTestState([player1, player2], 'player1');
    
    const afterBlindsState = collectBlinds(initialState);
    
    // Check total pot
    expect(afterBlindsState.pot).toBe(SMALL_BLIND + BIG_BLIND);
    
    // Check dealer is small blind
    const smallBlindPlayer = afterBlindsState.players.find(p => p.id === 'player1');
    expect(smallBlindPlayer).toBeDefined();
    expect(smallBlindPlayer?.chips).toBe(100 - SMALL_BLIND);
    expect(smallBlindPlayer?.bet.round).toBe(SMALL_BLIND);
    
    // Check other player is big blind
    const bigBlindPlayer = afterBlindsState.players.find(p => p.id === 'player2');
    expect(bigBlindPlayer).toBeDefined();
    expect(bigBlindPlayer?.chips).toBe(100 - BIG_BLIND);
    expect(bigBlindPlayer?.bet.round).toBe(BIG_BLIND);
  });

  test('collectBlinds should handle player with insufficient chips for blinds', () => {
    // Player with insufficient chips for small blind
    const player1 = createPlayer('player1', 100);
    const player2 = createPlayer('player2', 5); // Only 5 chips, not enough for full small blind
    const player3 = createPlayer('player3', 100);
    
    const initialState = createTestState([player1, player2, player3], 'player1');
    
    const afterBlindsState = collectBlinds(initialState);
    
    // Small blind player should be all-in with 5 chips
    const smallBlindPlayer = afterBlindsState.players.find(p => p.id === 'player2');
    expect(smallBlindPlayer).toBeDefined();
    expect(smallBlindPlayer?.chips).toBe(0);
    expect(smallBlindPlayer?.bet.round).toBe(5); // All 5 chips went to blind
    expect(smallBlindPlayer?.status).toBe('ALL_IN');
    
    // Pot should have 5 (partial small blind) + BIG_BLIND
    expect(afterBlindsState.pot).toBe(5 + BIG_BLIND);
    
    // Test with player with insufficient chips for big blind
    const player4 = createPlayer('player4', 100);
    const player5 = createPlayer('player5', 100);
    const player6 = createPlayer('player6', 15); // Only 15 chips, not enough for full big blind
    
    const initialState2 = createTestState([player4, player5, player6], 'player4');
    
    const afterBlindsState2 = collectBlinds(initialState2);
    
    // Big blind player should be all-in with 15 chips
    const bigBlindPlayer = afterBlindsState2.players.find(p => p.id === 'player6');
    expect(bigBlindPlayer).toBeDefined();
    expect(bigBlindPlayer?.chips).toBe(0);
    expect(bigBlindPlayer?.bet.round).toBe(15); // All 15 chips went to blind
    expect(bigBlindPlayer?.status).toBe('ALL_IN');
    
    // Pot should have SMALL_BLIND + 15 (partial big blind)
    expect(afterBlindsState2.pot).toBe(SMALL_BLIND + 15);
  });
}); 