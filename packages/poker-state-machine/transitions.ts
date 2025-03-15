/*
    transitions: functions that operate on the current poker state to return the next one.
 */

import { determineHandType, determineWinningHand, getShuffledDeck } from "./poker";
import { bigBlind, players, playersInRound, playingPlayers, roundRotation, seatedPlayers, smallBlind } from "./queries";
import { PLAYER_DEFAULT_STATE, type Move, type PokerState } from "./state_machine";


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
  const nextState = structuredClone(state)
  delete nextState.players[playerId]
  return nextState
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

// precondition: cards are dealt
export function collectBlinds(state: PokerState): PokerState {
    const bigBlindId = bigBlind(state).id;
    const bigBlindPlayer = state.players[bigBlindId];
    const bigBlindAmount = Math.min(BIG_BLIND, bigBlindPlayer.chips);

    const smallBlindId = smallBlind(state).id;
    const smallBlindPlayer = state.players[smallBlindId];
    const smallBlindAmount = Math.min(SMALL_BLIND, smallBlindPlayer.chips);

    return {
        ...state,
        pot: state.pot + bigBlindAmount + smallBlindAmount,
        bet: Math.max(bigBlindAmount, smallBlindAmount),
        players: {
            ...state.players,
            [bigBlindId]: {
                ...bigBlindPlayer,
                chips: bigBlindPlayer.chips - bigBlindAmount,
                bet: bigBlindAmount,
            },
            [smallBlindId]: {
                ...smallBlindPlayer,
                chips: smallBlindPlayer.chips - smallBlindAmount,
                bet: smallBlindAmount,
            },
        },
    };
}

export function startRound(current: PokerState): PokerState {
    const nextState = [dealCards, rotateBlinds, collectBlinds].reduce(
        (state, f) => f(state),
        current,
    )

    return nextState
}

function shiftBetRotation(state: PokerState): PokerState {
    const players = roundRotation(state);
    // needs to be >= because current player might have folded and be the last
    const isLastPlayer = state.currentPlayerIndex >= players.findLastIndex((p) => p.status === "PLAYING");

    const allCalled = players.every(
        (p) => p.status === "FOLDED" || p.bet === state.bet,
    );

    const nextState = structuredClone(state)
    const playersLeft = players.filter(p => p.status === "PLAYING");
    if (playersLeft.length === 1) {
        nextState.winningPlayerId = playersLeft[0].id;
        nextState.currentPlayerIndex = -1
        return nextState
    }

    if (isLastPlayer && allCalled) {
        nextState.currentPlayerIndex = -1
        return nextState
    }

    const nextPlayerIndex = isLastPlayer && !allCalled
        ? players.findIndex((p) => p.status === "PLAYING") // rotates back to the beggining
        : players.findIndex(
            // find next player still in round
            (p, i) => p.status === "PLAYING" && state.currentPlayerIndex < i,
        );

    nextState.currentPlayerIndex = nextPlayerIndex

    return nextState;
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
            nextState.players[playerId].status = "FOLDED";
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

    let nextState = structuredClone(state);
    nextState.currentPlayerIndex = 0;
    nextState.bet = 0
    nextState.players = Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, { ...player, bet: 0 }]));

    switch (state.community.length) {
        // deal flop
        case 0: {
            // TODO: what to do about invalid states? (i.e. has burnt but no community)
            nextState.burnt = [nextState.deck.pop()!];
            nextState.community = [
                nextState.deck.pop()!,
                nextState.deck.pop()!,
                nextState.deck.pop()!,
            ];
            break;
        }
        // deal turn
        case 3: {
            nextState.burnt.push(nextState.deck.pop()!);
            nextState.community.push(nextState.deck.pop()!);
            break;
        }
        // deal river
        case 4: {
            nextState.burnt.push(nextState.deck.pop()!);
            nextState.community.push(nextState.deck.pop()!);
            break;
        }
        // showdown
        case 5: {
            const players = playingPlayers(state);
            const playerHands = players.map((p) => [...p.hand, ...state.community]);
            const playerHandTypes = playerHands.map((h) => determineHandType(h));
            const winningHand = determineWinningHand(playerHandTypes);

            const winningPlayerIndex = playerHandTypes.findIndex(
                (t) => t === winningHand,
            );
            const winningPlayer = players[winningPlayerIndex]

            nextState.winningPlayerId = winningPlayer.id;
            // TODO: track pot for all-in situations
            nextState.players[winningPlayer.id].chips += state.pot;
            break;
        }
    }

    return nextState;
}
