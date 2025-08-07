import { Effect, Ref, Context, Layer, LogLevel } from "effect";
import { makePokerRoom, type PokerGameService } from "poker-state-machine";

export interface RoomManager {
  readonly getRoom: (roomId: string) => Effect.Effect<PokerGameService>;
  readonly removeRoom: (roomId: string) => Effect.Effect<void>;
  readonly listRooms: () => Effect.Effect<string[]>;
}

export const RoomManager = Context.GenericTag<RoomManager>("@app/RoomManager");

export const RoomManagerLive = Layer.effect(
  RoomManager,
  Effect.gen(function* () {
    const roomsRef = yield* Ref.make<Map<string, PokerGameService>>(new Map());
    
    const minPlayers = process.env.MIN_PLAYERS
      ? Number(process.env.MIN_PLAYERS)
      : 2;
      
    const logLevel =
      process.env.LOG_LEVEL === "debug" ? LogLevel.Debug : LogLevel.Info;
    
    return RoomManager.of({
      getRoom: (roomId: string) => 
        Effect.gen(function* () {
          const rooms = yield* Ref.get(roomsRef);
          const existingRoom = rooms.get(roomId);
          
          if (existingRoom) {
            return existingRoom;
          }
          
          console.log(`Creating new poker room: ${roomId}`);
          const newRoom = yield* makePokerRoom(minPlayers, logLevel);
          
          // Update the map
          yield* Ref.update(roomsRef, (map) => {
            const newMap = new Map(map);
            newMap.set(roomId, newRoom);
            return newMap;
          });
          
          return newRoom;
        }),
        
      removeRoom: (roomId: string) =>
        Effect.gen(function* () {
          yield* Ref.update(roomsRef, (map) => {
            const newMap = new Map(map);
            newMap.delete(roomId);
            return newMap;
          });
          console.log(`Removed poker room: ${roomId}`);
        }),
        
      listRooms: () =>
        Effect.gen(function* () {
          const rooms = yield* Ref.get(roomsRef);
          return Array.from(rooms.keys());
        })
    });
  })
);
