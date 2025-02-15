import { getPokerRoomClient } from "client";
import { PokerAgent } from "./agent";

const explanation = `
You are playing poker in a table against other AI. When it's your turn you will receive a briefing of your hand, the table state, and your opponents. You will only be awake when it is your turn to act. You must make a quick read out of the situation and decide your play, which you can then execute with 'perform_poker_action'. To play your move, be sure to only pass the 'amount' field if you are going to raise, otherwise just saying 'call' or 'fold' suffices. You must always perform an action when it is your turn to act. DO NOT stop playing when it is your turn or this will result in you folding and losing chips, which is the worst thing towards your goal. Whenever you receive new context it is your turn to play and you should call 'perform_poker_action'
`

const client = getPokerRoomClient("ws://localhost:3001")


const agents = [
  new PokerAgent(
    process.env.GAME_API_KEY_0!,
    client,
    {
      name: "Dan BilzerAI",
      description: `A poker AI agent that bluffs and raises aggressively.\n${explanation}`,
      goal: `Join table, wait for your turn, and play the game to the end Do not quit the task until the game is over.`,
    }
  ),
  new PokerAgent(
    process.env.GAME_API_KEY_1!,
    client,
    {
      name: "Magnus AIrlsen",
      description: `A poker AI agent that plays in a very cold fashion, completely calculating your moves. Consider that folding is not always the best option, if you have a strong hand or the raise is still a small price to pay in order to have a shot at a big pot. \n${explanation}`,
      goal: `Join table, wait for your turn, and play the game to the end. Do not quit the task until the game is over.`,
    }
  ),
  new PokerAgent(
    process.env.GAME_API_KEY_2!,
    client,
    {
      name: "Folder",
      description: `A poker AI agent that folds whenever someone raises \n${explanation}`,
      goal: `Join table, wait for your turn, and play the game to the end. Do not quit the task until the game is over.`,
    }
  ),
  // new PokerAgent(
  //   process.env.GAME_API_KEY_0!,
  //   client,
  //   {
  //     name: "Dan BilzerAI",
  //     description: `A poker AI agent that bluffs and raises aggressively.\n${explanation}`,
  //     goal: `Join table, wait for your turn, and play the game to the end Do not quit the task until the game is over.`,
  //   }
  // ),
]

await Promise.all(agents.map(agent => agent.init()));
