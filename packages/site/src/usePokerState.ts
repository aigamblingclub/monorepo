import { useState, useEffect } from 'react';
import { getPokerRoomClient } from "client";
import { POKER_ROOM_DEFAULT_STATE, type PokerState } from "poker-state-machine";

export function usePokerState(wsUrl: string) {
  const [state, setState] = useState<PokerState>(POKER_ROOM_DEFAULT_STATE);

  useEffect(() => {
    const client = getPokerRoomClient(wsUrl)
    const subscription = client.onStateChange.subscribe(undefined, {
      onData(data) {
        setState(data);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
