import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { PokerRoomStateMachine, seatedPlayers } from "./state_machine";

const ROOM = new PokerRoomStateMachine();
const pokerRouter = router({
  joinTable: publicProcedure.mutation(async () => {
    if (seatedPlayers(ROOM.value) >= 8) {
      console.log("Player tried to join full table.");
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Table currently full, cannot join.",
      });
    }

    const playerId = Bun.randomUUIDv7();
    ROOM.addPlayer(playerId);

    return { playerId };
  }),

  getState: publicProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      return ROOM.playerView(input.playerId);
    }),

  move: publicProcedure
    .input(
      z.object({
        playerId: z.string(),
        // move schema from here and create type with infer
        move: z
          .object({
            type: z.enum(["call", "fold"]),
          })
          .or(
            z.object({
              type: z.literal("raise"),
              amount: z.number(),
            }),
          ),
      }),
    )
    .mutation(({ input }) => {
      const { playerId, move } = input;

      if (playerId !== ROOM.currentPlayerId()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "It's not your turn yet.",
        });
      }

      return ROOM.processPlayerMove(move);
    }),
});
