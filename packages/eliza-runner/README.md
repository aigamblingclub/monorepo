# @agc/eliza-runner

A process runner for managing multiple Eliza agents with room assignments.

## Installation

```bash
bun add @agc/eliza-runner
```

## Usage

### Using Character Files

```typescript
import { runElizaAgents, ElizaRunner } from "@agc/eliza-runner";
import path from "path";

// Start agents in a specific room
const runner = await runElizaAgents({
    agentPath: path.resolve(__dirname, "../../agent"),
    roomId: "high-stakes",
    agents: [
        { character: "characters/grinder.json", port: 3200 },
        { character: "characters/showman.json", port: 3201 },
        { character: "characters/veteran.json", port: 3202 }
    ]
});

// Get agents in a specific room
const roomAgents = runner.getAgentsByRoom("high-stakes");
console.log(`Agents in high-stakes room: ${roomAgents.length}`);

// Stop specific agent
await runner.stopAgent(roomAgents[0].agentId);

// Stop all agents
await runner.stopAllAgents();
```

### Using Character Objects

You can also pass character configurations directly as objects instead of file paths:

```typescript
import { runElizaAgents } from "@agc/eliza-runner";

const grinderCharacter = {
    name: "The Grinder",
    username: "poker_grinder",
    clients: ["poker"],
    modelProvider: "openai",
    system: "You are a patient, methodical poker grinder...",
    bio: ["Professional poker player..."],
    // ... other character properties
};

const runner = await runElizaAgents({
    agentPath: path.resolve(__dirname, "../../agent"),
    roomId: "dynamic-room",
    agents: [
        { character: grinderCharacter, port: 3200 },
        { character: "characters/showman.json", port: 3201 } // Mix objects and file paths
    ]
});
```

## API

### `runElizaAgents(config: RunnerConfig): Promise<ElizaRunner>`

Starts Eliza agents with the specified configuration.

#### RunnerConfig

```typescript
interface RunnerConfig {
    agents: AgentConfig[];  // List of agents to start
    roomId: string;         // Room ID for all agents
    agentPath: string;      // Path to the agent directory
    logDir?: string;        // Directory for log files (default: ./logs)
    dataDir?: string;       // Directory for agent data (default: ./data/agents)
}

interface AgentConfig {
    character: string | Record<string, any>;  // Path to character JSON file or character object
    port: number;                             // Port for the agent
}
```

### ElizaRunner Methods

- `startAgents(config: RunnerConfig): Promise<Map<string, RunningAgent>>` - Start agents
- `stopAgent(agentId: string): Promise<void>` - Stop a specific agent
- `stopAllAgents(): Promise<void>` - Stop all running agents
- `getRunningAgents(): RunningAgent[]` - Get all running agents
- `getAgentsByRoom(roomId: string): RunningAgent[]` - Get agents in a specific room

## Integration with server-poker

```typescript
import { runElizaAgents } from "@agc/eliza-runner";

// In your poker server
async function startPokerRoom(roomId: string) {
    // Start agents for this room
    const runner = await runElizaAgents({
        agentPath: "/path/to/agent",
        roomId: roomId,
        agents: [
            { character: "characters/grinder.json", port: 3200 },
            { character: "characters/showman.json", port: 3201 }
        ]
    });
    
    // Agents will connect to ws://localhost:3001/rpc?room=${roomId}
    return runner;
}
```

## Environment Variables

Each agent process receives:
- `SERVER_PORT`: The agent's HTTP server port
- `POKER_ROOM_ID`: The room ID for poker connections
- `AGENT_ID`: Unique agent identifier
- `CHARACTER_FILE`: Path to the character file