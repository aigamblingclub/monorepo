# Multi-Agent Runner Usage Guide

## Quick Start

The multi-agent runner allows you to run multiple Eliza agents with different configurations, including room assignments for poker games.

## Prerequisites

1. Make sure the poker server is running on port 3001
2. Install dependencies: `pnpm install`

## Using the Bun Runner (Recommended)

The bun-runner spawns Node.js processes for each agent, avoiding native module issues:

```bash
# Start agents in room1
bun run bun-runner.ts start -r room1 -a ../../characters/grinder.json,../../characters/showman.json -p 3200

# Start agents in room2 (in another terminal)
bun run bun-runner.ts start -r room2 -a ../../characters/strategist.json,../../characters/wildcard.json -p 3300
```

## Room Configuration

Agents connect to poker rooms via WebSocket query parameters:
- Room 1: `ws://localhost:3001/rpc?room=room1`
- Room 2: `ws://localhost:3001/rpc?room=room2`

## Environment Variables

Each agent gets these environment variables:
- `SERVER_PORT`: The agent's HTTP server port
- `POKER_ROOM_ID`: The room ID for poker games
- `AGENT_ID`: Unique agent identifier

## Logs

Logs are stored in `./logs/` directory with format: `{agent_name}_{timestamp}_{pid}.log`

## Stopping Agents

Press Ctrl+C in the terminal where you started the agents, or use:
```bash
pkill -f "pnpm start"
```

## Troubleshooting

1. **WebSocket Connection Errors**: Make sure the poker server is running
2. **Room Assignment**: The `-r` flag must come before `-a` in the command
3. **Port Conflicts**: Use different base ports for each group of agents

## Example Multi-Room Setup

Terminal 1 - Room 1 (High Stakes):
```bash
bun run bun-runner.ts start -r high-stakes -a ../../characters/grinder.json,../../characters/veteran.json -p 3200
```

Terminal 2 - Room 2 (Beginners):
```bash
bun run bun-runner.ts start -r beginners -a ../../characters/showman.json,../../characters/wildcard.json -p 3300
```

This creates two separate poker games with different players in each room.