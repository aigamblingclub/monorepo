/*
    transitions: functions that operate on the current poker state to return the next one.
 */
import { Option, pipe } from "effect";
import { determineHandType, determineWinningHand, getShuffledDeck } from "./poker";
import { bigBlind, players, playersInRound, playingPlayers, roundRotation, seatedPlayers, smallBlind } from "./queries";
import type { Move, PokerState } from "./schemas";
import { PLAYER_DEFAULT_STATE } from "./state_machine";


export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

// precondition: waiting for players | finished previous round
export function addPlayer(state: PokerState, playerId: string): PokerState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...PLAYER_DEFAULT_STATE,
        id: playerId,
      },
    },
  }
}

// precondition: waiting for players | finished previous round
export function removePlayer(state: PokerState, playerId: string): PokerState {
    return {
        ...state,
        players: Object.fromEntries(
            Object
                .entries(state.players)
                .filter(([pId]) => pId !== playerId)
        )
    }
}

// precondition: waiting for players | finished previous round
export function dealCards(state: PokerState): PokerState {
    const deck = getShuffledDeck();
    const dealtCards = deck.splice(0, 2 * seatedPlayers(state));

    return {
        ...state,
        status: "PLAYING",
        deck,
        community: [],
        burnt: [],
        currentPlayerIndex: 0,
        // TODO: use conjugateEntries
        players: Object.fromEntries(
            players(state).map((p, i) => [
                p.id,
                {
                    ...p,
                    hand: dealtCards.slice(2 * i, 2 * i + 2),
                    status: "PLAYING",
                    bet: 0,
                },
            ]),
        ),
    };
}

// precondition: waiting for players | finished previous round
export function rotateBlinds(state: PokerState): PokerState {
    const players = playersInRound(state).length;
    return {
        ...state,
        dealerIndex: (state.dealerIndex + 1) % players,
    };
}

export type StateTransition = (state: PokerState) => PokerState

// export function composeTransitions(transitions: StateTransition[]): StateTransition {
//     return initial => transitions.reduce((state, f) => f(state), initial)
// }

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

function shiftBetRotation(state: PokerState): PokerState {
    const players = roundRotation(state);
    // needs to be >= because current player might have folded and be the last
    const isLastPlayer = state.currentPlayerIndex >= players.findLastIndex((p) => p.status === "PLAYING");

    const allCalled = players.every(
        (p) => p.status === "FOLDED" || p.bet === state.bet,
    );

    const playersLeft = players.filter(p => p.status === "PLAYING");
    if (playersLeft.length === 1) {
        return {
            ...state,
            winningPlayerId: Option.some(playersLeft[0].id),
            currentPlayerIndex: -1
        }
    }

    if (isLastPlayer && allCalled) {
        return {
            ...state,
            currentPlayerIndex: -1
        }
    }

    const nextPlayerIndex = isLastPlayer && !allCalled
        ? players.findIndex((p) => p.status === "PLAYING") // rotates back to the beggining
        : players.findIndex(
            // find next player still in round
            (p, i) => p.status === "PLAYING" && state.currentPlayerIndex < i,
        );

    return {
        ...state,
        currentPlayerIndex: nextPlayerIndex
    };
}

function playerBet(state: PokerState, playerId: string, bet: number): PokerState {
    const player = state.players[playerId]
    const diff = Math.min(bet - player.bet, player.chips)
    const amount = player.bet + diff
    const remaining = player.chips - diff
    const raised = bet > state.bet

    return {
        ...state,
        pot: state.pot + diff,
        bet: Math.max(state.bet, amount),
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                bet: amount,
                chips: remaining,
                status: 'PLAYING'
            }
        },
    }
}

export function processPlayerMove(state: PokerState, move: Move): PokerState {
    const players = roundRotation(state);
    const playerId = players[state.currentPlayerIndex].id;

    let nextState = structuredClone(state);
    switch (move.type) {
        case "fold": {
            // TODO: check if the player already has enough bet
            nextState = {
                ...state,
                players: {
                    ...state.players,
                    [playerId]: {
                        ...state.players[playerId],
                        status: 'FOLDED'
                    }
                }
            }
            break;
        }

        case "call": {
            nextState = playerBet(nextState, playerId, state.bet)
            break;
        }

        case "raise": {
            nextState = playerBet(nextState, playerId, move.amount)
            break;
        }
    }

    return shiftBetRotation(nextState);
}

// precondition: all players settled on a bet size
export function transitionPhase(state: PokerState): PokerState {
    if (state.winningPlayerId) {
        return dealCards(state)
    }

    let nextState = {
        ...state,
        currentPlayerIndex: 0,
        players: Object.fromEntries(
            Object
                .entries(state.players)
                .map(([id, player]) => [id, { ...player, bet: 0 }])
        )
    }
    const cards = nextState.deck.length

    switch (state.community.length) {
        // deal flop
        case 0: {
            nextState = {
                ...nextState,
                burnt: [nextState.deck[cards - 1]],
                community: [2, 3, 4].map(offset => nextState.deck[cards - offset]),
                deck: nextState.deck.slice(0, cards - 4),
            }
            break;
        }
        // deal turn
        case 3: {
            nextState = {
                ...nextState,
                burnt: [nextState.deck[cards - 1]],
                community: [nextState.deck[cards - 2]],
                deck: nextState.deck.slice(0, cards - 2),
            }
            break;
        }
        // deal river
        case 4: {
            nextState = {
                ...nextState,
                burnt: [nextState.deck[cards - 1]],
                community: [nextState.deck[cards - 2]],
                deck: nextState.deck.slice(0, cards - 2),
            }
            break;
        }
        // showdown
        case 5: {
            const players = playingPlayers(state);
            const playerHands = players.map((p) => [...p.hand, ...state.community]);
            const playerHandTypes = playerHands.map(h => determineHandType(h));
            const winningHand = determineWinningHand(playerHandTypes);

            const winningPlayerIndex = playerHandTypes.findIndex(
                (t) => t === winningHand,
            );
            const winningPlayer = players[winningPlayerIndex]

            nextState.winningPlayerId = Option.some(winningPlayer.id);
            // TODO: track pot for all-in situations
            nextState.players[winningPlayer.id].chips += state.pot;
            break;
        }
    }

    return nextState;
}
