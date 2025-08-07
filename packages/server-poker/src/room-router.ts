import { Effect, Stream, pipe } from "effect";
import { RoomManager } from "./room-manager";
import { RoomPokerRpc } from "./rpc";

export const RoomPokerRpcLive = RoomPokerRpc.toLayer(
  Effect.gen(function* () {
    const roomManager = yield* RoomManager;

    return {
      currentState: (payload, _headers) => {
        return Effect.gen(function* () {
          const room = yield* roomManager.getRoom(payload.roomId);
          return yield* room.currentState();
        });
      },
      
      processEvent: (payload, _headers) => {
        return Effect.gen(function* () {
          const room = yield* roomManager.getRoom(payload.roomId);
          return yield* room.processEvent(payload.event);
        });
      },
      
      playerView: (payload, _headers) => {
        return Effect.gen(function* () {
          const room = yield* roomManager.getRoom(payload.roomId);
          return yield* room.playerView(payload.playerId);
        });
      },
      
      stateUpdates: (payload, _headers) => {
        // stateUpdates is a Stream, not an Effect
        // We need to get the room first (which is an Effect), then return the stream
        return pipe(
          roomManager.getRoom(payload.roomId),
          Effect.map(room => room.stateUpdates),
          Stream.unwrap,
        );
      },
      
      startGame: (payload, _headers) => {
        return Effect.gen(function* () {
          const room = yield* roomManager.getRoom(payload.roomId);
          return yield* room.startGame();
        });
      },
    };
  })
);