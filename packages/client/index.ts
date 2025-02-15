import { createTRPCProxyClient, createWSClient, loggerLink, wsLink, type CreateTRPCProxyClient } from "@trpc/client";
import { type PokerRouter } from "server";

export type PokerRoomClient = CreateTRPCProxyClient<PokerRouter>

export function getPokerRoomClient(url: string): PokerRoomClient {
  const wsClient = createWSClient({
    url
  });

  return createTRPCProxyClient<PokerRouter>({
    links: [
      loggerLink({
        enabled: () => true,
      }),
      wsLink<PokerRouter>({
        client: wsClient,
      }),
    ],
  });
}

export type { PokerRouter }
