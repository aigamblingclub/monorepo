#!/usr/bin/env bun

import { spawn, ChildProcess, type SpawnOptions } from "child_process";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export interface AgentConfig {
    character: string | Record<string, any>; // Can be a file path or character object
    port: number;
}

export interface RunnerConfig {
    agents: AgentConfig[];
    roomId: string;
    agentPath: string; // Path to the agent directory
    logDir?: string;
    dataDir?: string;
}

export interface RunningAgent {
    process: ChildProcess;
    config: AgentConfig;
    pid: number;
    agentId: string;
    roomId: string;
}

export class ElizaRunner {
    private agents: Map<string, RunningAgent> = new Map();
    private logDir: string;
    private dataDir: string;
    private agentPath: string;
    private tempDir: string;
    private tempCharacterFiles: Set<string> = new Set();

    constructor(agentPath: string, logDir?: string, dataDir?: string) {
        this.agentPath = agentPath;
        this.logDir = logDir || path.join(process.cwd(), "logs");
        this.dataDir = dataDir || path.join(process.cwd(), "data/agents");
        this.tempDir = path.join(process.cwd(), "temp/characters");
        
        // Create directories
        fs.mkdirSync(this.logDir, { recursive: true });
        fs.mkdirSync(this.dataDir, { recursive: true });
        fs.mkdirSync(this.tempDir, { recursive: true });
    }

    async startAgents(config: RunnerConfig): Promise<Map<string, RunningAgent>> {
        console.log(`Starting ${config.agents.length} agents in room ${config.roomId}...`);
        
        for (const agentConfig of config.agents) {
            // Generate agent ID based on character name
            const characterName = typeof agentConfig.character === 'string' 
                ? path.basename(agentConfig.character, '.json')
                : agentConfig.character.name || 'agent';
            const agentId = `${characterName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${process.pid}`;
            
            try {
                await this.startAgent(agentId, agentConfig, config.roomId);
                
                // Delay between starts
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`Failed to start agent ${agentConfig.character}:`, error);
            }
        }
        
        console.log(`All agents started in room ${config.roomId}`);
        return this.agents;
    }

    private async startAgent(agentId: string, config: AgentConfig, roomId: string): Promise<void> {
        // Handle character object vs file path
        let characterPath: string;
        
        if (typeof config.character === 'string') {
            // It's already a file path
            characterPath = config.character;
        } else {
            // It's a character object, write to temp file
            const hash = crypto.createHash('md5').update(JSON.stringify(config.character)).digest('hex');
            characterPath = path.join(this.tempDir, `${agentId}_${hash}.json`);
            
            // Write character object to temp file
            fs.writeFileSync(characterPath, JSON.stringify(config.character, null, 2));
            this.tempCharacterFiles.add(characterPath);
        }

        // Create environment variables for the spawned process
        // Filter process.env to only include string values
        const baseEnv: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(process.env)) {
            if (typeof value === 'string' || value === undefined) {
                baseEnv[key] = value;
            }
        }
        
        const env: Record<string, string | undefined> = {
            ...baseEnv,
            SERVER_PORT: config.port.toString(),  
            AGENT_ID: agentId,
            CHARACTER_FILE: characterPath,
            POKER_ROOM_ID: roomId
        };

        const logFile = path.join(this.logDir, `${agentId}.log`);
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        // Spawn the process using pnpm from the agent directory
        const spawnOptions: SpawnOptions = {
            cwd: this.agentPath,
            env: env as NodeJS.ProcessEnv,
            shell: true,
            stdio: ['inherit', 'pipe', 'pipe']
        };
        
        const agentProcess = spawn('pnpm', ['start', `--character=${characterPath}`], spawnOptions);

        // Pipe output to log file
        agentProcess.stdout?.pipe(logStream);
        agentProcess.stderr?.pipe(logStream);

        // Also log to console with agent ID prefix
        agentProcess.stdout?.on('data', (data: Buffer) => {
            console.log(`[${agentId}] ${data.toString().trim()}`);
        });

        agentProcess.stderr?.on('data', (data: Buffer) => {
            console.error(`[${agentId}] ${data.toString().trim()}`);
        });

        agentProcess.on('error', (error: Error) => {
            console.error(`[${agentId}] Process error:`, error);
        });

        agentProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
            console.log(`[${agentId}] Process exited with code ${code} and signal ${signal}`);
            this.agents.delete(agentId);
        });

        // Store agent info
        const runningAgent: RunningAgent = {
            process: agentProcess,
            config: config,
            pid: agentProcess.pid!,
            agentId: agentId,
            roomId: roomId
        };
        
        this.agents.set(agentId, runningAgent);

        // Save agent info to file
        const characterName = typeof config.character === 'string' 
            ? path.basename(config.character, '.json')
            : config.character.name || 'Unknown';
            
        const agentInfo = {
            id: agentId,
            character: characterPath,
            characterName: characterName,
            port: config.port,
            roomId: roomId,
            pid: agentProcess.pid,
            started: new Date().toISOString()
        };
        
        fs.writeFileSync(
            path.join(this.dataDir, `${agentId}.json`),
            JSON.stringify(agentInfo, null, 2)
        );

        console.log(`Agent ${characterName} started (PID: ${agentProcess.pid}, Port: ${config.port}, Room: ${roomId})`);
    }

    async stopAgent(agentId: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent) {
            console.warn(`Agent ${agentId} not found`);
            return;
        }

        try {
            agent.process.kill('SIGTERM');
            console.log(`Stopped agent ${agentId} (PID: ${agent.pid})`);
            
            // Remove info file
            const infoFile = path.join(this.dataDir, `${agentId}.json`);
            if (fs.existsSync(infoFile)) {
                fs.unlinkSync(infoFile);
            }
            
            this.agents.delete(agentId);
        } catch (error) {
            console.error(`Error stopping agent ${agentId}:`, error);
        }
    }

    async stopAllAgents(): Promise<void> {
        console.log("Stopping all agents...");
        
        const stopPromises = Array.from(this.agents.keys()).map(agentId => 
            this.stopAgent(agentId)
        );
        
        await Promise.all(stopPromises);
        
        // Clean up temporary character files
        for (const tempFile of this.tempCharacterFiles) {
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (error) {
                console.error(`Error removing temp character file ${tempFile}:`, error);
            }
        }
        this.tempCharacterFiles.clear();
        
        console.log("All agents stopped");
    }

    getRunningAgents(): RunningAgent[] {
        return Array.from(this.agents.values());
    }

    getAgentsByRoom(roomId: string): RunningAgent[] {
        return Array.from(this.agents.values()).filter(agent => agent.roomId === roomId);
    }
}

// Programmatic API
export async function runElizaAgents(config: RunnerConfig): Promise<ElizaRunner> {
    const runner = new ElizaRunner(config.agentPath, config.logDir, config.dataDir);
    await runner.startAgents(config);
    return runner;
}

// Example usage
export async function exampleUsage() {
    const runner = await runElizaAgents({
        agentPath: path.resolve(__dirname, "../../agent"),
        roomId: "room1",
        agents: [
            { character: "characters/grinder.json", port: 3200 },
            { character: "characters/showman.json", port: 3201 }
        ]
    });

    // Get agents in a specific room
    const room1Agents = runner.getAgentsByRoom("room1");
    console.log(`Agents in room1: ${room1Agents.length}`);

    // Stop all agents on exit
    process.on('SIGINT', async () => {
        await runner.stopAllAgents();
        process.exit(0);
    });
}