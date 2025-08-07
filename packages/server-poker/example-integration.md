# Integrating Agent Spawning into Server-Poker

## Option 1: Using the eliza-runner package (Recommended)

First, add the eliza-runner to your dependencies:

```bash
cd packages/server-poker
pnpm add @agc/eliza-runner
```

Then in your server code:

```typescript
// In packages/server-poker/src/room-router.ts or wherever you want to add the route

import { runElizaAgents } from "@agc/eliza-runner";
import path from "path";

// Store runners by room
const roomRunners = new Map();

// Add route to spawn agents
router.post("/rooms/:roomId/spawn-agents", async (req, res) => {
    const { roomId } = req.params;
    const { numAgents = 2 } = req.body;
    
    // Check if agents already exist
    if (roomRunners.has(roomId)) {
        return res.status(400).json({ 
            error: "Agents already running for this room" 
        });
    }
    
    try {
        // Define which characters to use
        const characters = [
            "characters/grinder.json",
            "characters/showman.json",
            "characters/veteran.json"
        ];
        
        // Create agent configs with unique ports
        const agents = characters.slice(0, numAgents).map((char, i) => ({
            character: char,
            port: 3300 + (roomRunners.size * 10) + i // Ensure unique ports
        }));
        
        // Start agents
        const runner = await runElizaAgents({
            agentPath: path.resolve(__dirname, "../../../agent"),
            roomId: roomId,
            agents: agents
        });
        
        roomRunners.set(roomId, runner);
        
        res.json({
            success: true,
            roomId,
            agents: agents.map(a => ({
                character: a.character,
                port: a.port
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add route to stop agents
router.delete("/rooms/:roomId/agents", async (req, res) => {
    const { roomId } = req.params;
    const runner = roomRunners.get(roomId);
    
    if (!runner) {
        return res.status(404).json({ 
            error: "No agents found for this room" 
        });
    }
    
    try {
        await runner.stopAllAgents();
        roomRunners.delete(roomId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## Option 2: Using inline spawning (No additional dependencies)

Use the `spawn-agents-inline.ts` file directly:

```typescript
// In packages/server-poker/src/room-router.ts

import { 
    spawnAgentsInline, 
    stopAgentsInline, 
    getRunningAgentsInline 
} from "./spawn-agents-inline";

// Add route to spawn agents
router.post("/rooms/:roomId/spawn-agents", async (req, res) => {
    const { roomId } = req.params;
    const { numAgents = 2 } = req.body;
    
    try {
        const agents = await spawnAgentsInline(roomId, numAgents, 3300);
        res.json({
            success: true,
            roomId,
            agents: agents.map(a => ({
                id: a.agentId,
                name: a.characterName,
                port: a.port
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

## Option 3: Using custom character objects

```typescript
// Create agents with dynamic personalities
router.post("/rooms/:roomId/spawn-custom", async (req, res) => {
    const { roomId } = req.params;
    const { personalities } = req.body;
    
    const customCharacters = personalities.map((p, i) => ({
        name: p.name,
        username: p.name.toLowerCase().replace(/\s+/g, "_"),
        clients: ["poker"],
        modelProvider: "openai",
        plugins: [],
        system: `You are ${p.name}, ${p.description}`,
        bio: [p.bio],
        lore: [p.backstory],
        topics: ["poker", "betting", "strategy"],
        adjectives: p.traits,
        style: {
            all: ["strategic", "thoughtful"],
            chat: ["competitive"],
            post: ["analytical"]
        },
        postExamples: ["Just made a strategic play"],
        messageExamples: [[
            { user: "{{user1}}", content: { text: "How do you play?" }},
            { user: p.name, content: { text: p.catchphrase }}
        ]]
    }));
    
    const agents = customCharacters.map((char, i) => ({
        character: char,
        port: 3400 + i
    }));
    
    const runner = await runElizaAgents({
        agentPath: path.resolve(__dirname, "../../../agent"),
        roomId: roomId,
        agents: agents
    });
    
    // ... rest of the route
});
```

## Testing the Routes

### 1. Start the server
```bash
cd packages/server-poker
bun run dev
```

### 2. Create a room and spawn agents
```bash
# Create a room (if needed)
curl -X POST http://localhost:3001/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"roomId": "test-room"}'

# Spawn 3 agents for the room
curl -X POST http://localhost:3001/api/rooms/test-room/spawn-agents \
  -H "Content-Type: application/json" \
  -d '{"numAgents": 3}'

# Check running agents
curl http://localhost:3001/api/rooms/test-room/agents

# Stop agents for the room
curl -X DELETE http://localhost:3001/api/rooms/test-room/agents
```

## Important Notes

1. **Port Management**: Each agent needs a unique port. The examples use a base port + offset strategy.

2. **Resource Management**: Each agent spawns a separate Node.js process. Be mindful of system resources.

3. **Room Coordination**: The agents will connect to the poker server using the WebSocket URL with the room query parameter.

4. **Character Files**: The default character files should be in `agent/characters/` directory.

5. **Environment Variables**: Agents will need access to:
   - `OPENAI_API_KEY` for AI responses
   - `POKER_API_URL` (defaults to http://localhost:3001)
   - Other env vars from the agent's .env file

6. **Cleanup**: Always stop agents when done to free resources:
   ```typescript
   // On server shutdown
   process.on('SIGTERM', async () => {
       for (const [roomId, runner] of roomRunners) {
           await runner.stopAllAgents();
       }
   });
   ```