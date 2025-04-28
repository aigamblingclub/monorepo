import { Effect, pipe, Queue } from "effect"
import type { Card, Move, MoveEvent } from "./schemas"

type InPlayer = {
    status: 'in'
    id: string
    chips: number
    hand: [Card, Card]
    bet: number
}

type AllInPlayer = {
    status: 'all_in'
    id: string
    chips: 0
    hand: [Card, Card]
    bet: number
}

type FoldedPlayer = {
    status: 'folded'
    id: string
    chips: number
    hand: [Card, Card] // maybe this one is useless?
    bet: number
}

type PlayingPlayer = InPlayer | AllInPlayer | FoldedPlayer

type Preflop = {
    stage: 'preflop'
    players: PlayingPlayer[]
    dealerIndex: number
    pot: number
    bet: number
    currentPlayerIndex: number
}

type Flop = {
    stage: 'flop'
    players: PlayingPlayer[]
    dealerIndex: number
    currentPlayerIndex: number
    pot: number
    bet: number
    community: [Card, Card, Card]
}

type Turn = {
    stage: 'turn'
    players: PlayingPlayer[]
    dealerIndex: number
    currentPlayerIndex: number
    pot: number
    bet: number
    community: [Card, Card, Card, Card]
}

type River = {
    stage: 'river'
    players: PlayingPlayer[]
    dealerIndex: number
    currentPlayerIndex: number
    pot: number
    bet: number
    community: [Card, Card, Card, Card, Card]
}

type NextStage<T extends Preflop | Flop | Turn> = (
    T['stage'] extends 'preflop'
    ? Flop
    : T['stage'] extends 'flop'
    ? Turn
    : T['stage'] extends 'turn'
    ? River
    : never
)

type BettingStages = (Preflop | Flop | Turn | River)


function transitionState<T extends Preflop | Flop | Turn>(state: T): NextStage<T> {
    switch (state.stage) {
        case 'preflop': {
            type ___ = typeof state
            type ____ = T['stage']
            type _____ = NextStage<T & { stage: 'preflop' }>
            return {} as Flop
        }

        case 'flop': {
            return {} as Turn
        }

        case 'turn': {
            return {} as PostShowdown<River>
        }

        case 'river': {
            return {} as PostShowdown<River>
        }
    }
}

function processMoveEvent(state: Preflop, moveEvent: MoveEvent): Effect.Effect<Preflop, string>;
function processMoveEvent(state: Flop, moveEvent: MoveEvent): Effect.Effect<Flop, string>;
function processMoveEvent(state: Turn, moveEvent: MoveEvent): Effect.Effect<Turn, string>;
function processMoveEvent(state: River, moveEvent: MoveEvent): Effect.Effect<River, string>;
function processMoveEvent(state: BettingStages, moveEvent: MoveEvent): Effect.Effect<BettingStages, string> {
    if (moveEvent.playerId !== state.players[0].id) {
        return Effect.fail('todo: not your turn error')
    }
    return Effect.succeed(state)
}

Effect.gen(function* () {
    // todo: initialize state
    let preflop = {} as Preflop
    // todo: receive this queue from context
    const moveEventQueue = yield* Queue.unbounded<MoveEvent>()

    while (true) {
        const moveEvent = yield* moveEventQueue.take
        const processMoveResult = processMoveEvent(preflop, moveEvent)
        const _ = yield* processMoveResult.pipe(Effect.match({
            onSuccess(newState) {
                preflop = newState
                return Effect.succeed(false)
            },
            onFailure(error) {
                // todo: return error to user stream

                return Effect.succeed(true)
            }
        }))
    }


    var flop = transitionState(preflop)
    while (true) {
        const move = yield* moveEventQueue.take
        if (true) { break }
    }

    var turn = transitionState(flop)
    while (true) {
        const move = yield* moveEventQueue.take
        if (true) { break }
    }

    var river = transitionState(turn)
    while (true) {
        const move = yield* moveEventQueue.take
        if (true) { break }
    }

    var showdown = transitionState(river)
    // distribute pot
})

type PostShowdown<Stage extends BettingStages> = Stage & { finished: true }

/*
    waiting -> dealtcards -> preflop, flop, river, turn, showdown

    dentro das macro-fases tem o ciclo de apostas, fica loopando no próprio estado até:
        1. sobrou só um jogador (o resto flopou rs)
        2. todo mundo tá all-in
        3. passou uma rodada sem ninguém apostar

    eu preciso saber:
        1.
*/
