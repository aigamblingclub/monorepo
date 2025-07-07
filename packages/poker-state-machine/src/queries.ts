/*
    queries: functions that map the poker state data structure to a workable format
 */
import { Option } from "effect"
import type { PlayerState, PlayerView, PokerState } from "./schemas"

export const findDealerIndex = (state: PokerState): number => state.players.findIndex(p => p.id === state.dealerId)

// REFACTORED: Robust firstPlayerIndex that works correctly for 2-6 players
export function firstPlayerIndex(state: PokerState): number {
  const numTotalPlayers = state.players.length;
  const activePlayers = state.players.filter(p => p.chips > 0 && p.status !== 'ELIMINATED');
  const numActivePlayers = activePlayers.length;
  const isPreflop = state.community.length === 0;
  const dealerIndex = findDealerIndex(state);
  
  console.log(`🎯 firstPlayerIndex() - total: ${numTotalPlayers}, active: ${numActivePlayers}, preflop: ${isPreflop}, dealer: ${dealerIndex}`);
  
  // SAFETY CHECK: Validate dealer index
  if (dealerIndex < 0 || dealerIndex >= numTotalPlayers) {
    console.log(`❌ Invalid dealer index: ${dealerIndex}, defaulting to first active player`);
    const firstActiveIndex = state.players.findIndex(p => p.chips > 0 && p.status !== 'ELIMINATED');
    return Math.max(0, firstActiveIndex);
  }
  
  // SAFETY CHECK: Minimum active players
  if (numActivePlayers < 2) {
    console.log(`❌ Not enough active players: ${numActivePlayers}, defaulting to dealer`);
    return dealerIndex;
  }
  
  // HEADS-UP (2 active players): Special rules
  if (numActivePlayers === 2) {
    if (isPreflop) {
      // Pre-flop heads-up: Small Blind (dealer) acts first
      console.log(`👥 Heads-up pre-flop: SB/Dealer acts first (index ${dealerIndex})`);
      return dealerIndex;
    } else {
      // Post-flop heads-up: Big Blind (non-dealer) acts first
      // Find the active non-dealer player
      const nonDealerPlayer = activePlayers.find(p => p.id !== state.dealerId);
      const nonDealerIndex = nonDealerPlayer ? state.players.findIndex(p => p.id === nonDealerPlayer.id) : (dealerIndex + 1) % numTotalPlayers;
      console.log(`👥 Heads-up post-flop: BB acts first (index ${nonDealerIndex})`);
      return nonDealerIndex;
    }
  }
  
  // MULTI-PLAYER (3+ active players): Standard poker rules
  if (isPreflop) {
    // Pre-flop: Under The Gun (UTG) acts first
    // UTG = first active player after Big Blind
    const dealerActiveIndex = activePlayers.findIndex(p => p.id === state.dealerId);
    
    if (dealerActiveIndex === -1) {
      console.log(`❌ Dealer not found in active players, using first active`);
      return state.players.findIndex(p => p.chips > 0 && p.status !== 'ELIMINATED');
    }
    
    // In 3+ players: UTG is 3 positions after dealer (after BTN, SB, BB)
    const utgActiveIndex = (dealerActiveIndex + 3) % numActivePlayers;
    const utgPlayer = activePlayers[utgActiveIndex];
    const utgGlobalIndex = state.players.findIndex(p => p.id === utgPlayer.id);
    
    console.log(`🎲 Multi-player pre-flop: UTG acts first - ${utgPlayer.playerName} (index ${utgGlobalIndex})`);
    return utgGlobalIndex;
  } else {
    // Post-flop: Small Blind (or first active player after SB) acts first
    const sbPlayer = state.players.find(p => p.position === "SB" && p.chips > 0 && p.status !== 'ELIMINATED');
    
    if (sbPlayer) {
      const sbIndex = state.players.findIndex(p => p.id === sbPlayer.id);
      console.log(`🎲 Multi-player post-flop: SB acts first - ${sbPlayer.playerName} (index ${sbIndex})`);
      return sbIndex;
    }
    
    // Fallback: Find first active player starting from SB position
    const dealerActiveIndex = activePlayers.findIndex(p => p.id === state.dealerId);
    const sbActiveIndex = (dealerActiveIndex + 1) % numActivePlayers;
    
    for (let i = 0; i < numActivePlayers; i++) {
      const candidateActiveIndex = (sbActiveIndex + i) % numActivePlayers;
      const candidatePlayer = activePlayers[candidateActiveIndex];
      
      // Player can act if they're actively playing (not folded or all-in)
      if (candidatePlayer.status === "PLAYING") {
        const candidateGlobalIndex = state.players.findIndex(p => p.id === candidatePlayer.id);
        console.log(`🎲 Multi-player post-flop: First active player is ${candidatePlayer.playerName} (index ${candidateGlobalIndex})`);
        return candidateGlobalIndex;
      }
    }
    
    // Final fallback: Return first active player
    const firstActiveIndex = state.players.findIndex(p => p.chips > 0 && p.status !== 'ELIMINATED');
    console.log(`⚠️  No active playing players found, defaulting to first active (index ${firstActiveIndex})`);
    return Math.max(0, firstActiveIndex);
  }
}

export function rotated<T>(array: readonly T[], count: number): readonly T[] {
  return array.map((_, i, array) => array[(i + count) % array.length])
}

export function roundRotation(state: PokerState): readonly PlayerState[] {
    return rotated(state.players, state.players.length - firstPlayerIndex(state))
}

export const currentPlayer = (state: PokerState) => {
    if (state.currentPlayerIndex < 0 || state.currentPlayerIndex >= state.players.length) {
        return null;
    }
    return state.players[state.currentPlayerIndex];
}

export const smallBlind = (state: PokerState) => {
    if (state.players.length === 2) {
        // In heads-up: dealer is small blind
        const dealerIndex = findDealerIndex(state);
        return state.players[dealerIndex];
    }
    
    // Find player with SB position
    const sbPlayer = state.players.find(p => p.position === "SB");
    if (sbPlayer) {
        return sbPlayer;
    }
    
    // Fallback to positional logic
    const dealerIndex = findDealerIndex(state);
    return state.players[(dealerIndex + 1) % state.players.length];
}

export const bigBlind = (state: PokerState) => {
    if (state.players.length === 2) {
        // In heads-up: non-dealer is big blind
        const dealerIndex = findDealerIndex(state);
        return state.players[(dealerIndex + 1) % 2];
    }
    
    // Find player with BB position
    const bbPlayer = state.players.find(p => p.position === "BB");
    if (bbPlayer) {
        return bbPlayer;
    }
    
    // Fallback to positional logic
    const dealerIndex = findDealerIndex(state);
    return state.players[(dealerIndex + 2) % state.players.length];
}

export const playerView = (state: PokerState, playerId: string): PlayerView => {
    const player = state.players.find(p => p.id === playerId)!
    const isShowdown = state.phase.street === 'RIVER' && state.tableStatus === 'ROUND_OVER';
    
      // Get active players (not folded and not eliminated)
  const activePlayers = state.players.filter(p => p.status !== 'FOLDED' && p.status !== 'ELIMINATED');
    const allRemainingPlayersAllIn = activePlayers.length > 0 && activePlayers.every(p => p.status === 'ALL_IN');
    
    const shouldShowOpponentHands = isShowdown || allRemainingPlayersAllIn;

    return {
        hand: player.hand ?? [],
        community: state.community,
        tableStatus: state.tableStatus,
        dealerId: state.dealerId,
        bigBlindId: Option.fromNullable(bigBlind(state)?.id),
        smallBlindId: Option.fromNullable(smallBlind(state)?.id),
        currentPlayerId: Option.fromNullable(currentPlayer(state)?.id),
        round: state.round,
        phase: state.phase,
        player,
        opponents: state.players
            .filter(p => p.id !== playerId)
            .map(p => ({
                status: p.status,
                chips: p.chips,
                bet: p.bet,
                hand: shouldShowOpponentHands && p.status !== 'FOLDED' && p.status !== 'ELIMINATED' ? p.hand : []
            }))
    }
}
