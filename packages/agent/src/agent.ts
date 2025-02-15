import type { CreateTRPCProxyClient } from "@trpc/client";
import {
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
  GameAgent,
  GameFunction,
  GameWorker,
} from "@virtuals-protocol/game";
import { getPokerRoomClient, type PokerRoomClient } from 'client'
import { roundRotation, type Card, type Move, type PlayerView, type PokerState } from "poker-state-machine";

type AgentParams = {
  name: string;
  goal: string;
  description: string;
};

type PokerReport = {
  moves: Move[];
  playerView: PlayerView;
};

const waitTurn = (pokerRoomClient: PokerRoomClient, playerId: string): Promise<PokerReport> => {
  return new Promise<PokerReport>((resolve) => {
    console.log("Agent waiting for its turn...", { playerId })
    const moves: Move[] = []

    pokerRoomClient.onMove.subscribe(undefined, {
      onData(data: Move) {
        moves.push(data)
      }
    })

    pokerRoomClient.onPlayerView.subscribe({ playerId }, {
      onData(playerView: PlayerView) {
        if ([playerView.currentPlayerId, playerView.winningPlayerId].includes(playerId)) {
          resolve({ moves, playerView })
        }
      }
    })
  })
};

function printCard(card: Card): string {
  return `${card.rank} of ${card.suit}`
}

function printPlayerView(playerView: PlayerView): string {
  return (
    `Your hand: ${playerView.hand.map(printCard).join(", ")}
Your bet and current table bet: ${playerView.player.bet} & ${playerView.bet}
Community Cards: ${playerView.community.map(printCard).join(", ")}
`)
}

function printLastMoves(moves: Move[]) {
  return moves.map(move => move.type === 'raise' ? `${move.type} ${move.amount}` : `${move.type}`).join("\n")
}

function printSummary(playerId: string, playerView: PlayerView, moves: Move[]) {
  if (playerView.winningPlayerId === playerId) {
    return [
      "You won the game! Use 'perform_poker_action' to play again.",
      printPlayerView(playerView),
      printLastMoves(moves),
    ].join('\n\n');
  }

  if (playerView.winningPlayerId) {
    return [
      `Player ${playerView.winningPlayerId} won the game! You lost. Use 'perform_poker_action' to play again.`,
      printPlayerView(playerView),
      printLastMoves(moves),
    ].join('\n\n');
  }

  return [
    printPlayerView(playerView),
    printLastMoves(moves),
    `it's your turn to play, decide if you want to fold, call or raise, and call 'perform_poker_action'.
      read your 'playerView' to see your cards and chips. Check 'moves' to see what actions were performed since your last turn`
  ].join('\n\n')
}

export class PokerAgent {
  private agent: GameAgent
  private worker: GameWorker
  public lastResponse: {
    summary?: string,
    playerView?: PlayerView,
    playerId?: string,
    moves?: Move[]
  } = {}

  public playerView?: PlayerView

  constructor(
    apiKey: string,
    private pokerRoomClient: PokerRoomClient,
    { name, goal, description }: AgentParams
  ) {
    this.worker = new GameWorker({
      id: "poker",
      name: "Poker Worker",
      description: "Responsible for interfacing with the poker server. Keep calling 'perform_poker_action' until the game is over. This worker will handle the game logic and provide the necessary information to the agent.",
      functions: [
        // removing joinPokerTable because the way GAME SDK yield flow back is kinda tricky
        // since it limits us to 5 steps execution, so I'm taking control of the flow
        // joinPokerTable(this.pokerRoomClient, this),
        // removing poker state because we can yield to the agent only when it has to play
        // and already providing the state.
        // getPokerState(this.pokerRoomClient),
        performPokerAction(this.pokerRoomClient, this),
      ],
      getEnvironment: async () => {
        return { lastResponse: this.lastResponse };
      }
    });


    this.agent = new GameAgent(apiKey, {
      name,
      goal,
      description,
      workers: [this.worker],
      getAgentState: async () => {
        return { lastResponse: this.lastResponse };
      }
    });

    this.agent.setLogger((agent, message) => {
      console.log(`${agent.name}: `);
      console.log(message);
      console.log("-----------");
    });
  }

  public recordLastResponse(playerId: string, playerView: PlayerView, moves: Move[]) {
    this.lastResponse.summary = printSummary(playerId, playerView, moves);
    if (!playerView.winningPlayerId) {
      this.lastResponse.playerView = playerView;
      this.lastResponse.playerId = playerId;
      this.lastResponse.moves = moves;
    }
  }

  public async init() {
    while (true) {
      const { playerId } = await this.pokerRoomClient.joinTable.mutate()!
      await new Promise<void>(async resolve => {
        this.pokerRoomClient.onPlayerView.subscribe({ playerId: playerId! }, {
          onData: (playerView: PlayerView) => {
            this.playerView = playerView

            if (playerView.winningPlayerId) {
              resolve()
            }
          }
        })
        await this.agent.init()

        const { moves, playerView } = await waitTurn(this.pokerRoomClient, playerId!);
        this.recordLastResponse(playerId!, playerView, moves)

        this.agent.run(5, { verbose: true })
      })
    }
  }
}

export const joinPokerTable = (pokerRoomClient: PokerRoomClient, agent: PokerAgent) => new GameFunction({
  name: "join_poker_table",
  description: "Join a table and wait for the game to start and your turn to play.",
  args: [] as const,
  async executable(args, logger) {
    try {
      const { playerId } = await pokerRoomClient.joinTable.mutate()

      const { moves, playerView } = await waitTurn(pokerRoomClient, playerId)
      agent.recordLastResponse(playerId!, playerView, moves)

      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Done,
        [printPlayerView(playerView), printLastMoves(moves), JSON.stringify(agent.lastResponse)].join('\n\n')
      );
    } catch (err) {
      if (err instanceof Error) {
        return new ExecutableGameFunctionResponse(
          ExecutableGameFunctionStatus.Failed,
          `Poker server returned: ${err.message}`,
        );
      }
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Internal server error`,
      );
    }
  },
});

export const getPokerState = (pokerRoomClient: PokerRoomClient) => new GameFunction({
  name: "get_poker_state",
  description: "Gets the current poker state (chips, cards) for a given agent",
  args: [
    {
      name: "playerId",
      description: "Agent's player ID",
      optional: false,
      type: "string",
    },
  ] as const,
  executable: async ({ playerId }, logger) => {
    const result = await pokerRoomClient.getState.query();
    if ("error" in result) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Poker server returned: ${result.error}`,
      );
    }
    return new ExecutableGameFunctionResponse(
      ExecutableGameFunctionStatus.Done,
      JSON.stringify(result),
    );
  },
});

export const performPokerAction = (pokerRoomClient: PokerRoomClient, agent: PokerAgent) => new GameFunction({
  name: "perform_poker_action",
  description:
    "Commits your poker move for this turn, be it pay, raise or fold",
  args: [
    {
      name: "playerId",
      description: "Agent ID",
      optional: false,
      type: "string",
    },
    {
      name: "type",
      description: "Pay, raise, or fold",
      optional: false,
      type: "string",
    },
    {
      name: "amount",
      description: "If raise, this is the amount of chips",
      optional: true,
      type: "number",
    },
  ] as const,
  hint: "Play perform_poker_action as your next action always. After one round ends the next one will begin.",
  async executable({ playerId, type, amount }, logger) {
    if (type === 'raise' && !amount) {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        "For raise you need to specify the amount of chips",
      );
    } else if (type === 'raise') {
      await pokerRoomClient.move.mutate({ playerId: playerId!, move: { type, amount: parseInt(amount!) }});
    } else if (type === 'call' || type === 'fold') {
      await pokerRoomClient.move.mutate({ playerId: playerId!, move: { type }});
    } else {
      return new ExecutableGameFunctionResponse(
        ExecutableGameFunctionStatus.Failed,
        `Move not recognized, must be call, raise or fold: ${type}`,
      );
    }

    const { moves, playerView } = await waitTurn(pokerRoomClient, playerId!);
    agent.recordLastResponse(playerId!, playerView, moves)

    return new ExecutableGameFunctionResponse(
      ExecutableGameFunctionStatus.Done,
      [printPlayerView(playerView), printLastMoves(moves), JSON.stringify(agent.lastResponse)].join('\n\n')
    );
  },
});
