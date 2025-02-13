import { expect, test } from "bun:test";
import {
  BIG_BLIND,
  bigBlind,
  firstPlayer,
  PLAYER_DEFAULT_STATE,
  POKER_ROOM_DEFAULT_STATE,
  PokerRoomStateMachine,
  SMALL_BLIND,
  smallBlind,
} from "./state_machine";

test("start round works as expected with two players", async () => {
  const pokerRoom = new PokerRoomStateMachine();
  const states = [pokerRoom.value];
  expect(states[0]).toEqual(POKER_ROOM_DEFAULT_STATE);

  const firstPlayerId = Bun.randomUUIDv7();
  pokerRoom.addPlayer(firstPlayerId);
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
    players: {
      [firstPlayerId]: {
        ...PLAYER_DEFAULT_STATE,
        id: firstPlayerId,
      },
    },
  });

  const secondPlayerId = Bun.randomUUIDv7();
  pokerRoom.addPlayer(secondPlayerId);
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
    status: "PLAYING",
    pot: SMALL_BLIND + BIG_BLIND,
    bet: BIG_BLIND,
    dealerIndex: 0,
    // (first, second) = (dealer & small blind & first player, big blind)
    currentPlayerIndex: 0,
    // i mean it's random...
    deck: pokerRoom.value.deck,
    players: {
      [firstPlayerId]: {
        id: firstPlayerId,
        status: "PLAYING",
        chips: 100 - SMALL_BLIND,
        bet: SMALL_BLIND,
        hand: pokerRoom.value.players[firstPlayerId].hand,
      },
      [secondPlayerId]: {
        id: secondPlayerId,
        status: "PLAYING",
        chips: 100 - BIG_BLIND,
        bet: BIG_BLIND,
        hand: pokerRoom.value.players[secondPlayerId].hand,
      },
    },
  });

  expect(smallBlind(pokerRoom.value).id).toEqual(firstPlayerId);
  expect(bigBlind(pokerRoom.value).id).toEqual(secondPlayerId);

  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
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

  pokerRoom.processPlayerMove({ type: "raise", amount: 30 });
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
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

  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
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

  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
    deck: states[0].deck,
    burnt: states[0].burnt,
    community: states[0].community,
    currentPlayerIndex: 0,
  });
  expect(states[0].deck).toHaveLength(48);
  expect(states[0].burnt).toHaveLength(1);
  expect(states[0].community).toHaveLength(3);

  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
    deck: states[0].deck,
    burnt: states[0].burnt,
    community: states[0].community,
    currentPlayerIndex: 0,
  });
  expect(states[0].deck).toHaveLength(46);
  expect(states[0].burnt).toHaveLength(2);
  expect(states[0].community).toHaveLength(4);

  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  pokerRoom.processPlayerMove({ type: "call" });
  states.unshift(pokerRoom.value);
  expect(states[0]).toEqual({
    ...states[1],
    deck: states[0].deck,
    burnt: states[0].burnt,
    community: states[0].community,
    currentPlayerIndex: 0,
  });
  expect(states[0].deck).toHaveLength(44);
  expect(states[0].burnt).toHaveLength(3);
  expect(states[0].community).toHaveLength(5);

  pokerRoom.processPlayerMove({ type: "raise", amount: 40 });
  states.unshift(pokerRoom.value);
  pokerRoom.processPlayerMove({ type: "fold" });
  states.unshift(pokerRoom.value);
  expect(states[0].winningPlayerId).toBeTruthy();

  // pokerRoom.processPlayerMove({ type: "call" });
  // states.unshift(pokerRoom.value);
  // pokerRoom.processPlayerMove({ type: "call" });
  // states.unshift(pokerRoom.value);
  // expect(states[0]).toEqual({
  //   ...states[1],
  //   // TODO: check if this makes sense but it's likely irrelevant
  //   currentPlayerIndex: 0,
  //   winningPlayerId: states[0].winningPlayerId,
  // });
});
