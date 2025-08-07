import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Simple inline agent spawner for server-poker
 * This version spawns agents directly without the eliza-runner package
 */

interface AgentProcess {
    roomId: string;
    agentId: string;
    characterName: string;
    port: number;
    process: ChildProcess;
}

const runningAgents = new Map<string, AgentProcess[]>();

/**
 * Spawn agents for a room directly using child_process
 */
export async function spawnAgentsInline(
    roomId: string,
    numAgents: number = 2,
    startPort: number = 3300
): Promise<AgentProcess[]> {
    const agents: AgentProcess[] = [];
    
    // Available character files
    const characters = [
        { file: "characters/grinder.json", name: "The Grinder" },
        { file: "characters/showman.json", name: "The Showman" },
        { file: "characters/veteran.json", name: "The Veteran" }
    ];

    // Path to agent directory
    const agentPath = path.resolve(__dirname, "../../../agent");
    
    // Create logs directory
    const logsDir = path.resolve(__dirname, "../logs");
    fs.mkdirSync(logsDir, { recursive: true });

    for (let i = 0; i < numAgents && i < characters.length; i++) {
        const character = characters[i];
        const port = startPort + i;
        const agentId = `${character.name.toLowerCase().replace(/\s+/g, "_")}_${roomId}_${Date.now()}`;
        
        // Set up environment variables
        const env = {
            ...process.env,
            SERVER_PORT: port.toString(),
            AGENT_ID: agentId,
            POKER_ROOM_ID: roomId,
            CHARACTER_FILE: character.file
        };

        // Create log file
        const logFile = path.join(logsDir, `${agentId}.log`);
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        // Spawn the agent process
        const agentProcess = spawn('pnpm', ['start', `--character=${character.file}`], {
            cwd: agentPath,
            env: env,
            shell: true,
            stdio: ['inherit', 'pipe', 'pipe']
        });

        // Pipe output to log file
        agentProcess.stdout?.pipe(logStream);
        agentProcess.stderr?.pipe(logStream);

        // Also log to console with prefix
        agentProcess.stdout?.on('data', (data: Buffer) => {
            console.log(`[${agentId}] ${data.toString().trim()}`);
        });

        agentProcess.stderr?.on('data', (data: Buffer) => {
            console.error(`[${agentId}] ${data.toString().trim()}`);
        });

        agentProcess.on('error', (error) => {
            console.error(`[${agentId}] Process error:`, error);
        });

        agentProcess.on('exit', (code, signal) => {
            console.log(`[${agentId}] Process exited with code ${code} and signal ${signal}`);
        });

        const agent: AgentProcess = {
            roomId,
            agentId,
            characterName: character.name,
            port,
            process: agentProcess
        };

        agents.push(agent);
        console.log(`Started agent ${character.name} (PID: ${agentProcess.pid}, Port: ${port}, Room: ${roomId})`);
    }

    // Store agents for this room
    runningAgents.set(roomId, agents);
    
    return agents;
}

/**
 * Stop agents for a room
 */
export async function stopAgentsInline(roomId: string): Promise<void> {
    const agents = runningAgents.get(roomId);
    if (!agents) {
        throw new Error(`No agents running for room ${roomId}`);
    }

    for (const agent of agents) {
        if (agent.process.pid) {
            try {
                process.kill(agent.process.pid, 'SIGTERM');
                console.log(`Stopped agent ${agent.agentId} (PID: ${agent.process.pid})`);
            } catch (error) {
                console.error(`Error stopping agent ${agent.agentId}:`, error);
            }
        }
    }

    runningAgents.delete(roomId);
}

/**
 * Get running agents for a room
 */
export function getRunningAgentsInline(roomId: string): AgentProcess[] {
    return runningAgents.get(roomId) || [];
}

// Example Express route integration:
/*
import { Router } from "express";

const router = Router();

// POST /api/rooms/:roomId/spawn-agents
router.post("/rooms/:roomId/spawn-agents", async (req, res) => {
    const { roomId } = req.params;
    const { numAgents = 2, startPort = 3300 } = req.body;
    
    try {
        const agents = await spawnAgentsInline(roomId, numAgents, startPort);
        res.json({
            success: true,
            roomId,
            agents: agents.map(a => ({
                id: a.agentId,
                name: a.characterName,
                port: a.port,
                pid: a.process.pid
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE /api/rooms/:roomId/agents
router.delete("/rooms/:roomId/agents", async (req, res) => {
    const { roomId } = req.params;
    
    try {
        await stopAgentsInline(roomId);
        res.json({
            success: true,
            message: `Agents stopped for room ${roomId}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/rooms/:roomId/agents
router.get("/rooms/:roomId/agents", (req, res) => {
    const { roomId } = req.params;
    const agents = getRunningAgentsInline(roomId);
    
    res.json({
        success: true,
        roomId,
        agents: agents.map(a => ({
            id: a.agentId,
            name: a.characterName,
            port: a.port,
            pid: a.process.pid,
            running: a.process.exitCode === null
        }))
    });
});
*/