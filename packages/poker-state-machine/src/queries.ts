/*
    queries: functions that map the poker state data structure to a workable format
 */
import { Option } from "effect"
import type { PlayerState, PlayerView, PokerState } from "./schemas"

export const findDealerIndex = (state: PokerState): number => state.players.findIndex(p => p.id === state.dealerId)

export function firstPlayerIndex(state: PokerState): number {
  const players = state.players.length
  const preflop = state.community.length === 0
  const dealerIndex = findDealerIndex(state)
  
  if (players === 2) {
    // In Heads-up:
    // - Pre-flop: Dealer (SB) acts first
    // - Post-flop: BB (non-dealer) acts first
    return preflop 
      ? dealerIndex  // Dealer acts first in pre-flop
      : (dealerIndex + 1) % 2  // BB acts first after pre-flop
  }
  
  // In regular game (3+ players):
  // First to act is the position after BB (UTG)
  return (dealerIndex + 3) % players
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
    const dealerIndex = findDealerIndex(state)
    // In heads-up play, dealer is small blind
    if (state.players.length === 2) {
        return state.players[dealerIndex]
    }
    // In regular play, small blind is left of dealer
    return state.players[(dealerIndex + 1) % state.players.length]
}

export const bigBlind = (state: PokerState) => {
    const dealerIndex = findDealerIndex(state)
    // In heads-up play, non-dealer is big blind
    if (state.players.length === 2) {
        return state.players[(dealerIndex + 1) % 2]
    }
    // In regular play, big blind is two left of dealer
    return state.players[(dealerIndex + 2) % state.players.length]
}

export const playerView = (state: PokerState, playerId: string): PlayerView => {
    const player = state.players.find(p => p.id === playerId)!
    const isShowdown = state.phase.street === 'RIVER' && state.tableStatus === 'ROUND_OVER';
    
    // Get active players (not folded)
    const activePlayers = state.players.filter(p => p.status !== 'FOLDED');
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
                hand: shouldShowOpponentHands && p.status !== 'FOLDED' ? p.hand : []
            }))
    }
}
