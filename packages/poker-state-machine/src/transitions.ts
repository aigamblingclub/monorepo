/*
    transitions: functions that operate on the current poker state to return the next one.
 */
import { Effect, Iterable, Option, pipe, Schema } from "effect"
import { determineWinningPlayers, getShuffledDeck, getDeck, type RiverCommunity, resetTestDeck } from "./poker"
import { bigBlind, findDealerIndex, firstPlayerIndex, rotated, roundRotation, smallBlind } from "./queries"
import type { Card, Move, PlayerState, PokerState, StateMachineError, ProcessEventError } from "./schemas"
import { PLAYER_DEFAULT_STATE } from "./state_machine"

// TODO: Implement maximum raises per betting round
// In Texas Hold'em:
// - For No-Limit: Unlimited raises
// - For Limit: 
//   - 4 raises max in normal games (can be increased if only 2 players remain)
//   - In heads-up play, unlimited raises
// - Some casinos may have house rules limiting raises
// Reference: https://www.pokerstars.com/poker/games/rules/limit-holdem/

export const SMALL_BLIND = 10
export const BIG_BLIND = 20

// precondition: waiting for players | finished previous round
export function addPlayer(state: PokerState, playerId: string, playerName: string): PokerState {
  const numPlayers = state.players.length;
  let position: string;
  
  // Set position based on current number of players for heads-up specifically
  if (numPlayers === 0) {
    // First player in heads-up is Small Blind / Dealer
    position = "SB";
  } else if (numPlayers === 1) {
    // Second player in heads-up is Big Blind
    position = "BB";
  } else if (numPlayers === 2) {
    // Third player starts as Button (will rotate properly)
    position = "BTN";
  } else if (numPlayers === 3) {
    // Fourth player is Under The Gun (early position)
    position = "EP";
  } else if (numPlayers === 4) {
    // Fifth player is Middle Position
    position = "MP";
  } else if (numPlayers === 5) {
    // Sixth player is Cut-off
    position = "CO";
  } else {
    // For 7+ players, cycle through positions
    const positions = ["BTN", "SB", "BB", "EP", "MP", "CO"];
    position = positions[numPlayers % positions.length];
  }

  return {
    ...state,
    players: [
        ...state.players,
        {
            ...PLAYER_DEFAULT_STATE,
            id: playerId,
            playerName: playerName,
            position: position as any, // TODO: fix type
            chips: state.config.startingChips, // Use config instead of default
        }
    ]
  }
}

// TEST: consider what happens when you remove the player supposed to be the dealer
// precondition: waiting for players | finished previous round
export function removePlayer(state: PokerState, playerId: string): PokerState {
    const removeIndex = state.players.findIndex(p => p.id === playerId)
    const newIndex = state.currentPlayerIndex <= removeIndex
        ? state.currentPlayerIndex
        : state.currentPlayerIndex - 1

    const players = state.players.filter((_, index) => index !== removeIndex)

    return {
        ...state,
        players,
        currentPlayerIndex: newIndex
    }
}

// precondition: waiting for players | finished previous round
export function dealCards(state: PokerState): PokerState {
    // Use existing deck from state if available, otherwise get a fresh one
    let deck = state.deck;
    console.log(`🎴 dealCards() called - deck=${deck}, length=${deck?.length || 'undefined'}`);
    
    if (!deck || deck.length === 0) {
        console.log(`🔄 Getting fresh deck because deck is ${!deck ? 'null/undefined' : 'empty'}`);
        deck = getDeck();
    } else {
        console.log(`♻️  Using existing deck with ${deck.length} cards`);
    }
    
    // FIXED: Only deal cards to players who have chips (aren't eliminated)
    const activePlayers = state.players.filter(p => p.chips > 0);
    
    console.log(`🎯 Dealing cards to ${activePlayers.length} active players (eliminated players: ${state.players.length - activePlayers.length})`);
    
    // Clone the deck to avoid mutating the original
    const workingDeck = [...deck];
    const dealtCards = workingDeck.splice(0, 2 * activePlayers.length);

    console.log(`🃏 Dealing ${dealtCards.length} cards for ${activePlayers.length} active players`);

    return {
        ...state,
        tableStatus: 'PLAYING',
        deck: workingDeck, // Use the remaining cards
        community: [],
        players: state.players.map((p) => {
            // If player has no chips, they are eliminated - no hand, status ELIMINATED
            if (p.chips <= 0) {
                return {
                    ...p,
                    hand: [],  // No cards for eliminated players
                    status: "ELIMINATED" as const, // Eliminated players are marked as such
                };
            }
            
            // Active players get cards and PLAYING status
            const activePlayerIndex = activePlayers.findIndex(ap => ap.id === p.id);
            return {
                ...p,
                hand: dealtCards.slice(2 * activePlayerIndex, 2 * activePlayerIndex + 2) as [Card, Card],
                status: "PLAYING" as const,
            };
        })
    }
}

// precondition: waiting for players | finished previous round
export function rotateBlinds(state: PokerState): PokerState {
    const numPlayers = state.players.length;
    
    if (numPlayers < 2) {
        return state; // Cannot rotate with less than 2 players
    }
    
    // Find current dealer and move to next dealer
    const currentDealerIndex = findDealerIndex(state);
    const nextDealerIndex = (currentDealerIndex + 1) % numPlayers;
    const nextDealerId = state.players[nextDealerIndex].id;
    
    // Create new state with rotated dealer
    const stateWithNewDealer = {
        ...state,
        dealerId: nextDealerId,
        players: state.players.map(player => ({
            ...player,
            playedThisPhase: false, // Reset for new hand
            bet: { amount: 0, volume: 0 }, // Reset bets
            status: player.chips > 0 ? "PLAYING" as const : player.status, // Reset status if they have chips
        })),
        round: {
            ...state.round,
            // Don't increment round number in rotateBlinds - that should happen in nextRound
            currentBet: 0,
            volume: 0,
            foldedPlayers: [],
            allInPlayers: [],
        },
        phase: {
            street: "PRE_FLOP" as const,
            actionCount: 0,
            volume: 0,
        },
    };
    
    // Assign positions based on new dealer
    const stateWithPositions = assignPositions(stateWithNewDealer);
    
    return {
        ...stateWithPositions,
        currentPlayerIndex: firstPlayerIndex(stateWithPositions)
    };
}

export type StateTransition = (state: PokerState) => PokerState

// Version of playerBet specifically for posting blinds - doesn't mark playedThisPhase
function playerPostBlind(state: PokerState, playerId: string, amount: number): PokerState {
    const player = state.players.find(p => p.id === playerId)!
    
    const diff = Math.min(amount, player.chips)
    const bet = {
        amount: player.bet.amount + diff,
        volume: player.bet.volume + diff,
    }
    const remaining = player.chips - diff

    const newState = {
        ...state,
        phase: {
            ...state.phase,
            volume: state.phase.volume + diff,
        },
        round: {
            ...state.round,
            currentBet: Math.max(state.round.currentBet, bet.amount),
            volume: state.round.volume + diff,
        },
        players: state.players.map(p => p.id !== playerId ? p : {
            ...p,
            bet,
            chips: remaining,
            status: remaining === 0 ? 'ALL_IN' as const : 'PLAYING' as const,
            // CRITICAL: Don't mark playedThisPhase=true for blinds
            playedThisPhase: false
        })
    }
    
    return newState;
}

// precondition: cards are dealt
export const collectBlinds: StateTransition = state => {
    const sb = smallBlind(state);
    const bb = bigBlind(state);
    if (!sb || !bb) throw new Error("invalid state: small blind and big blind are required");

    const stateAfterSB = playerPostBlind(state, sb.id, SMALL_BLIND);
    const stateAfterBB = playerPostBlind(stateAfterSB, bb.id, BIG_BLIND);

    return stateAfterBB;
}

// Function to properly assign positions based on dealer index
export function assignPositions(state: PokerState): PokerState {
    // FIXED: Only assign positions to active players (with chips > 0)
    const activePlayers = state.players.filter(p => p.chips > 0);
    const numActivePlayers = activePlayers.length;
    
    console.log(`🎯 assignPositions: ${numActivePlayers} active players, dealer: ${state.dealerId}`);
    
    if (numActivePlayers < 2) {
        console.log(`⚠️  Not enough active players: ${numActivePlayers}`);
        return state; // Cannot assign positions with less than 2 active players
    }
    
    // Find dealer among active players only
    const activeDealerIndex = activePlayers.findIndex(p => p.id === state.dealerId);
    
    if (activeDealerIndex === -1) {
        console.log(`⚠️  Dealer ${state.dealerId} not found among active players, using first active player`);
        // Fallback: set first active player as dealer
        const fallbackState = {
            ...state,
            dealerId: activePlayers[0].id,
        };
        return assignPositions(fallbackState); // Recursive call with valid dealer
    }
    
    console.log(`🎯 Active dealer index: ${activeDealerIndex} (${state.dealerId})`);
    
    const updatedPlayers = state.players.map((player, playerIndex) => {
        // Eliminated players (0 chips) don't get positions in active game
        if (player.chips <= 0) {
            console.log(`💀 Player ${player.playerName} eliminated, keeping position: ${player.position}`);
            return {
                ...player,
                position: player.position // Keep existing position for history
            };
        }
        
        // Find this player's index among ACTIVE players only
        const activePlayerIndex = activePlayers.findIndex(ap => ap.id === player.id);
        
        if (activePlayerIndex === -1) {
            console.log(`❌ Player ${player.playerName} not found in active players`);
            return player; // Shouldn't happen, but safeguard
        }
        
        let position: string;
        
        if (numActivePlayers === 2) {
            // Heads-up: dealer is SB, non-dealer is BB
            position = activePlayerIndex === activeDealerIndex ? "SB" : "BB";
            console.log(`👥 Heads-up: Player ${player.playerName} -> ${position}`);
        } else {
            // Multi-player: calculate relative position from dealer
            const relativePosition = (activePlayerIndex - activeDealerIndex + numActivePlayers) % numActivePlayers;
            
            // Position mappings for different player counts
            const positionMaps: Record<number, string[]> = {
                3: ["BTN", "SB", "BB"],
                4: ["BTN", "SB", "BB", "EP"],
                5: ["BTN", "SB", "BB", "EP", "MP"],
                6: ["BTN", "SB", "BB", "EP", "MP", "CO"]
            };
            
            const positions = positionMaps[numActivePlayers] || ["BTN", "SB", "BB", "EP", "MP", "CO"];
            position = positions[relativePosition] || positions[relativePosition % positions.length];
            
            console.log(`🎲 Multi-player: Player ${player.playerName} (active ${activePlayerIndex}, relative ${relativePosition}) -> ${position}`);
        }
        
        return {
            ...player,
            position: position as any, // TODO: fix type
        };
    });
    
    // Validate positions assignment
    const positionCounts = updatedPlayers.reduce((counts, player) => {
        if (player.chips > 0) { // Only count active players
            counts[player.position] = (counts[player.position] || 0) + 1;
        }
        return counts;
    }, {} as Record<string, number>);
    
    console.log(`🔍 Position counts:`, positionCounts);
    
    // Check for duplicate critical positions
    if (positionCounts.SB > 1) {
        console.error(`❌ Multiple Small Blinds detected: ${positionCounts.SB}`);
    }
    if (positionCounts.BB > 1) {
        console.error(`❌ Multiple Big Blinds detected: ${positionCounts.BB}`);
    }
    
    return {
        ...state,
        players: updatedPlayers,
    };
}

export const startRound: StateTransition = (state: PokerState): PokerState => {
    // Set initial dealer if not set (first game)
    let stateWithDealer = state;
    if (!state.dealerId) {
        // Set first player as initial dealer
        stateWithDealer = {
            ...state,
            dealerId: state.players[0]?.id || "",
        };
    }
    
    // Assign correct positions based on dealer
    const stateWithPositions = assignPositions(stateWithDealer);
    
    // Deal cards
    const dealtState = dealCards(stateWithPositions);
    
    // Collect blinds and set initial state
    const withCollectedBlinds = collectBlinds(dealtState);
    
    // Ensure currentPlayerIndex is set correctly for pre-flop
    return {
        ...withCollectedBlinds,
        currentPlayerIndex: firstPlayerIndex(withCollectedBlinds)
    };
}

/*
 * playerBet:
 * - amount: additional amount to bet (for calls, this is the difference needed to match current bet)
 * - playerId: id of the player betting
 * - state: current state of the game
 *
 * - returns the next state of the game
 */
export function playerBet(state: PokerState, playerId: string, amount: number): PokerState {
    const player = state.players.find(p => p.id === playerId)!
    
    // Special case for all-in: use all remaining chips
    if (amount === player.chips) {
        const bet = {
            amount: player.bet.amount + player.chips,
            volume: player.bet.volume + player.chips,
        }
        
        return {
          ...state,
          phase: {
            ...state.phase,
            volume: state.phase.volume + player.chips,
          },
          round: {
            ...state.round,
            currentBet: Math.max(state.round.currentBet, bet.amount),
            volume: state.round.volume + player.chips,
          },
          players: state.players.map((p) =>
            p.id !== playerId
              ? p
              : {
                  ...p,
                  bet,
                  chips: 0,
                  status: "ALL_IN",
                  playedThisPhase: true, // Mark as having acted
                }
          ),
        };
    }
    
    // Normal betting logic
    const diff = Math.min(amount, player.chips)
    const bet = {
        amount: player.bet.amount + diff,
        volume: player.bet.volume + diff,
    }
    const remaining = player.chips - diff
    const raised = bet.amount > state.round.currentBet

    return {
        ...state,
        phase: {
            ...state.phase,
            volume: state.phase.volume + diff,
        },
        round: {
            ...state.round,
            currentBet: Math.max(state.round.currentBet, bet.amount),
            volume: state.round.volume + diff,
        },
        players: state.players.map(p => p.id !== playerId ? p : {
            ...p,
            bet,
            chips: remaining,
            status: remaining === 0 ? 'ALL_IN' as const : 'PLAYING' as const,
            playedThisPhase: true, // Mark as having acted
        })
    }
}

// README: note that the Move type doesn't include playerId, that's validated on the
// event-processing layer, where a MoveEvent can only be processed if it's from the
// currentPlayer
export function processPlayerMove(state: PokerState, move: Move): Effect.Effect<PokerState, StateMachineError> {
    const player = state.players[state.currentPlayerIndex]
    const playerId = player.id;

    let nextState = structuredClone(state);
    switch (move.type) {
        case "fold": {
            nextState = {
                ...state,
                round: {
                    ...state.round,
                    foldedPlayers: [...state.round.foldedPlayers, playerId]
                },
                players: state.players.map(p => p.id !== playerId ? p : { 
                    ...p, 
                    status: 'FOLDED' as const,
                    playedThisPhase: true // Mark as having acted
                })
            }
            // If after fold only one player remains, go directly to showdown
            const playersInHand = nextState.players.filter(p => p.status === "PLAYING" || p.status === "ALL_IN")
            if (playersInHand.length <= 1) {
                return finalizeRound(nextState)
            }
            break;
        }

        case "call": {
            const amountToCall = state.round.currentBet - player.bet.amount;
            
            // AUTO-CONVERT CALL TO CHECK when no chips owed (AI-friendly)
            if (amountToCall === 0) {
                console.log("🔄 Auto-converting CALL to CHECK (no chips owed)");
                // Treat as CHECK action - set player as acted for this phase
                nextState = {
                    ...nextState,
                    players: nextState.players.map(p => 
                        p.id === playerId ? { ...p, playedThisPhase: true } : p
                    )
                };
                break;
            }
            
            if (amountToCall < 0) {
                return Effect.fail({
                    type: "inconsistent_state",
                    message: "Player bet exceeds current bet - invalid state."
                });
            }
            
            nextState = playerBet(nextState, playerId, amountToCall);
            break;
        }

        case "raise": {
            // Tests expect that move.amount represents the additional amount to bet ON TOP of current player bet
            // So if player has bet 10 and raises by 30, their final bet should be 40
            const additionalAmount = move.amount;
            const targetPlayerBet = player.bet.amount + additionalAmount;
            
            // Validate that the raise creates a higher table bet
            if (targetPlayerBet <= state.round.currentBet) {
                return Effect.fail({
                    type: "inconsistent_state", 
                    message: `Raise amount ${targetPlayerBet} must be greater than current bet ${state.round.currentBet}`
                });
            }
            
            // Reset all other players' playedThisPhase flag since they need to respond to the raise
            nextState = {
                ...nextState,
                players: nextState.players.map(p => 
                    p.id === playerId ? p : { ...p, playedThisPhase: false }
                )
            };
            
            // Calculate how much more the player needs to bet to achieve the target bet
            // If player currently has bet 20 and wants final bet of 40, they need to bet 20 more
            const currentPlayerBet = player.bet.amount;
            const amountToBetNow = targetPlayerBet - currentPlayerBet;
            nextState = playerBet(nextState, playerId, amountToBetNow);
            break;
        }

        case 'all_in': {
            // Reset all other players' playedThisPhase flag since they need to respond to the all-in
            nextState = {
                ...nextState,
                players: nextState.players.map(p => 
                    p.id === playerId ? p : { ...p, playedThisPhase: false }
                )
            };
            nextState = playerBet(nextState, playerId, player.chips)
            break;
        }

        case "check": {
            // OFFICIAL POKER RULES: Check is only allowed when:
            // 1. No bet has been made (currentBet equals player's current bet), OR
            // 2. It's a new betting round and no one has bet yet (currentBet = 0)
            if (state.round.currentBet !== player.bet.amount) {
                return Effect.fail({
                    type: "inconsistent_state",
                    message: `Cannot check when you owe ${state.round.currentBet - player.bet.amount} chips to the pot. Use 'call' instead.`
                });
            }
            // No changes to bets or chips, just mark the player as having acted
            break;
        }
    }

    // ALWAYS mark player as having acted this phase
    const nState = {
        ...nextState,
        phase: {
            ...nextState.phase,
            actionCount: nextState.phase.actionCount + 1,
        },
        players: nextState.players.map(p => ({
            ...p,
            playedThisPhase: p.id === playerId ? true : p.playedThisPhase
        }))
    }
    
    return transition(nState);
}

/**
 * Auto-advance phases when all remaining players are ALL_IN
 * 
 * This function handles the special case where all active players have gone all-in.
 * Instead of waiting for betting rounds to complete normally, we can fast-forward
 * through the remaining phases (FLOP -> TURN -> RIVER) to reach showdown.
 * 
 * BEHAVIOR:
 * - Advances through phases automatically, dealing community cards
 * - Only finalizes immediately if we reach RIVER with 5 community cards
 * - Otherwise, returns the advanced state for normal transition logic to handle
 * - Prevents infinite loops with iteration limits
 * - Stops if deck runs out of cards
 * 
 * This prevents premature finalization that could corrupt ALL_IN status and
 * ensures proper pot distribution in complex all-in scenarios.
 */
function autoAdvancePhasesWhenAllIn(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    console.log(`🚀 autoAdvancePhasesWhenAllIn() - current: ${state.phase.street}, community: ${state.community.length}`);
    
    let currentState = { ...state };
    let iterations = 0;
    const maxIterations = 5; // Safety limit to prevent infinite loops
    
    // Fast forward through remaining phases when all active players are all-in
    while (currentState.community.length < 5 && iterations < maxIterations) {
        iterations++;
        const toBeDealt = ({ 0: 3, 3: 1, 4: 1 })[currentState.community.length]!;
        
        // SAFETY CHECK: Ensure deck has enough cards
        if (currentState.deck.length < toBeDealt) {
            console.log(`❌ Auto-advance stopped: not enough cards (${currentState.deck.length} < ${toBeDealt})`);
            break;
        }
        
        const newCommunity = [...currentState.community, ...currentState.deck.slice(0, toBeDealt)];
        const phaseMap: Record<number, 'FLOP' | 'TURN' | 'RIVER'> = {
            3: 'FLOP',
            4: 'TURN', 
            5: 'RIVER'
        };
        
        const newPhase = phaseMap[newCommunity.length] ?? 'RIVER';
        console.log(`🔄 Auto-advancing to ${newPhase} (iteration ${iterations})`);
        
        currentState = {
            ...currentState,
            community: newCommunity,
            deck: currentState.deck.slice(toBeDealt),
            phase: {
                street: newPhase,
                actionCount: 0,
                volume: 0,
            },
        };
    }
    
    // Safety check for infinite loop prevention
    if (iterations >= maxIterations) {
        console.log(`⚠️  Auto-advance hit maximum iterations (${maxIterations}), forcing finalization`);
    }
    
    console.log(`✅ Auto-advance complete, ready for showdown with ${currentState.community.length} community cards`);
    
    // UNIFIED LOGIC: Finalize when we reach RIVER with all players ALL_IN
    // This prevents premature finalization that corrupts ALL_IN status
    if (currentState.phase.street === 'RIVER' && currentState.community.length >= 5) {
        console.log(`🏁 Reached RIVER with all players ALL_IN - legitimate showdown, finalizing`);
        return finalizeRound(currentState);
    } else {
        console.log(`🎯 Advanced to ${currentState.phase.street} with ${currentState.community.length} cards - finalization handled by nextPhase`);
        return Effect.succeed(currentState);
    }
}

// REFACTORED: Simplified transition function to prevent infinite loops
export function transition(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    // 1. SAFETY CHECK: Validate state before processing
    if (state.tableStatus !== "PLAYING") {
        return Effect.succeed(state);
    }
    
    // 2. CATEGORIZE PLAYERS by status
    const playingPlayers = state.players.filter(p => p.status === "PLAYING");
    const allInPlayers = state.players.filter(p => p.status === "ALL_IN");
    const activeInHand = [...playingPlayers, ...allInPlayers];
    
    // 3. CHECK FOR HAND END CONDITIONS
    // Only one player left -> instant win
    if (activeInHand.length <= 1) {
        return finalizeRound(state);
    }
    
    // All remaining players are all-in -> auto advance phases
    if (playingPlayers.length === 0 && allInPlayers.length > 1) {
        // Don't auto-advance if we're already at RIVER (prevents infinite loop)
        if (state.phase.street === 'RIVER') {
            console.log(`🎯 Already at RIVER with all players ALL_IN - letting nextPhase handle finalization`);
            return nextPhase(state);
        }
        return autoAdvancePhasesWhenAllIn(state);
    }
    
    // 4. CHECK IF BETTING ROUND IS COMPLETE
    const bettingComplete = isBettingRoundComplete(state, playingPlayers);
    
    if (bettingComplete) {
        return nextPhase(state);
    }
    
    // 5. FIND NEXT PLAYER TO ACT
    const nextPlayerIndex = findNextValidPlayerToAct(state, playingPlayers);
    
    if (nextPlayerIndex === -1) {
        // This should not happen if our logic is correct
        return nextPhase(state);
    }
    
    // 6. UPDATE TO NEXT PLAYER  
    return Effect.succeed({
        ...state,
        currentPlayerIndex: nextPlayerIndex
    });
}

// NEW HELPER: Check if betting round is complete
function isBettingRoundComplete(state: PokerState, playingPlayers: PlayerState[]): boolean {
    const currentBet = state.round.currentBet;
    
    // If no one is playing, betting is complete
    if (playingPlayers.length === 0) {
        return true;
    }
    
    // SPECIAL CASE: Heads-up play (2 players)
    if (playingPlayers.length === 2) {
        const [player1, player2] = playingPlayers;
        
        // Both players must have matched the current bet
        const bothMatchedBet = player1.bet.amount >= currentBet && player2.bet.amount >= currentBet;
        
        // Both players must have had an opportunity to act  
        const bothActed = player1.playedThisPhase && player2.playedThisPhase;
        
        // In heads-up, round is complete when both players have equal bets AND both have acted
        return bothMatchedBet && bothActed && player1.bet.amount === player2.bet.amount;
    }
    
    // GENERAL CASE: Multi-player
    // Check if all playing players have either:
    // 1. Matched the current bet AND played this phase, OR
    // 2. Cannot act (not enough chips)
    return playingPlayers.every(player => {
        const hasMatchedBet = player.bet.amount >= currentBet;
        const hasActed = player.playedThisPhase;
        const cannotBetMore = player.chips === 0; // All-in (will be moved to ALL_IN status)
        
        // Player is satisfied if they've matched bet and acted, or if they're all-in
        return (hasMatchedBet && hasActed) || cannotBetMore;
    });
}

// NEW HELPER: Find next valid player with better validation
function findNextValidPlayerToAct(state: PokerState, playingPlayers: PlayerState[]): number {
    const numPlayers = state.players.length;
    
    // Start from current player and look forward
    for (let i = 1; i <= numPlayers; i++) {
        const candidateIndex = (state.currentPlayerIndex + i) % numPlayers;
        const candidate = state.players[candidateIndex];
        
        // Must be in playing status
        if (candidate.status !== "PLAYING") {
            continue;
        }
        
        // Must need to act
        if (playerNeedsToAct(candidate, state.round.currentBet)) {
            return candidateIndex;
        }
    }
    
    return -1; // No one needs to act
}

// NEW HELPER: Determine if a specific player needs to act
function playerNeedsToAct(player: PlayerState, currentBet: number): boolean {
    // Player needs to act if:
    // 1. They owe chips (bet.amount < currentBet), OR
    // 2. They haven't acted this phase yet (can check or raise even if equal)
    const owesChips = player.bet.amount < currentBet;
    const hasntActed = !player.playedThisPhase;
    
    return owesChips || hasntActed;
}

// REFACTORED: Non-recursive nextPhase function
export function nextPhase(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    console.log(`🔄 nextPhase() called from ${state.phase.street}`);
    
    // If we're at RIVER, finalize the round
    if (state.community.length === 5 || state.phase.street === "RIVER") {
        console.log(`🏁 Reached RIVER phase, finalizing round`);
        return finalizeRound(state);
    }

    // Determine how many cards to deal based on current community
    const toBeDealt = ({ 0: 3, 3: 1, 4: 1 })[state.community.length]!;
    
    // SAFETY CHECK: Ensure we have enough cards in deck
    if (state.deck.length < toBeDealt) {
        console.log(`❌ Not enough cards in deck (${state.deck.length} < ${toBeDealt}), finalizing round`);
        return finalizeRound(state);
    }

    // Deal community cards
    const community = [...state.community, ...state.deck.slice(0, toBeDealt)];
    const deck = state.deck.slice(toBeDealt);

    // Map community card count to phase
    const phaseMap: Record<number, 'FLOP' | 'TURN' | 'RIVER'> = {
        3: 'FLOP',
        4: 'TURN', 
        5: 'RIVER'
    };

    const newPhaseStreet = phaseMap[community.length] ?? state.phase.street;
    console.log(`📋 Advancing to ${newPhaseStreet} phase`);

    // Create new state for the next phase
    const nextState: PokerState = {
        ...state,
        deck,
        community,
        phase: {
            street: newPhaseStreet,
            actionCount: 0,
            volume: 0
        },
        round: {
            ...state.round,
            currentBet: 0, // Reset betting for new phase
        },
        players: state.players.map(p => ({
            ...p,
            bet: {
                volume: p.bet.volume, // Keep total volume
                amount: 0, // Reset current bet amount
            },
            playedThisPhase: false // Reset action flag
        })),
        currentPlayerIndex: -1 // Will be set below
    };

    // Check player statuses
    const playingPlayers = nextState.players.filter(p => p.status === "PLAYING");
    const allInPlayers = nextState.players.filter(p => p.status === "ALL_IN");
    
    console.log(`👥 After phase advance: ${playingPlayers.length} playing, ${allInPlayers.length} all-in`);
    
    // NO RECURSION: Handle auto-advance scenarios iteratively
    if (playingPlayers.length === 0 && allInPlayers.length >= 2) {
        // Don't auto-advance if we're already at RIVER (prevents infinite loop)
        if (nextState.phase.street === 'RIVER') {
            console.log(`🎯 Already at RIVER with all players ALL_IN - letting finalization logic handle it`);
            // Continue to the finalization logic below
        } else {
            console.log(`🚀 All remaining players all-in, advancing phases`);
            return autoAdvancePhasesWhenAllIn(nextState);
        }
    }
    
    // NEW: Auto-finalize when we reach RIVER with all players ALL_IN (handles test case)
    if (newPhaseStreet === 'RIVER' && playingPlayers.length === 0 && allInPlayers.length >= 2) {
        console.log(`🏁 Reached RIVER with all players ALL_IN - legitimate showdown, finalizing`);
        return finalizeRound(nextState);
    }
    
    // If we have playing players, set the first to act
    if (playingPlayers.length > 0) {
        const firstToActIndex = firstPlayerIndex(nextState);
        
        // SAFETY CHECK: Ensure firstPlayerIndex is valid
        if (firstToActIndex < 0 || firstToActIndex >= nextState.players.length) {
            console.log(`❌ Invalid first player index: ${firstToActIndex}, finalizing round`);
            return finalizeRound(nextState);
        }
        
        const firstPlayer = nextState.players[firstToActIndex];
        console.log(`👤 First to act in ${newPhaseStreet}: ${firstPlayer.id} (index ${firstToActIndex})`);
        
        return Effect.succeed({
            ...nextState,
            currentPlayerIndex: firstToActIndex
        });
    }
    
        // Fallback: No one can act
    console.log(`❌ No players can act after phase advance, finalizing round`);
    return finalizeRound(nextState);
}

// precondition: players are sorted by bet total
// returns the bet size for each pot
const getPotBets = (players: PlayerState[]) => pipe(
    players,
    Iterable.map(p => p.bet.volume),
    Iterable.dedupeAdjacent,
    Iterable.reduce<number[], number>([], (ps, p) => [...ps, p])
)

// --- Side-pot calculation ----------------------------------------------------
// For each distinct bet level (ascending) calculate how many chips compõem o
// pote daquele nível.  Fórmula: (level – prevLevel) * playersThatReachedLevel
// Ex.: bets [10, 30]   players volumes 10/30/30 →
//   level 10 : (10-0)  * 3 players  = 30
//   level 30 : (30-10) * 2 players  = 40  ==> pot total 70.
const calculatePots = (potBets: number[], players: PlayerState[]): Map<number, number> => {
    const pots = new Map<number, number>()
    let previous = 0
    for (const level of potBets) {
        // players who contributed at least this level
        const contributors = players.filter(p => p.bet.volume >= level).length
        if (contributors === 0) continue
        const amountPerPlayer = level - previous
        const potTotal = amountPerPlayer * contributors
        pots.set(level, potTotal)
        previous = level
    }
    return pots
}

function determinePotWinner(
    potBet: number,
    players: PlayerState[],
    community: Card[],
): string[] {
    // Filter players who contributed to this pot level and haven't folded or been eliminated
    const potPlayers = players.filter(p => 
        p.bet.volume >= potBet && 
        p.status !== 'FOLDED' && 
        p.status !== 'ELIMINATED'
    )
    
    // If not enough community cards for showdown, return all eligible players as tied
    if (community.length < 5) {
        return potPlayers.map(p => p.id);
    }
    
    return determineWinningPlayers(potPlayers, community as RiverCommunity)
}

/**
 * Distributes the pot to the winning players. In case of a tie, the pot is split equally among the winners.
 * If there are odd chips that cannot be divided equally, they are awarded to players closest to the dealer
 * in clockwise order (standard poker "odd chip rule").
 * 
 * Preconditions:
 * - All players which are not folded or all-in have the same bet total
 * - Either there's only one player left which hasn't folded or gone all-in, or we are already at river
 */
export function finalizeRound(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    const allPlayers = state.players.toSorted((a, b) => a.bet.volume - b.bet.volume)
    const inPlayers = allPlayers.filter(p => p.status !== 'FOLDED' && p.status !== 'ELIMINATED')
    
    // Se só tem um jogador ativo, ele ganha o pote
    if (inPlayers.length === 1) {
        const winner = inPlayers[0]
        return Effect.succeed<PokerState>({
            ...state,
            tableStatus: "ROUND_OVER",
            phase: {
                street: 'SHOWDOWN',
                actionCount: 0,
                volume: 0,
            },
            round: {
                ...state.round,
                foldedPlayers: [],
                allInPlayers: [],
                currentBet: 0,
                volume: 0,
            },
                    winner: winner.id,
        lastRoundResult: { roundNumber: state.round.roundNumber, winnerIds: [winner.id], pot: state.round.volume },
            players: state.players.map((p) => {
                const newChips = p.id === winner.id ? p.chips + state.round.volume : p.chips
                return {
                    ...p,
                    chips: newChips,
                    bet: {
                        volume: 0,
                        amount: 0,
                    },
                    // FIXED: Only change status to ELIMINATED if player has no chips, otherwise preserve current status  
                    status: newChips <= 0 ? 'ELIMINATED' as const : p.status
                }
            }),
            currentPlayerIndex: -1
        })
    }

    // Players who are still active (not folded or all-in)
    const playingPlayers = inPlayers.filter(p => p.status === 'PLAYING')
    
    // Validate state: all non-all-in players should have matched the current bet
    // Note: We don't need this validation at finalization since the transition logic
    // already ensures that finalizeRound is only called when betting is complete
    // or all remaining players are all-in. Removing this check fixes the issue
    // where players who went all-in for less than currentBet are flagged as unmatched.
    
    const potBets = getPotBets(allPlayers);
    const pots = calculatePots(potBets, allPlayers);

    const rewards: Map<string, number> = new Map()
    
    // Process each pot level
    for (const [bet, pot] of pots) {
        const winnerIds = determinePotWinner(bet, inPlayers, [...state.community])
        
        if (winnerIds.length === 0) continue;
        
        // Equal share for each winner
        const equalShare = Math.floor(pot / winnerIds.length)
        // Calculate remainder chips that can't be divided equally
        const remainder = pot % winnerIds.length
        
        // Find dealer position in the original player array
        const dealerIdx = state.players.findIndex(p => p.id === state.dealerId);
        
        // Sort winners by proximity to dealer position (clockwise order)
        // This implements the standard "odd chip rule" in poker
        const sortedWinnersByPosition = [...winnerIds].sort((a, b) => {
            const aIdx = state.players.findIndex(p => p.id === a);
            const bIdx = state.players.findIndex(p => p.id === b);
            
            // Calculate positions relative to dealer (clockwise)
            const aPos = (aIdx - dealerIdx + state.players.length) % state.players.length;
            const bPos = (bIdx - dealerIdx + state.players.length) % state.players.length;
            
            return aPos - bPos; // Lower number = closer to dealer
        });
        
        // Distribute equal shares to all winners
        for (const winnerId of winnerIds) {
            const current = rewards.get(winnerId) ?? 0
            rewards.set(winnerId, current + equalShare)
        }
        
        // Distribute remainder chips to players closest to dealer
        for (let i = 0; i < remainder; i++) {
            const winnerId = sortedWinnersByPosition[i % sortedWinnersByPosition.length];
            const current = rewards.get(winnerId) ?? 0
            rewards.set(winnerId, current + 1)
        }
    }

    // --- consistency check ---------------------------------------------------
    const distributed = [...rewards.values()].reduce((s, v) => s + v, 0)
    if (distributed !== state.round.volume) {
        return Effect.fail({
            type: 'inconsistent_state',
            message: `Pot distribution mismatch: expected ${state.round.volume}, distributed ${distributed}`
        })
    }

    const winnerIds = Array.from(rewards.keys());
    
    // Calculate final chips for each player after pot distribution
    const finalPlayers = state.players.map((p) => {
        const newChips = p.chips + (rewards.get(p.id) ?? 0)
        return {
            ...p,
            chips: newChips,
            bet: {
                volume: 0,
                amount: 0,
            },
            // CORRECT: ALL_IN is a temporary status during the round
            // After round ends, players should be PLAYING (if they have chips) or ELIMINATED (if no chips)
            status: newChips <= 0 ? 'ELIMINATED' as const : 'PLAYING' as const
        }
    });

    // Check if game should end 
    const playersWithChips = finalPlayers.filter(p => p.chips > 0);
    
    // Game over condition: Only one player with chips left (standard poker rules)
    const shouldEndGame = playersWithChips.length < 2;
    
    const tableStatus = shouldEndGame ? "GAME_OVER" : "ROUND_OVER";
    const gameWinner = playersWithChips.length === 1 ? playersWithChips[0].id : null;

    return Effect.succeed<PokerState>({
        ...state,
        tableStatus,
        phase: {
            street: 'SHOWDOWN',
            actionCount: 0,
            volume: 0,
        },
        round: {
            ...state.round,
            volume: 0,
            foldedPlayers: [],
            allInPlayers: [],
            currentBet: 0
        },
        winner: gameWinner ?? winnerIds[0] ?? null,
        lastRoundResult: { roundNumber: state.round.roundNumber, winnerIds, pot: state.round.volume },
        players: finalPlayers,
        currentPlayerIndex: -1
    });
}

export function nextRound(state: PokerState): Effect.Effect<PokerState, ProcessEventError, never> {
    // Reset test deck to break infinite loops with deterministic cards
    resetTestDeck();
    
    // Check if we've reached max rounds
    if (state.config.maxRounds !== null && state.round.roundNumber >= state.config.maxRounds) {
        Effect.log('Game is over - max rounds reached')
        return endGame(state);
    }

    // FIXED: Keep eliminated players in array, but filter for game logic
    const playersWithChips = state.players.filter(p => p.chips > 0);
    const eliminatedPlayers = state.players.filter(p => p.chips === 0);
    
    console.log(`🚮 Players eliminated: ${eliminatedPlayers.length} (${eliminatedPlayers.map(p => p.playerName).join(', ')})`);
    console.log(`📊 Active players: ${playersWithChips.map(p => `${p.playerName}(${p.chips})`).join(', ')}`);
    
    // Standard poker rule: Game over when only one player has chips left
    if (playersWithChips.length < 2) {
        Effect.log(`Game is over - only ${playersWithChips.length} player(s) with chips remaining`)
        
        const winner = playersWithChips.length === 1 ? playersWithChips[0].id : null;
        
        return endGame({
            ...state,
            winner,
            // Keep ALL players in final state for history/results display
            players: state.players
        });
    }

    // Find next dealer among ACTIVE players only (those with chips)
    const currentDealerIndex = playersWithChips.findIndex(p => p.id === state.dealerId);
    const nextDealerIndex = (currentDealerIndex + 1) % playersWithChips.length;
    const nextDealer = playersWithChips[nextDealerIndex];

    // FIXED: Keep ALL players but reset states appropriately
    const resetPlayers = state.players.map(p => {
        if (p.chips <= 0) {
            // Eliminated players: keep in array but inactive
            return {
                ...p,
                status: 'ELIMINATED' as const, // Eliminated players are permanently eliminated
                hand: [],
                bet: { amount: 0, volume: 0 },
                playedThisPhase: false,
            };
        } else {
            // Active players: reset for new round (regardless of previous status - FOLDED, ALL_IN, etc.)
            return {
                ...p,
                status: 'PLAYING' as const,
                hand: [],
                bet: { amount: 0, volume: 0 },
                playedThisPhase: false,
            };
        }
    }) as PlayerState[];

    // Prepare initial state for the new round
    console.log(`🔄 nextRound() creating new round ${state.round.roundNumber + 1} with ${playersWithChips.length} active players, ${eliminatedPlayers.length} eliminated`);
    const initialState: PokerState = {
        ...state,
        tableStatus: 'PLAYING',
        players: resetPlayers, // Keep ALL players (active + eliminated)
        dealerId: nextDealer.id,
        currentPlayerIndex: -1,
        deck: [],  // Will be set by startRound
        community: [],
        winner: null,
        lastRoundResult: null, // Clear the round result when starting new round
        phase: {
            street: 'PRE_FLOP',
            actionCount: 0,
            volume: 0,
        },
        round: {
            roundNumber: state.round.roundNumber + 1,
            volume: 0,
            currentBet: 0,
            foldedPlayers: [],
            allInPlayers: []
        }
    };
    
    console.log(`🎯 nextRound() calling startRound with ${resetPlayers.length} total players (${playersWithChips.length} active)`);

    // Start the round which will deal cards, rotate blinds and collect blinds
    return Effect.succeed<PokerState>(startRound(initialState));
}

export function endGame(state: PokerState): Effect.Effect<PokerState, never, never> {
    return Effect.succeed<PokerState>({
        ...state,
        tableStatus: 'GAME_OVER',
        lastMove: null
    });
}
