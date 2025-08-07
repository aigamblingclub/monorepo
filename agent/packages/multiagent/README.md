# @elizaos/multiagent

Multi-agent runner for Eliza using Bun runtime. This package allows you to run multiple Eliza agents simultaneously with different configurations and room assignments.

## Installation

This package is part of the Eliza monorepo. Make sure you have Bun installed:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Usage

### CLI Usage

```bash
# Start agents from the multiagent package directory
cd agent/packages/multiagent

# Start multiple agents
bun run index.ts start -a ../../characters/grinder.json,../../characters/showman.json -p 3000 -r room1

# With different rooms
bun run index.ts start -a ../../characters/grinder.json -r room1 -p 3000
bun run index.ts start -a ../../characters/strategist.json -r room2 -p 3100

# Check status
bun run index.ts status
```

### Programmatic Usage

```typescript
import { MultiAgentRunner } from "@elizaos/multiagent";

const runner = new MultiAgentRunner();

// Start agents in room1
await runner.startAgents([
    { character: "characters/grinder.json", roomId: "room1" },
    { character: "characters/showman.json", roomId: "room1" }
], 3000);

// Start agents in room2
await runner.startAgents([
    { character: "characters/strategist.json", roomId: "room2" },
    { character: "characters/wildcard.json", roomId: "room2" }
], 3100);

// Get status
const status = runner.getStatus();
console.log(status);

// Stop all agents
await runner.stopAllAgents();
```

## Room Support

Agents can be assigned to different rooms using the `roomId` parameter. This is passed as a query parameter to the WebSocket connection: `ws://localhost:3001/rpc?room=roomId`

### Priority Order for Room ID:
1. Character file `settings.pokerRoom`
2. Environment variable `POKER_ROOM_ID`
3. Command line parameter `-r` or `--room`
4. Default: `"default"`

## Examples

Run the example script to see multi-room setup in action:

```bash
bun run example.ts
```

This will start:
- 3 agents in "high-stakes" room on port 3000
- 2 agents in "beginners" room on port 3100

## Shell Scripts

The package includes the original shell scripts for backward compatibility:
- `multi-agent.sh` - Original bash multi-agent runner
- `test-rooms.sh` - Test script for room functionality
- `start-multi-room.sh` - Example multi-room setup

## Character Files

When using this package from `packages/multiagent`, reference character files with relative paths:
- `../../characters/grinder.json`
- `../../characters/showman.json`
- etc.

## API

### MultiAgentRunner

```typescript
class MultiAgentRunner {
    constructor()
    
    // Start agents with configurations
    async startAgents(configs: AgentConfig[], basePort?: number): Promise<void>
    
    // Stop all running agents
    async stopAllAgents(): Promise<void>
    
    // Get status of all agents
    getStatus(): { agentCount: number, agents: AgentInfo[] }
}
```

### AgentConfig

```typescript
interface AgentConfig {
    character: string;  // Path to character JSON file
    port?: number;      // Optional port override
    roomId?: string;    // Room ID for the agent
}
```