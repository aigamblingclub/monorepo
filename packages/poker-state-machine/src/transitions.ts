/*
    transitions: functions that operate on the current poker state to return the next one.
 */
import { Effect, Iterable, pipe } from "effect"
import { getShuffledDeck } from "./poker"
import { bigBlind, findDealerIndex, firstPlayerIndex, rotated, roundRotation, smallBlind } from "./queries"
import type { Move, PlayerState, PokerState } from "./schemas"
import { PLAYER_DEFAULT_STATE } from "./state_machine"


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
        deck,
        community: [],
        players: state.players.map((p, i) => ({
            ...p,
            hand: dealtCards.slice(2 * i, 2 * i + 2),
            status: "PLAYING",
        })
    }
}

// precondition: waiting for players | finished previous round
export function rotateBlinds(state: PokerState): PokerState {
    const dealerIndex = findDealerIndex(state)
    const nextDealerIndex = (dealerIndex + 1) % state.players.length
    const nextDealerId = state.players[nextDealerIndex].id
    return {
        ...state,
        dealerId: nextDealerId,
    };
}

export type StateTransition = (state: PokerState) => PokerState

// precondition: cards are dealt
export const collectBlinds: StateTransition = state => {
    const bigBlindId = bigBlind(state).id;
    const smallBlindId = smallBlind(state).id;
    return pipe(
        state,
        (state: PokerState) => playerBet(state, smallBlindId, SMALL_BLIND),
        (state: PokerState) => playerBet(state, bigBlindId, BIG_BLIND),
    )
}

export const startRound: StateTransition = (state: PokerState) => pipe(
    state,
    dealCards,
    rotateBlinds,
    collectBlinds,
)

function playerBet(state: PokerState, playerId: string, amount: number): PokerState {
    const player = state.players.find(p => p.id === playerId)!
    const diff = Math.min(amount - player.bet.round, player.chips)
    const bet = {
        round: player.bet.round + diff,
        total: player.bet.total + diff,
    }
    const remaining = player.chips - diff
    const raised = amount > state.bet

    return {
        ...state,
        pot: state.pot + diff,
        bet: Math.max(state.bet, bet.round),
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
export function processPlayerMove(state: PokerState, move: Move): Effect.Effect<PokerState, string> {
    const playerId = state.players[state.currentPlayerIndex].id;

    let nextState = structuredClone(state);
    switch (move.type) {
        case "fold": {
            // TODO: check if the player already has enough bet
            nextState = {
                ...state,
                players: state.players.map(p => p.id !== playerId ? p : { ...p, status: 'FOLDED' })
            }
            break;
        }

        case "call": {
            nextState = playerBet(nextState, playerId, state.bet)
            break;
        }

        // TODO: on raise we should validate amount of chips and return an error if the player
        // has insufficient chips
        case "raise": {
            nextState = playerBet(nextState, playerId, move.amount)
            break;
        }
    }

    return transition(nextState)
}

// TEST: test-case for allowing blinds to raise (especially big blind, which's already called)
export function transition(state: PokerState): Effect.Effect<PokerState, string> {
    const players = roundRotation(state)
    const isLastPlayer = state.currentPlayerIndex >= players.findLastIndex(p => p.status === "PLAYING")
    const allCalled = state.bet !== 0 && state.players.every(p => (
           p.status    === "FOLDED"
        || p.status    === "ALL_IN"
        || p.bet.round === state.bet
    ))
    const allChecked = state.bet === 0 && isLastPlayer
    const playersLeft = state.players.filter(p => p.status === "PLAYING")

    if (playersLeft.length <= 1) return showdown(state)
    if (allCalled || allChecked) return nextPhase(state)

    // shift bet rotation
    return Effect.succeed({
        ...state,
        currentPlayerIndex: isLastPlayer
            ? players.findIndex(p => p.status === 'PLAYING')
            : players.findIndex((p, i) => p.status === 'PLAYING' && state.currentPlayerIndex < i)
    })
}

// precondition: betting round is over
export function nextPhase(state: PokerState): Effect.Effect<PokerState, string> {
    const cards = state.deck.length
    if (cards === 5) return showdown(state)

    const toBeDealt = ({ 0: 3, 3: 1, 4: 1 })[state.community.length]!
    const community = state.deck.slice(cards - toBeDealt, cards)
    const deck = state.deck.slice(0, cards - toBeDealt)

    const nextState: PokerState = {
        ...state,
        deck,
        community,
        bet: 0,
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
const playerPotStakes = (player: PlayerState, potBets: number[]) => {
    let remaining = player.bet.total;
    const acc = []
    for (const potBet of potBets) {
        const amount = Math.min(remaining, potBet)
        remaining -= amount
        acc.push(amount)
    }
    return acc
}

// TEST: test-case for when there's only 1 pot but 2 all-in players in it
// precondition: all players which are not folded or all-in have the same bet total
export function showdown(state: PokerState): Effect.Effect<PokerState, string> {
    const allPlayers = state.players.toSorted((a, b) => a.bet.total - b.bet.total)
    const inPlayers = allPlayers.filter(p => p.status !== 'FOLDED')
    const allInPlayers = inPlayers.filter(p => p.status === 'ALL_IN')
    // TODO: better name for this status
    const playingPlayers = inPlayers.filter(p => p.status === 'PLAYING')

    const playingPotBets = getPotBets(playingPlayers)
    if (playingPotBets.length !== 1) {
        return Effect.fail('TODO: turn this error into an proper type (inconsistent state)')
    }

    const potBets = getPotBets(inPlayers)
    const map = Object.fromEntries(potBets.map(b => [b, 0] as const))

    inPlayers.map(p => )


    // tá daí pra cada pote eu vou pegar cada jogador que apostou pelo menos isso

    // para cada side-pot distribuir o prêmio igualmente entre as mãos vencedoras
}
