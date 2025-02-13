import {
  ExecutableGameFunctionResponse,
  ExecutableGameFunctionStatus,
  GameAgent,
  GameFunction,
  GameWorker,
} from "@virtuals-protocol/game";

if (!process.env.GAME_API_KEY) {
  throw new Error("missing GAME_API_KEY environment variable");
}

const POKER_SERVER_URL = "http://localhost:5768";

export const joinPokerTable = new GameFunction({
  name: "join_poker_table",
  description: "Join a table to start playing",
  args: [] as const,
  async executable(args, logger) {
    const result = await (await fetch(`${POKER_SERVER_URL}/join`)).json();
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

export const getPokerState = new GameFunction({
  name: "get_poker_state",
  description: "Gets the current poker state (chips, cards) for a given agent",
  args: [
    {
      name: "agentId",
      description: "Agent ID",
      optional: false,
      type: "string",
    },
  ] as const,
  executable: async (args, logger) => {
    const result = await (
      await fetch(`${POKER_SERVER_URL}/state?id=${args.agentId}`)
    ).json();
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

export const performPokerAction = new GameFunction({
  name: "perform_poker_action",
  description:
    "Commits your poker move for this turn, be it pay, raise or fold",
  args: [
    {
      name: "agentId",
      description: "Agent ID",
      optional: false,
      type: "string",
    },
    {
      name: "action",
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
  async executable(args, logger) {},
});

export const pokerWorker = new GameWorker({
  id: "poker",
  name: "Poker Worker",
  description: "Responsible for interfacing with the poker server",
  functions: [joinPokerTable, getPokerState],
});

export const pokerAgent = new GameAgent(process.env.GAME_API_KEY, {
  name: "Poker Agent",
  goal: "Play poker and manage your chips and bets to maximize your outcome",
  description: `
    You are a poker AI agent that will play with other agents in a virtual table.
    To join a table call 'join_poker_table'. It will return your user ID, which you should use as an argument for other functions.
    To get your current hand and chips and table status call 'get_poker_state'.
  `,
  workers: [pokerWorker],
});

pokerAgent.setLogger((agent, message) => {
  console.log(`${agent.name}: `);
  console.log(message);
  console.log("-----------");
});
