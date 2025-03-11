import { expect, test } from "bun:test";
import {
  BIG_BLIND,
  bigBlind,
  currentPlayer,
  dealer,
  firstPlayerIndex,
  PLAYER_DEFAULT_STATE,
  POKER_ROOM_DEFAULT_STATE,
  PokerRoomStateMachine,
  SMALL_BLIND,
  smallBlind,
  type PlayerState,
  type PokerState,
} from "./state_machine";

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

test("complete game with two players", async () => {
  const pokerRoom = new PokerRoomStateMachine(2);
  const states = [pokerRoom.value];
  expect(states[0]).toEqual(POKER_ROOM_DEFAULT_STATE);

  const firstPlayerId = 'ID1';
  pokerRoom.addPlayer(firstPlayerId);
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    players: {
      [firstPlayerId]: {
        ...PLAYER_DEFAULT_STATE,
        id: firstPlayerId,
      },
    },
  });

  const secondPlayerId = 'ID2';
  pokerRoom.addPlayer(secondPlayerId);
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    status: "PLAYING",
    pot: SMALL_BLIND + BIG_BLIND,
    bet: BIG_BLIND,
    dealerIndex: 0,
    // first  = dealer    & small blind & first player pre-flop
    // second =             big blind   & first player post-flop
    currentPlayerIndex: 0,
    players: {
      [firstPlayerId]: {
        id: firstPlayerId,
        status: "PLAYING",
        chips: 100 - SMALL_BLIND,
        bet: SMALL_BLIND,
      },
      [secondPlayerId]: {
        id: secondPlayerId,
        status: "PLAYING",
        chips: 100 - BIG_BLIND,
        bet: BIG_BLIND,
      },
    },
  });
  expect(Object.values(states[0].players).map(p => p.hand.length)).toEqual([2, 2])
  
  expect(smallBlind(states[0]).id).toEqual(firstPlayerId);
  expect(dealer(states[0]).id).toEqual(firstPlayerId);
  expect(bigBlind(states[0]).id).toEqual(secondPlayerId);
  expect(firstPlayerIndex(states[0])).toBe(0)
  expect(currentPlayer(states[0]).id).toBe(firstPlayerId)

  // player 0 starts preflop and calls, player 1 to play
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    currentPlayerIndex: 1,
    pot: states[1].pot + (BIG_BLIND - SMALL_BLIND),
    players: {
      ...states[1].players,
      [firstPlayerId]: {
        ...states[1].players[firstPlayerId],
        bet: BIG_BLIND,
        chips: 100 - BIG_BLIND,
      },
    },
  });

  // player 1 raises, player 0 to play
  pokerRoom.processPlayerMove({ type: "raise", amount: 30 });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    pot: states[1].pot + (30 - BIG_BLIND),
    bet: 30,
    currentPlayerIndex: 0,
    players: {
      ...states[1].players,
      [secondPlayerId]: {
        ...states[1].players[secondPlayerId],
        chips: 70,
        bet: 30,
      },
    },
  });

  // player 0 calls, player 1 to play
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    pot: states[1].pot + (30 - BIG_BLIND),
    bet: 30,
    currentPlayerIndex: 1,
    players: {
      ...states[1].players,
      [firstPlayerId]: {
        ...states[1].players[firstPlayerId],
        chips: 70,
        bet: 30,
      },
    },
  });

  // player 1 calls which triggers flop
  // post-flop with 2 players has inverted order
  // so player 1 plays again
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    bet: 0,
    burnt: states[0].burnt,
    community: states[0].community,
    currentPlayerIndex: 0,
    players: {
      [firstPlayerId]: {
        ...states[1].players[firstPlayerId],
        chips: 70,
        bet: 0,
      },
      [secondPlayerId]: {
        ...states[1].players[secondPlayerId],
        chips: 70,
        bet: 0,
      },
    }
  });
  expect(states[0].deck).toHaveLength(44);
  expect(states[0].burnt).toHaveLength(1);
  expect(states[0].community).toHaveLength(3);
  expect(firstPlayerIndex(states[0])).toBe(1);
  expect(currentPlayer(states[0]).id).toBe(secondPlayerId);

  // player 1 calls, player 0 to play
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, { currentPlayerIndex: 1 });
  expect(states[0].deck).toHaveLength(44);
  expect(states[0].burnt).toHaveLength(1);
  expect(states[0].community).toHaveLength(3);
  expect(currentPlayer(states[0]).id).toBe(firstPlayerId);

  // player 0 calls, which triggers turn, player 1 plays
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    // TODO: we could assert these come from the top of previous state's deck?
    burnt: states[0].burnt,
    community: states[0].community,
    currentPlayerIndex: 0
  });
  expect(states[0].deck).toHaveLength(42);
  expect(states[0].burnt).toHaveLength(2);
  expect(states[0].community).toHaveLength(4);
  expect(currentPlayer(states[0]).id).toBe(secondPlayerId);

  // player 1 calls, player 0 to play
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, { currentPlayerIndex: 1 })
  expect(currentPlayer(states[0]).id).toBe(firstPlayerId);

  // player 0 calls, triggers river, player 1 to play
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    burnt: states[0].burnt,
    community: states[0].community,
    currentPlayerIndex: 0,
  });
  expect(states[0].deck).toHaveLength(40);
  expect(states[0].burnt).toHaveLength(3);
  expect(states[0].community).toHaveLength(5);
  expect(currentPlayer(states[0]).id).toBe(secondPlayerId);

  // player 1 raises, player 0 to play
  pokerRoom.processPlayerMove({ type: "raise", amount: 40 });
  states.unshift(pokerRoom.value);
  expectStateDiff(states, {
    pot: 100,
    bet: 40,
    players: {
      ...states[1].players,
      [secondPlayerId]: {
        ...states[1].players[secondPlayerId],
        bet: 40,
        chips: 30 
      }
    },
    currentPlayerIndex: 1,
  })
  expect(currentPlayer(states[0]).id).toBe(firstPlayerId); 

  // player 0 folds, player 1 wins
  pokerRoom.processPlayerMove({ type: "fold" });
  states.unshift(pokerRoom.value);
  expect(states[0].winningPlayerId).toBeTruthy();
  expect(states[0].winningPlayerId).toBe(secondPlayerId);
});
