/*
    transitions: functions that operate on the current poker state to return the next one.
 */
import { Effect, Iterable, Option, pipe, Schema } from "effect"
import { determineWinningPlayers, getShuffledDeck, type RiverCommunity } from "./poker"
import { bigBlind, findDealerIndex, firstPlayerIndex, rotated, roundRotation, smallBlind } from "./queries"
import type { Card, Move, PlayerState, PokerState, StateMachineError, ProcessEventError } from "./schemas"
import { PLAYER_DEFAULT_STATE } from "./state_machine"
import { commit } from "effect/STM"


export const SMALL_BLIND = 10
export const BIG_BLIND = 20

// precondition: waiting for players | finished previous round
export function addPlayer(state: PokerState, playerId: string): PokerState {
  return {
    ...state,
    players: [
        ...state.players,
        {
            ...PLAYER_DEFAULT_STATE,
            id: playerId
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
    const deck = getShuffledDeck()
    const dealtCards = deck.splice(0, 2 * state.players.length)

    return {
        ...state,
        status: 'PLAYING',
        deck,
        community: [],
        players: state.players.map((p, i) => ({
            ...p,
            hand: dealtCards.slice(2 * i, 2 * i + 2) as [Card, Card],
            status: "PLAYING",
        }))
    }
}

// precondition: waiting for players | finished previous round
export function rotateBlinds(state: PokerState): PokerState {
    const dealerIndex = findDealerIndex(state)
    const nextDealerIndex = (dealerIndex + 1) % state.players.length
    const nextDealerId = state.players[nextDealerIndex].id
    const next = {
        ...state,
        dealerId: nextDealerId,
    }
    return {
        ...next,
        currentPlayerIndex: firstPlayerIndex(next)
    }
}

export type StateTransition = (state: PokerState) => PokerState

// precondition: cards are dealt
export const collectBlinds: StateTransition = state => {
    const bigBlindId = bigBlind(state).id;
    const smallBlindId = smallBlind(state).id;
    
    const nextState = pipe(
        state,
        (state: PokerState) => playerBet(state, smallBlindId, SMALL_BLIND),
        (state: PokerState) => playerBet(state, bigBlindId, BIG_BLIND),
    );

    return {
        ...nextState,
        round: {
            ...nextState.round,
            phase: 'PRE_FLOP'
        }
    };
}

export const startRound: StateTransition = (state: PokerState) => pipe(
    state,
    dealCards,
    rotateBlinds,
    collectBlinds,
)

export function playerBet(state: PokerState, playerId: string, amount: number): PokerState {
    const player = state.players.find(p => p.id === playerId)!
    const diff = Math.min(amount - player.bet.round, player.chips)
    const bet = {
        round: player.bet.round + diff,
        total: player.bet.total + diff,
    }
    const remaining = player.chips - diff
    const raised = amount > state.round.currentBet

    return {
        ...state,
        pot: state.pot + diff,
        round: {
            ...state.round,
            currentBet: Math.max(state.round.currentBet, bet.round)
        },
        players: state.players.map(p => p.id !== playerId ? p : {
            ...p,
            bet,
            chips: remaining,
            status: remaining === 0 ? 'ALL_IN' : 'PLAYING'
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
                players: state.players.map(p => p.id !== playerId ? p : { ...p, status: 'FOLDED' })
            }
            break;
        }

        case "call": {
            nextState = playerBet(nextState, playerId, state.round.currentBet)
            break;
        }

        case "raise": {
            nextState = playerBet(nextState, playerId, move.amount)
            break;
        }

        case 'all_in': {
            nextState = playerBet(nextState, playerId, player.chips)
            break;
        }
    }

    return transition(nextState)
}

// TEST: test-case for allowing blinds to raise (especially big blind, which's already called)
export function transition(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    const players = roundRotation(state)
    const isLastPlayer = state.currentPlayerIndex >= players.findLastIndex(p => p.status === "PLAYING")
    const allCalled = state.round.currentBet !== 0 && state.players.every(p => (
           p.status    === "FOLDED"
        || p.status    === "ALL_IN"
        || p.bet.round === state.round.currentBet
    ))
    const allChecked = state.round.currentBet === 0 && isLastPlayer
    const playersLeft = state.players.filter(p => p.status === "PLAYING")

    if (playersLeft.length <= 1) return showdown(state)
    if (allCalled || allChecked) return nextPhase(state)

    return Effect.succeed({
        ...state,
        currentPlayerIndex: isLastPlayer
            ? players.findIndex(p => p.status === 'PLAYING')
            : players.findIndex((p, i) => p.status === 'PLAYING' && state.currentPlayerIndex < i)
    })
}

// precondition: betting round is over
export function nextPhase(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    const communityCards = state.community.length
    if (communityCards === 5) return showdown(state)

    const toBeDealt = ({ 0: 3, 3: 1, 4: 1 })[state.community.length]!
    const deckCards = state.deck.length
    const community = [...state.community, ...state.deck.slice(deckCards - toBeDealt, deckCards)]
    const deck = state.deck.slice(0, deckCards - toBeDealt)

    // Map the number of community cards to the corresponding phase
    const phaseMap: Record<number, 'FLOP' | 'TURN' | 'RIVER'> = {
        3: 'FLOP',
        4: 'TURN',
        5: 'RIVER'
    }

    const nextState: PokerState = {
        ...state,
        deck,
        community,
        round: {
            ...state.round,
            currentBet: 0,
            phase: phaseMap[community.length] ?? state.round.phase
        },
        players: state.players.map(p => ({
            ...p,
            bet: {
                total: p.bet.total,
                round: 0,
            },
        }))
    }

    return Effect.succeed({
        ...nextState,
        currentPlayerIndex: firstPlayerIndex(nextState)
    })
}

// precondition: players are sorted by bet total
// returns the bet size for each pot
const getPotBets = (players: PlayerState[]) => pipe(
    players,
    Iterable.map(p => p.bet.total),
    Iterable.dedupeAdjacent,
    Iterable.reduce<number[], number>([], (ps, p) => [...ps, p])
)

// precondition: potBets is sorted
// returns the amount each player has at stake on each pot
const calculatePots = (potBets: number[], players: PlayerState[]): Map<number, number> => {
    const pots = new Map<number, number>()
    for (const player of players) {
        let remaining = player.bet.total;
        for (const potBet of potBets) {
            const amount = Math.min(remaining, potBet)
            remaining -= amount
            const pot = pots.get(potBet) ?? 0
            pots.set(potBet, pot + amount)
        }
    }
    return pots
}

function determinePotWinner(
    potBet: number,
    players: PlayerState[],
    community: RiverCommunity,
): string[] {
    const potPlayers = players.filter(p => p.bet.total >= potBet)
    return determineWinningPlayers(players, community)
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
export function showdown(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    const allPlayers = state.players.toSorted((a, b) => a.bet.total - b.bet.total)
    const inPlayers = allPlayers.filter(p => p.status !== 'FOLDED')
    // Players who are still active (not folded or all-in)
    const playingPlayers = inPlayers.filter(p => p.status === 'PLAYING')
    
    // Validate state: all active players should have the same bet
    const playingPotBets = getPotBets(playingPlayers)
    if (playingPotBets.length !== 1) {
        return Effect.fail({
            type: 'inconsistent_state',
            message: "Inconsistent State Error: there's more than one pot for non all-in players."
        })
    }
    
    const potBets = getPotBets(allPlayers);
    const pots = calculatePots(potBets, allPlayers);

    const rewards: Map<string, number> = new Map()
    
    // Process each pot level
    for (const [bet, pot] of pots) {
        const winnerIds = determinePotWinner(bet, inPlayers, state.community as RiverCommunity)
        
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

    return Effect.succeed({
        ...state,
        status: 'ROUND_OVER',
        pot: 0, // Reset pot after distributing rewards
        winner: state.players.find(p => (rewards.get(p.id) ?? 0) > 0)?.id ?? null,
        players: state.players.map(p => ({
            ...p,
            chips: p.chips + (rewards.get(p.id) ?? 0),
            bet: {
                total: 0,
                round: 0,
            }
        }))
    })
}

export function nextRound(state: PokerState): Effect.Effect<PokerState, ProcessEventError, never> {
    // Check if we've reached max rounds
    if (state.config.maxRounds !== null && state.round.roundNumber >= state.config.maxRounds) {
        return Effect.succeed({
            ...state,
            status: 'GAME_OVER' as const
        });
    }

    // Move dealer button to next active player
    const activePlayers = state.players.filter(p => p.chips > 0);
    if (activePlayers.length < 2) {
        // Game is over - we have a winner
        return Effect.succeed({
            ...state,
            status: 'GAME_OVER' as const,
            winner: activePlayers[0]?.id ?? null
        });
    }

    const currentDealerIndex = activePlayers.findIndex(p => p.id === state.dealerId);
    const nextDealerIndex = (currentDealerIndex + 1) % activePlayers.length;
    const nextDealer = activePlayers[nextDealerIndex];

    // Reset player states for new round
    const resetPlayers = state.players.map(p => ({
        ...p,
        status: p.chips > 0 ? 'PLAYING' as const : 'FOLDED' as const,
        hand: [],
        bet: { round: 0, total: 0 }
    })) as PlayerState[];

    // Prepare initial state for the new round
    const initialState = {
        ...state,
        status: 'PLAYING' as const,
        players: resetPlayers,
        dealerId: nextDealer.id,
        currentPlayerIndex: -1,
        deck: [],  // Will be set by startRound
        community: [],
        winner: null,
        round: {
            phase: 'PRE_FLOP' as const,
            roundNumber: state.round.roundNumber + 1,
            roundPot: 0,
            currentBet: 0,
            foldedPlayers: [],
            allInPlayers: []
        }
    };

    // Start the round which will deal cards, rotate blinds and collect blinds
    return Effect.succeed(startRound(initialState));
}

export function endGame(state: PokerState): Effect.Effect<PokerState, ProcessEventError, never> {
    return Effect.succeed({
        ...state,
        status: 'GAME_OVER'
    });
}
