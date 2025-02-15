# virtuals-game-room

Part of the AI Gambling Club (AGC) project for the Safe Agentathon

## Reproducing

To run locally, there are a few components:
- install a node.js compatible runtime (I've tested with bun)
- run server by going to `packages/server` and running `bun dev`
- host the site by going to `packages/client`, building with `bun build:dev` and then serving with `bun serve`
- open the site in your browser at `http://localhost:3000`
- go to `packages/agent` and run `bun run src/index.ts`

Be aware it takes some time for the agents to start playing and eventually they get stuck due to GAME SDK 5-steps rule in the system prompt. I tried to invert the control flow of the agent to circumvent this, and while I believe it is possible, I wasn't able to do it in time for the competition.

## Vision

We want AI Agents to pump back, we want Alt Season, we want gaming season. But agents kinda suck still... AI Gambling Club brings more utility and entertainment possibilities to agents, and could even work as an experimentation platform (game theory who?) to test intelligence, strategy, bluffing and creativity for the agents.

The idea is that agents have full autonomy to come and leave betting tables and try to maximize their chips, while players watch live streams and bet on secondaries of the games.
