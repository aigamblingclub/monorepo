/*
    transitions: functions that operate on the current poker state to return the next one.
 */
import { Effect, Iterable, Option, pipe, Schema } from "effect"
import { determineWinningPlayers, getShuffledDeck, type RiverCommunity } from "./poker"
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
  return {
    ...state,
    players: [
        ...state.players,
        {
            ...PLAYER_DEFAULT_STATE,
            id: playerId,
            playerName: playerName
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
        tableStatus: 'PLAYING',
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

export const startRound: StateTransition = (state: PokerState) => {
    // First deal cards
    const dealtState = dealCards(state);
    
    // Then rotate blinds and get dealer position
    const withBlinds = rotateBlinds(dealtState);
    
    // Finally collect blinds and set initial state
    const withCollectedBlinds = collectBlinds(withBlinds);
    
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
            round: player.bet.round + player.chips,
            total: player.bet.total + player.chips,
        }
        
        return {
            ...state,
            pot: state.pot + player.chips,
            round: {
                ...state.round,
                currentBet: Math.max(state.round.currentBet, bet.round)
            },
            players: state.players.map(p => p.id !== playerId ? p : {
                ...p,
                bet,
                chips: 0,
                status: 'ALL_IN'
            })
        }
    }
    
    // Normal betting logic
    const diff = Math.min(amount, player.chips)
    const bet = {
        round: player.bet.round + diff,
        total: player.bet.total + diff,
    }
    const remaining = player.chips - diff
    const raised = bet.round > state.round.currentBet

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
                players: state.players.map(p => p.id !== playerId ? p : { 
                    ...p, 
                    status: 'FOLDED',
                })
            }
            // Se após o fold só resta um jogador, vamos direto para showdown
            const playersLeft = nextState.players.filter(p => p.status === "PLAYING")
            if (playersLeft.length <= 1) {
                return finalizeRound(nextState)
            }
            break;
        }

        case "call": {
            const amountToCall = state.round.currentBet - player.bet.round
            nextState = playerBet(nextState, playerId, amountToCall)
            break;
        }

        case "raise": {
            nextState = playerBet(nextState, playerId, move.amount);
            break;
        }

        case 'all_in': {
            nextState = playerBet(nextState, playerId, player.chips)
            break;
        }
    }

    const nState = {
        ...nextState,
        players: nextState.players.map(p => ({
            ...p,
            playedThisPhase: p.id === playerId ? true : p.playedThisPhase
        }))
    }
    
    return transition(nState);
}

const isLastToAct = (state: PokerState): boolean => {
    // For heads-up (2 players)
    if (state.players.length === 2) {
        const bbIndex = state.players.findIndex(p => p.id === bigBlind(state).id)

        // Pre-flop special case: BB needs to have their action if they haven't acted beyond their blind
        if (state.round.phase === 'PRE_FLOP') {
            const bbPlayer = state.players[bbIndex]
            if (bbPlayer.bet.round === BIG_BLIND && !bbPlayer.playedThisPhase) {
                return false
            }
        }

        // For all phases:
        // 1. All active players must have acted this phase
        // 2. All active players must have matched the current bet
        return state.players.every(p => 
            p.status !== 'PLAYING' || // not playing (folded/all-in)
            (p.playedThisPhase && p.bet.round === state.round.currentBet) // has acted and matched bet
        )
    }
    
    // For 3+ players
    const playingPlayers = state.players.filter(p => p.status === 'PLAYING')
    const currentPlayerBet = state.players[state.currentPlayerIndex]?.bet.round ?? 0
    const isLastPosition = state.currentPlayerIndex >= state.players.findLastIndex(p => p.status === 'PLAYING')
    
    return isLastPosition && currentPlayerBet === state.round.currentBet
}

// TEST: test-case for allowing blinds to raise (especially big blind, which's already called)
export function transition(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    const isHeadsUp = state.players.length === 2
    const bbIndex = state.players.findIndex(p => p.id === bigBlind(state).id)
    const sbIndex = (bbIndex + 1) % 2

    // Verificações de segurança para evitar loops
    const allCalled = state.round.currentBet !== 0 && state.players.every(p => (
        p.status === "FOLDED" ||
        p.status === "ALL_IN" ||
        p.bet.round === state.round.currentBet
    ))
    const allChecked = state.round.currentBet === 0 && state.players.every(p => 
        p.status !== "PLAYING" || // folded or all-in
        p.playedThisPhase // has acted in this round
    )

    // Regras específicas para heads-up poker
    let canAdvancePhase = false
    if (isHeadsUp) {
        const bbPlayer = state.players[bbIndex]
        const sbPlayer = state.players[sbIndex]

        if (state.round.phase === 'PRE_FLOP') {
            // No pre-flop:
            // 1. BB precisa ter agido além do blind inicial
            // 2. Apostas precisam estar iguais
            canAdvancePhase = bbPlayer.playedThisPhase && allCalled
        } else {
            // Pós-flop:
            // 1. Ambos precisam ter agido nesta fase
            // 2. Apostas precisam estar iguais
            canAdvancePhase = bbPlayer.playedThisPhase && 
                             sbPlayer.playedThisPhase && 
                             (allCalled || allChecked)
        }
    } else {
        // Para 3+ jogadores, mantém a lógica original
        canAdvancePhase = allCalled || allChecked
    }

    const playersLeft = state.players.filter(p => p.status === "PLAYING")
    const allInPlayers = state.players.filter(p => p.status === "ALL_IN")

    console.log('\n=== DETAILED STATE INFO ===')
    console.log('Current State:', {
        phase: state.round.phase,
        currentPlayerIndex: state.currentPlayerIndex,
        currentBet: state.round.currentBet,
        pot: state.pot,
        canAdvancePhase,
        allCalled,
        allChecked,
        playersLeft: playersLeft.length,
        allInPlayers: allInPlayers.length
    })
    console.log('Player States:', state.players.map(p => ({
        id: p.id,
        status: p.status,
        bet: p.bet,
        isCurrentPlayer: state.currentPlayerIndex >= 0 && state.players[state.currentPlayerIndex].id === p.id
    })))

    // Se só resta um jogador ativo ou todos os jogadores ativos estão all-in, vamos para showdown
    if (playersLeft.length <= 1 && allInPlayers.length === 0) {
        console.log('Finalizing round due to only one active player or no all-in players')
        return finalizeRound(state)
    }

    // Se não tem jogadores ativos mas tem 2+ all-in, distribui cartas restantes
    if (playersLeft.length === 0 && allInPlayers.length >= 2 && state.community.length <= 5) {
        console.log('Distributing remaining cards')
        return nextPhase(state)
    }

    // No heads-up:
    if (isHeadsUp) {
        // Se é início da fase, determina quem age primeiro
        if (state.currentPlayerIndex < 0) {
            // Pre-flop: SB age primeiro
            if (state.round.phase === 'PRE_FLOP') {
                return Effect.succeed({
                    ...state,
                    currentPlayerIndex: sbIndex
                })
            }
            // Post-flop: BB age primeiro se estiver jogando
            else {
                const firstToAct = state.players[bbIndex].status === 'PLAYING' ? bbIndex : sbIndex
                return Effect.succeed({
                    ...state,
                    currentPlayerIndex: firstToAct
                })
            }
        }

        // Se podemos avançar para próxima fase
        if (canAdvancePhase) {
            return nextPhase(state)
        }

        // Se há apostas e o jogador atual igualou, próximo age (se precisar)
        const currentPlayer = state.players[state.currentPlayerIndex]
        if (currentPlayer && currentPlayer.bet.round === state.round.currentBet) {
            const nextPlayerIndex = state.currentPlayerIndex === bbIndex ? sbIndex : bbIndex
            const nextPlayer = state.players[nextPlayerIndex]
            
            if (nextPlayer.status === 'PLAYING' && 
                (!nextPlayer.playedThisPhase || nextPlayer.bet.round < state.round.currentBet)) {
                return Effect.succeed({
                    ...state,
                    currentPlayerIndex: nextPlayerIndex
                })
            }
        }

        // Se ainda há alguém para agir, encontra o próximo
        const nextToAct = state.players.find((p, i) => 
            p.status === 'PLAYING' && 
            (!p.playedThisPhase || p.bet.round < state.round.currentBet)
        )

        if (nextToAct) {
            const nextIndex = state.players.findIndex(p => p.id === nextToAct.id)
            return Effect.succeed({
                ...state,
                currentPlayerIndex: nextIndex
            })
        }

        // Se ninguém mais precisa agir, próxima fase
        return nextPhase(state)
    }

    // Para 3+ jogadores, mantém a lógica original
    if (canAdvancePhase) {
        return nextPhase(state)
    }

    // Se ainda há alguém para agir, encontra o próximo
    const nextToAct = state.players.find((p, i) => 
        p.status === 'PLAYING' && 
        p.bet.round < state.round.currentBet
    )

    if (nextToAct) {
        const nextIndex = state.players.findIndex(p => p.id === nextToAct.id)
        return Effect.succeed({
            ...state,
            currentPlayerIndex: nextIndex
        })
    }

    // Se ninguém mais precisa agir, próxima fase
    return nextPhase(state)
}

// precondition: betting round is over
export function nextPhase(state: PokerState): Effect.Effect<PokerState, StateMachineError> {
    console.log('\n=== NEXT PHASE TRANSITION ===')
    console.log('Current State:', {
        phase: state.round.phase,
        communityCards: state.community.length,
        currentBet: state.round.currentBet,
        pot: state.pot,
        currentPlayerIndex: state.currentPlayerIndex
    })
    console.log('Player States:', state.players.map(p => ({
        id: p.id,
        status: p.status,
        bet: p.bet,
        chips: p.chips
    })))

    if (state.community.length === 5) {
        console.log('Five community cards dealt, moving to showdown')
        return finalizeRound(state)
    }

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
            playedThisPhase: false // Reset playedThisPhase for new phase
        })),
        currentPlayerIndex: -1 // Reset currentPlayerIndex to force proper assignment below
    }

    const allInPlayers = state.players.filter(p => p.status === "ALL_IN")
    if (allInPlayers.length > 0) {
        console.log('Distributing remaining cards')
        return transition(nextState)
    }

    // No heads-up, BB age primeiro após o flop
    if (state.players.length === 2 && allInPlayers.length === 0) {
        const bbIndex = state.players.findIndex(p => p.id === bigBlind(state).id)
        const sbIndex = (bbIndex + 1) % 2

        // Se BB ainda está jogando, ele age primeiro
        if (state.players[bbIndex].status === 'PLAYING') {
            return Effect.succeed({
                ...nextState,
                currentPlayerIndex: bbIndex
            })
        }
        // Se BB não está jogando, SB age
        return Effect.succeed({
            ...nextState,
            currentPlayerIndex: sbIndex
        })
    }

    // Em jogos com mais de 2 jogadores, primeiro jogador após o dealer age primeiro
    const dealerIndex = state.players.findIndex(p => p.id === state.dealerId)
    const firstToAct = (dealerIndex + 1) % state.players.length
    
    return Effect.succeed({
        ...nextState,
        currentPlayerIndex: firstToAct
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
    // Filter players who contributed to this pot level and haven't folded
    const potPlayers = players.filter(p => 
        p.bet.total >= potBet && 
        p.status !== 'FOLDED'
    )
    return determineWinningPlayers(potPlayers, community)
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
    const allPlayers = state.players.toSorted((a, b) => a.bet.total - b.bet.total)
    const inPlayers = allPlayers.filter(p => p.status !== 'FOLDED')
    
    // Se só tem um jogador ativo, ele ganha o pote
    if (inPlayers.length === 1) {
        const winner = inPlayers[0]
        return Effect.succeed({
            ...state,
            tableStatus: "ROUND_OVER",
            pot: 0,
            round: {
                ...state.round,
                phase: 'SHOWDOWN',
                foldedPlayers: [],
                allInPlayers: [],
                currentBet: 0
            },
            lastMove: null,
            winner: winner.id,
            players: state.players.map((p) => ({
                ...p,
                chips: p.id === winner.id ? p.chips + state.pot : p.chips,
                bet: {
                    total: 0,
                    round: 0,
                },
                status: p.chips > 0 ? 'PLAYING' : 'FOLDED' // Reseta o status para próxima rodada se tiver fichas
            })),
            currentPlayerIndex: -1
        })
    }

    // Players who are still active (not folded or all-in)
    const playingPlayers = inPlayers.filter(p => p.status === 'PLAYING' || p.status === 'ALL_IN')
    
    // Validate state: all active players should have the same bet
    const playingPotBets = getPotBets(playingPlayers)
    console.log('playingPotBets', playingPotBets, playingPlayers)
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
        console.log({ 'bet': bet, 'pot': pot, 'inPlayers': inPlayers, 'community': state.community })
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
    console.log('rewards', rewards)
    return Effect.succeed({
        ...state,
        tableStatus: "ROUND_OVER",
        pot: 0,
        round: {
            ...state.round,
            phase: 'SHOWDOWN',
            foldedPlayers: [],
            allInPlayers: [],
            currentBet: 0
        },
        lastMove: null,
        winner: state.players.find((p) => (rewards.get(p.id) ?? 0) > 0)?.id ?? null,
        players: state.players.map((p) => ({
            ...p,
            chips: p.chips + (rewards.get(p.id) ?? 0),
            bet: {
                total: 0,
                round: 0,
            },
            status: p.chips > 0 ? 'PLAYING' : 'FOLDED' // Reseta o status para próxima rodada se tiver fichas
        })),
        currentPlayerIndex: -1
    });
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
        lastMove: null,
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
        status: 'GAME_OVER',
        lastMove: null
    });
}
