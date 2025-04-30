import { expect, test } from "bun:test";
import { Option } from "effect";
import {
  PLAYER_DEFAULT_STATE,
  POKER_ROOM_DEFAULT_STATE,
} from "./state_machine";
import { bigBlind, currentPlayer, firstPlayerIndex, smallBlind } from "./queries";
import { BIG_BLIND, SMALL_BLIND } from "./transitions";
import { makePokerRoom } from "./room";
import { Effect } from "effect";
import type { GameEvent, PlayerState, PokerState } from "./schemas";

type Handless = { [id: string]: Omit<PlayerState, 'hand'> }

type Deckless = Omit<{
  [K in keyof PokerState]: K extends 'players'
    ? Handless
    : PokerState[K]
}, 'deck'>

function handless(players: { [id: string]: PlayerState } | Handless): Handless {
  // @ts-expect-error
  return Object.fromEntries(Object.entries(players).map(([id, { hand, ...player }]) => [id, player]))
}

// @ts-expect-error
function deckless({ deck, ...state }: PokerState | Deckless): Deckless {
  return {
    ...state,
    players: handless(state.players),
  }
}

// TODO: make the players field be a diff as well (so we don't have to `...states[1].players[id]`)
function expectStateDiff(states: PokerState[], diff: Partial<PokerState | Deckless>) {
  expect(deckless(states[0])).toEqual(deckless({ ...states[1], ...diff }))
}

type PokerRoomTestCase = {
    description: string
    minPlayers: number
    transitions: {
        event: GameEvent,
        diff: (previous: PokerState, current: PokerState) => Partial<PokerState | Deckless>,
        asserts?: (previous: PokerState, current: PokerState) => void
    }[]
}

const IDS = ['ID0', 'ID1'] as const

const testTable: PokerRoomTestCase[] = [
    {
        description: "complete game with two players",
        minPlayers: 2,
        transitions: [
            // player 0 joins
            {
                event: {
                    type: 'table',
                    action: 'join',
                    playerId: IDS[0]
                },
                diff: () => ({
                  players: {
                    [IDS[0]]: {
                      ...PLAYER_DEFAULT_STATE,
                      id: IDS[0],
                    },
                  },
                })
            },
            // player 1 joins
            {
                event: {
                    type: 'table',
                    action: 'join',
                    playerId: IDS[1]
                },
                diff: () => ({
                    status: 'PLAYING',
                    pot: SMALL_BLIND + BIG_BLIND,
                    bet: BIG_BLIND,
                    dealerIndex: 0,
                    // first  = dealer    & small blind & first player pre-flop
                    // second =             big blind   & first player post-flop
                    currentPlayerIndex: 0,
                    players: {
                        [IDS[0]]: {
                            id: IDS[0],
                            status: 'PLAYING',
                            chips: 100 - SMALL_BLIND,
                            bet: SMALL_BLIND,
                        },
                        [IDS[1]]: {
                            id: IDS[1],
                            status: 'PLAYING',
                            chips: 100 - BIG_BLIND,
                            bet: BIG_BLIND,
                        },
                    },
                }),
                asserts: (_previous, current) => {
                    expect(Object.values(current.players).map(p => p.hand.length)).toEqual([2, 2])
                    expect(smallBlind(current).id).toEqual(IDS[0]);
                    expect(dealer(current).id).toEqual(IDS[0]);
                    expect(bigBlind(current).id).toEqual(IDS[1]);
                    expect(firstPlayerIndex(current)).toBe(0)
                    expect(currentPlayer(current).id).toBe(IDS[0])
                }
            },
            // player 0 starts preflop and calls, player 1 to play
            {
                event: {
                    type: 'move',
                    playerId: IDS[0],
                    move: { type: 'call' }
                },
                diff: previous => ({
                  currentPlayerIndex: 1,
                  pot: previous.pot + (BIG_BLIND - SMALL_BLIND),
                  players: {
                    ...previous.players,
                    [IDS[0]]: {
                      ...previous.players[IDS[0]],
                      bet: BIG_BLIND,
                      chips: 100 - BIG_BLIND,
                    },
                  },
                })
            },
            // player 1 raises, player 0 to play
            {
                event: {
                    type: 'move',
                    playerId: IDS[1],
                    move: { type: "raise", amount: 30 }
                },
                diff: previous => ({
                    pot: previous.pot + (30 - BIG_BLIND),
                    bet: 30,
                    currentPlayerIndex: 0,
                    players: {
                      ...previous.players,
                      [IDS[1]]: {
                        ...previous.players[IDS[1]],
                        chips: 70,
                        bet: 30,
                      },
                    },
                })
            },
            // player 0 calls, player 1 to play
            {
                event: {
                    type: 'move',
                    playerId: IDS[0],
                    move: { type: 'call' }
                },
                diff: previous => ({
                    pot: previous.pot + (30 - BIG_BLIND),
                    bet: 30,
                    currentPlayerIndex: 1,
                    players: {
                      ...previous.players,
                      [IDS[0]]: {
                        ...previous.players[IDS[0]],
                        chips: 70,
                        bet: 30,
                      },
                    },
                })
            },
            // player 1 calls which triggers flop
            // post-flop with 2 players has inverted order
            // so player 1 plays again
            {
                event: {
                    type: 'move',
                    playerId: IDS[1],
                    move: { type: 'call' }
                },
                diff: (previous, current) => ({
                    bet: 0,
                    burnt: current.burnt,
                    community: current.community,
                    currentPlayerIndex: 0,
                    players: {
                      [IDS[0]]: {
                        ...previous.players[IDS[0]],
                        chips: 70,
                        bet: 0,
                      },
                      [IDS[1]]: {
                        ...previous.players[IDS[1]],
                        chips: 70,
                        bet: 0,
                      },
                    }
                }),
                asserts: (_previous, current) => {
                    expect(current.deck).toHaveLength(44);
                    expect(current.burnt).toHaveLength(1);
                    expect(current.community).toHaveLength(3);
                    expect(firstPlayerIndex(current)).toBe(1);
                    expect(currentPlayer(current).id).toBe(IDS[1]);
                }
            },
            // player 1 calls, player 0 to play
            {
                event: {
                    type: 'move',
                    playerId: IDS[1],
                    move: { type: 'call' }
                },
                diff: () => ({ currentPlayerIndex: 1 }),
                asserts: (_previous, current) => {
                    expect(current.deck).toHaveLength(44);
                    expect(current.burnt).toHaveLength(1);
                    expect(current.community).toHaveLength(3);
                    expect(currentPlayer(current).id).toBe(IDS[0]);
                }
            },
            // player 0 calls, which triggers turn, player 1 plays
            {
                event: {
                    type: 'move',
                    playerId: IDS[0],
                    move: { type: 'call' }
                },
                diff: (_previous, current) => ({
                    // TODO: we could assert these come from the top of previous state's deck?
                    burnt: current.burnt,
                    community: current.community,
                    currentPlayerIndex: 0
                }),
                asserts: (_previous, current) => {
                    expect(current.deck).toHaveLength(42);
                    expect(current.burnt).toHaveLength(2);
                    expect(current.community).toHaveLength(4);
                    expect(currentPlayer(current).id).toBe(IDS[1]);
                }
            },
            // player 1 calls, player 0 to play
            {
                event: {
                    type: 'move',
                    playerId: IDS[1],
                    move: { type: 'call' }
                },
                diff: () => ({ currentPlayerIndex: 1 }),
                asserts: (_previous, current) => {
                    expect(currentPlayer(current).id).toBe(IDS[0]);
                }
            },
            // player 0 calls, triggers river, player 1 to play
            {
                event: {
                    type: 'move',
                    playerId: IDS[0],
                    move: { type: 'call' }
                },
                diff: (_previous, current) => ({
                    burnt: current.burnt,
                    community: current.community,
                    currentPlayerIndex: 0,
                }),
                asserts: (_previous, current) => {
                    expect(current.deck).toHaveLength(40);
                    expect(current.burnt).toHaveLength(3);
                    expect(current.community).toHaveLength(5);
                    expect(currentPlayer(current).id).toBe(IDS[1]);
                }
            },
            // player 1 raises, player 0 to play
            {
                event: {
                    type: 'move',
                    playerId: IDS[1],
                    move: { type: 'raise', amount: 40 }
                },
                diff: previous => ({
                    pot: 100,
                    bet: 40,
                    players: {
                        ...previous.players,
                        [IDS[1]]: {
                            ...previous.players[IDS[1]],
                            bet: 40,
                            chips: 30
                        }
                    },
                    currentPlayerIndex: 1,
                }),
                asserts: (_previous, current) => {
                    expect(currentPlayer(current).id).toBe(IDS[0]);
                }
            },
            // player 0 folds, player 1 wins
            {
                event: {
                    type: 'move',
                    playerId: IDS[0],
                    move: { type: 'fold' }
                },
                diff: () => ({}),
                asserts: (_previous, current) => {
                    expect(current.winningPlayerId).toBeTruthy();
                    expect(current.winningPlayerId).toBe(Option.some(IDS[1]));
                }
            }
        ]
    }
]

for (const testCase of testTable) {
    test(testCase.description, async function() {
        await Effect.runPromise(Effect.gen(function*() {
            const pokerRoom = yield* makePokerRoom(testCase.minPlayers)
            const states = [yield* pokerRoom.currentState()]
            expect(states[0]).toEqual(POKER_ROOM_DEFAULT_STATE);

            for (const transition of testCase.transitions) {
                yield* pokerRoom.processEvent(transition.event)
                states.unshift(yield* pokerRoom.currentState())
                expectStateDiff(states, transition.diff(states[1], states[0]))
                transition.asserts?.(states[1], states[0])
            }
        }))
    })
}

// test("complete game with two players", async () => {
//     await Effect.runPromise(Effect.gen(function* () {
//         const pokerRoom = yield* makePokerRoom(2)
//         const states = [yield* pokerRoom.currentState()]
//         expect(states[0]).toEqual(POKER_ROOM_DEFAULT_STATE);

//         const firstPlayerId = 'ID1';
//         yield* pokerRoom.processEvent({
//             type: 'table',
//             action: 'join',
//             playerId: 'ID0'
//         })
//         states.unshift(yield* pokerRoom.currentState())
//         expectStateDiff(states, {
//           players: {
//             'ID0': {
//               ...PLAYER_DEFAULT_STATE,
//               id: 'ID0',
//             },
//           },
//         });

//         const secondPlayerId = 'ID2';
//         yield* pokerRoom.processEvent({
//             type: 'table',
//             action: 'join',
//             playerId: secondPlayerId
//         })
//         states.unshift(yield* pokerRoom.currentState())
//         expectStateDiff(states, {
//           status: 'PLAYING',
//           pot: SMALL_BLIND + BIG_BLIND,
//           bet: BIG_BLIND,
//           dealerIndex: 0,
//           // first  = dealer    & small blind & first player pre-flop
//           // second =             big blind   & first player post-flop
//           currentPlayerIndex: 0,
//           players: {
//             [firstPlayerId]: {
//               id: firstPlayerId,
//               status: 'PLAYING',
//               chips: 100 - SMALL_BLIND,
//               bet: SMALL_BLIND,
//             },
//             [secondPlayerId]: {
//               id: secondPlayerId,
//               status: 'PLAYING',
//               chips: 100 - BIG_BLIND,
//               bet: BIG_BLIND,
//             },
//           },
//         });
//         expect(Object.values(states[0].players).map(p => p.hand.length)).toEqual([2, 2])

//         expect(smallBlind(states[0]).id).toEqual(firstPlayerId);
//         expect(dealer(states[0]).id).toEqual(firstPlayerId);
//         expect(bigBlind(states[0]).id).toEqual(secondPlayerId);
//         expect(firstPlayerIndex(states[0])).toBe(0)
//         expect(currentPlayer(states[0]).id).toBe(firstPlayerId)

//         // player 0 starts preflop and calls, player 1 to play
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: firstPlayerId,
//             move: { type: 'call' }
//         });
//         states.unshift(yield* pokerRoom.currentState())
//         expectStateDiff(states, {
//           currentPlayerIndex: 1,
//           pot: states[1].pot + (BIG_BLIND - SMALL_BLIND),
//           players: {
//             ...states[1].players,
//             [firstPlayerId]: {
//               ...states[1].players[firstPlayerId],
//               bet: BIG_BLIND,
//               chips: 100 - BIG_BLIND,
//             },
//           },
//         });

//         // player 1 raises, player 0 to play
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: secondPlayerId,
//             move: { type: "raise", amount: 30 }
//         });
//         states.unshift(yield* pokerRoom.currentState())
//         expectStateDiff(states, {
//           pot: states[1].pot + (30 - BIG_BLIND),
//           bet: 30,
//           currentPlayerIndex: 0,
//           players: {
//             ...states[1].players,
//             [secondPlayerId]: {
//               ...states[1].players[secondPlayerId],
//               chips: 70,
//               bet: 30,
//             },
//           },
//         });

//         // player 0 calls, player 1 to play
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: firstPlayerId,
//             move: { type: 'call' }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expectStateDiff(states, {
//           pot: states[1].pot + (30 - BIG_BLIND),
//           bet: 30,
//           currentPlayerIndex: 1,
//           players: {
//             ...states[1].players,
//             [firstPlayerId]: {
//               ...states[1].players[firstPlayerId],
//               chips: 70,
//               bet: 30,
//             },
//           },
//         });

//         // player 1 calls which triggers flop
//         // post-flop with 2 players has inverted order
//         // so player 1 plays again
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: secondPlayerId,
//             move: { type: 'call' }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expectStateDiff(states, {
//           bet: 0,
//           burnt: states[0].burnt,
//           community: states[0].community,
//           currentPlayerIndex: 0,
//           players: {
//             [firstPlayerId]: {
//               ...states[1].players[firstPlayerId],
//               chips: 70,
//               bet: 0,
//             },
//             [secondPlayerId]: {
//               ...states[1].players[secondPlayerId],
//               chips: 70,
//               bet: 0,
//             },
//           }
//         });
//         expect(states[0].deck).toHaveLength(44);
//         expect(states[0].burnt).toHaveLength(1);
//         expect(states[0].community).toHaveLength(3);
//         expect(firstPlayerIndex(states[0])).toBe(1);
//         expect(currentPlayer(states[0]).id).toBe(secondPlayerId);

//         // player 1 calls, player 0 to play
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: secondPlayerId,
//             move: { type: 'call' }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expectStateDiff(states, { currentPlayerIndex: 1 });
//         expect(states[0].deck).toHaveLength(44);
//         expect(states[0].burnt).toHaveLength(1);
//         expect(states[0].community).toHaveLength(3);
//         expect(currentPlayer(states[0]).id).toBe(firstPlayerId);

//         // player 0 calls, which triggers turn, player 1 plays
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: firstPlayerId,
//             move: { type: 'call' }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expectStateDiff(states, {
//           // TODO: we could assert these come from the top of previous state's deck?
//           burnt: states[0].burnt,
//           community: states[0].community,
//           currentPlayerIndex: 0
//         });
//         expect(states[0].deck).toHaveLength(42);
//         expect(states[0].burnt).toHaveLength(2);
//         expect(states[0].community).toHaveLength(4);
//         expect(currentPlayer(states[0]).id).toBe(secondPlayerId);

//         // player 1 calls, player 0 to play
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: secondPlayerId,
//             move: { type: 'call' }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expectStateDiff(states, { currentPlayerIndex: 1 })
//         expect(currentPlayer(states[0]).id).toBe(firstPlayerId);

//         // player 0 calls, triggers river, player 1 to play
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: firstPlayerId,
//             move: { type: 'call' }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expectStateDiff(states, {
//           burnt: states[0].burnt,
//           community: states[0].community,
//           currentPlayerIndex: 0,
//         });
//         expect(states[0].deck).toHaveLength(40);
//         expect(states[0].burnt).toHaveLength(3);
//         expect(states[0].community).toHaveLength(5);
//         expect(currentPlayer(states[0]).id).toBe(secondPlayerId);

//         // player 1 raises, player 0 to play
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: secondPlayerId,
//             move: { type: 'raise', amount: 40 }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expectStateDiff(states, {
//           pot: 100,
//           bet: 40,
//           players: {
//             ...states[1].players,
//             [secondPlayerId]: {
//               ...states[1].players[secondPlayerId],
//               bet: 40,
//               chips: 30
//             }
//           },
//           currentPlayerIndex: 1,
//         })
//         expect(currentPlayer(states[0]).id).toBe(firstPlayerId);

//         // player 0 folds, player 1 wins
//         yield* pokerRoom.processEvent({
//             type: 'move',
//             playerId: firstPlayerId,
//             move: { type: 'fold' }
//         });
//         states.unshift(yield* pokerRoom.currentState());
//         expect(states[0].winningPlayerId).toBeTruthy();
//         expect(states[0].winningPlayerId).toBe(secondPlayerId);
//     }))
// });
