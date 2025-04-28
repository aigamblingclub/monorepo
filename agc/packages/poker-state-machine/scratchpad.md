# poker state machine

## todo
- big blind raise preflop
- correct determination of hands (missing full house, two pair, straight with king-ace)
- determine on whether to disambiguate check and call, currently we are calling everything call
    - that could facilitate property testing (i.e. check never changes chips, pots or bets)

## prompts
### create new version of poker-state-machine
- base yourself on the types in `new_fsm.ts` and the implementation on `transitions.ts`
- players need to have status so we don't need to remove them from the players array (all_in, folded, in)
- you can have a single type for all the betting stages of the game (preflop, flop, river, turn)
- you need to keep information about the dealer, current player, blinds etc, but blinds is inferrable from dealer, and you can rotate the players array on state transition so the first index is always the current player. this is useful so our state object is lean is completely determines actual game state, that way it's harder to have illegal state being representable
- you need to keep current bet and total pot, and of course community cards
- besides that it's all player state, which is id, chips, hands, and bet (it's important that even folded players have bet because that's going to help to infer the side pots
- use effect-ts when applicable and read `prompt_small.md` on the root of the monorepo for reference
- for example, I think `Effect.gen(function* () { ... })` could be useful for the overall control flow of the state machine, and then we have individual transition functions which can return effects of PokerState and some error or whatever
- I want a better way of signaling state transition from different betting stages than we have currently, ideally in a way which doesn't need intermediary invalid states, so maybe returning an Effect as a Result or returning an union somewhere where the state could either keep in the same betting stage or transition to the next
- when you think you are done copy the test-cases from `state_machine.test.ts` and adapt them if needed, without changing the actual moves performed and asserted state
- do your implementation on `poker-state-machine/new-src`, break it in small files when needed

### implement state machine
// didn't actually yield that good results, poker is harder than I was expecting
poker state machine

based on the current implementation of the poker state machine, I want you to implement a new version. the state machine receives events and outputs the new state, and exposes that as a rxjs `BehaviorSubject`. I want architecture to be functional: functions may have internal mutation on cloned state, but all components need to be pure (i.e. (state, events) in -> state out)

events:
- player moves
- players entering or leaving the table

phases:
1. WAITING (not enough players in the table, let there be a param for minimum players before game starts)
2. after enough players enter the table, start PLAYING
3. deal cards, rotate and collect blinds
4. players bet until
4.1. a full rotation goes on without raising
4.2. at most one of the remaining players isn't all-in
4.3. all but one player has folded (go to 6? but you don't want to reveal hand, maybe create another state only for pot distribution)
5. TRANSITION, burn and flip community cards and unless the river is already dealt go back to 4
6. RESULTS, check hands, determine winner, distribute pot

details:
1. first player is the one after the dealer, except when there are only two players, then it is the dealer, and after the flop it becomes the other player


## sidepots draft
4 jogadores

(pote, chips) = (0, [100, 200, 200, 90])

se o de 100 dá all-in, o pote fica

(pote, chips) = (100, [0, to-call: 200, 200, 90])

se o primeiro dá call
(pote, chips) = (200, [0, 100, to-call: 200, 90])

se o segundo dá raise, isso cria um side-pot

(potes, (chips, pot_index)[]) = ([300, 20], [(0, 0), (100, 1), (80, 1), to-call: 90])

se o último dá all-in, isso shifta os potes:

(potes, (chips, pot_index)[]) = ([
    [360, 30, 20]
    ()
])

---------------------

chips: [100, 200, 200, _90]
potes: {
    0: [100, 200, 200, _90]
}

jogador 0 dá all-in

chips:   [__0, 200, 200, _90]
potes: {
    0  : [___, ___, ___, ___]
    100: [100, ___, ___, ___]
}

jogador 1 dá call

chips:   [__0, 100, 200, _90]
potes: {
    0  : [___, ___, 200, _90]
    100: [100, 100, ___, ___]
}

jogador 2 dá raise pra 120
chips:   [__0, 100, _80, _90]
potes: {
    0  : [___, ___, ___, _90]
    100: [100, 100, 100, ___]
    120: [___, ___, _20, ___]
}

jogador 3 der call
chips:   [__0, 100, _80, __0]
potes: {
    0  : [___, ___, ___, ___]
    90 : [_90, _90, _90, _90]
    100: [_10, _10, _10, ___]
    120: [___, ___, _20, ___]
}

skippa jogador 0 pq ele tá all-in
jogador 1 dá call
chips:   [__0, _80, _80, __0]
{
    0  : [___, ___, ___, ___]
    90 : [_90, _90, _90, _90]
    100: [_10, _10, _10, ___]
    120: [___, _20, _20, ___]
}

tá mas na real dá pra fazer assim

{
    0: [...rest],
    [SMALL_BLIND]: [SMALL_BLIND_ID]
    [BIG_BLIND]: [BIG_BLIND_ID]
}

tá na real é só trackear o que todo mundo apostou e na hora de vencer você cria um ordenamento parcial das mãos
começando pelo maior jogador, ele subtrai da mão dos outros o mínimo entre as apostas deles
se o maior jogador não estiver no maior pote, sobrou alguma quantidade apostada, logo você parte pro próximo
e assim recursivamente

[
    (100, __0)
    (200, __0)
    (200, __0)
    (_90, __0)
]
->
[
    (__0, 100)
    (200, __0)
    (200, __0)
    (_90, __0)
]
->
[
    (__0, 100)
    (100, 100)
    (200, __0)
    (_90, __0)
]
->
[
    (__0, 100)
    (100, 100)
    (_80, 120)
    (_90, __0)
]
->
[
    (__0, 100)
    (100, 100)
    (_80, 120)
    (__0, _90)
]
0 tá all-in ent skippa,
vamos fazer agr q o jogador 1 dá fold, logo a gente vai pra ordenação das mãos


supor q dá call
->
[
    (__0, 100)
    (_80, 120)
    (_80, 120)
    (__0, _90)
]

showdown

[trio, par, carta maior, full house]
prêmios:
[30, 40, 0, 360]
30 + 40 + 360 = 430
