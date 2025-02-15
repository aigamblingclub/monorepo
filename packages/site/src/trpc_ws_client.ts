import { getPokerRoomClient } from "client";

const sub = getPokerRoomClient("ws://localhost:3001").onStateChange.subscribe(undefined, {
  onData(data) {
    console.log({ data });
  }
});
