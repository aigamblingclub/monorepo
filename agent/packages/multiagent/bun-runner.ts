#!/usr/bin/env bun

import { spawn } from "child_process";
import path from "path";
import fs from "fs";

interface AgentConfig {
    character: string;
    port?: number;
    roomId?: string;
}

interface RunningAgent {
    process: any;
    config: AgentConfig;
    pid: number;
}

export class BunMultiAgentRunner {
    private agents: Map<string, RunningAgent> = new Map();
    private dataDir: string;
    private logDir: string;

    constructor() {
        this.dataDir = path.join(process.cwd(), "data/agents");
        this.logDir = path.join(process.cwd(), "logs");
        
        // Create directories
        fs.mkdirSync(this.dataDir, { recursive: true });
        fs.mkdirSync(this.logDir, { recursive: true });
    }

    async startAgents(configs: AgentConfig[], basePort: number = 3000): Promise<void> {
        console.log(`Starting ${configs.length} agents...`);
        
        let currentPort = basePort;
        
        for (const config of configs) {
            const port = config.port || currentPort;
            const agentId = `${path.basename(config.character, '.json')}_${Date.now()}_${process.pid}`;
            
            try {
                await this.startAgent(agentId, config, port);
                currentPort = port + 1;
                
                // Delay between starts
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`Failed to start agent ${config.character}:`, error);
            }
        }
        
        console.log(`All agents started`);
    }

    private async startAgent(agentId: string, config: AgentConfig, port: number): Promise<void> {
        const env = {
            ...process.env,
            SERVER_PORT: port.toString(),
            AGENT_ID: agentId,
            CHARACTER_FILE: config.character
        };
        
        if (config.roomId) {
            env.POKER_ROOM_ID = config.roomId;
        }

        const logFile = path.join(this.logDir, `${agentId}.log`);
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        // Change to agent directory
        const agentDir = path.resolve(__dirname, "../..");
        
        // Spawn the process using pnpm
        const agentProcess = spawn('pnpm', ['start', `--character=${config.character}`], {
            cwd: agentDir,
            env: env,
            shell: true
        });

        // Pipe output to log file
        agentProcess.stdout?.pipe(logStream);
        agentProcess.stderr?.pipe(logStream);

        // Also log to console
        agentProcess.stdout?.on('data', (data) => {
            console.log(`[${agentId}] ${data.toString().trim()}`);
        });

        agentProcess.stderr?.on('data', (data) => {
            console.error(`[${agentId}] ${data.toString().trim()}`);
        });

        agentProcess.on('error', (error) => {
            console.error(`[${agentId}] Process error:`, error);
        });

        agentProcess.on('exit', (code, signal) => {
            console.log(`[${agentId}] Process exited with code ${code} and signal ${signal}`);
            this.agents.delete(agentId);
        });

        // Store agent info
        this.agents.set(agentId, {
            process: agentProcess,
            config: config,
            pid: agentProcess.pid!
        });

        // Save agent info to file
        const agentInfo = {
            id: agentId,
            character: config.character,
            port: port,
            roomId: config.roomId || 'default',
            pid: agentProcess.pid,
            started: new Date().toISOString()
        };
        
        fs.writeFileSync(
            path.join(this.dataDir, `${agentId}.json`),
            JSON.stringify(agentInfo, null, 2)
        );

        console.log(`Agent ${path.basename(config.character, '.json')} started (PID: ${agentProcess.pid}, Port: ${port}, Room: ${config.roomId || 'default'})`);
    }

    async stopAllAgents(): Promise<void> {
        console.log("Stopping all agents...");
        
        for (const [agentId, agent] of this.agents) {
            try {
                agent.process.kill('SIGTERM');
                console.log(`Stopped agent ${agentId} (PID: ${agent.pid})`);
                
                // Remove info file
                const infoFile = path.join(this.dataDir, `${agentId}.json`);
                if (fs.existsSync(infoFile)) {
                    fs.unlinkSync(infoFile);
                }
            } catch (error) {
                console.error(`Error stopping agent ${agentId}:`, error);
            }
        }
        
        this.agents.clear();
        console.log("All agents stopped");
    }

    getStatus() {
        const agents = Array.from(this.agents.entries()).map(([id, agent]) => ({
            id,
            character: path.basename(agent.config.character, '.json'),
            port: agent.config.port,
            roomId: agent.config.roomId,
            pid: agent.pid,
            running: agent.process.killed === false
        }));
        
        return {
            agentCount: agents.length,
            agents
        };
    }
}

// CLI
if (import.meta.main) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const runner = new BunMultiAgentRunner();
    
    switch (command) {
        case 'start':
            const configs: AgentConfig[] = [];
            let i = 1;
            let basePort = 3000;
            let roomId: string | undefined;
            
            while (i < args.length) {
                if (args[i] === '-r' || args[i] === '--room') {
                    roomId = args[i + 1];
                    i += 2;
                } else if (args[i] === '-a' || args[i] === '--agents') {
                    const agents = args[i + 1].split(',');
                    agents.forEach(agent => {
                        configs.push({ 
                            character: agent.trim(),
                            roomId 
                        });
                    });
                    i += 2;
                } else if (args[i] === '-p' || args[i] === '--port') {
                    basePort = parseInt(args[i + 1]);
                    i += 2;
                } else {
                    i++;
                }
            }
            
            if (configs.length === 0) {
                console.error("Usage: bun run bun-runner.ts start -a character1.json,character2.json [-p basePort] [-r roomId]");
                process.exit(1);
            }
            
            await runner.startAgents(configs, basePort);
            
            // Keep process alive and handle shutdown
            process.on('SIGINT', async () => {
                console.log('\nReceived SIGINT, shutting down...');
                await runner.stopAllAgents();
                process.exit(0);
            });
            
            // Keep the process running
            setInterval(() => {}, 1000);
            break;
            
        case 'status':
            const status = runner.getStatus();
            console.log("Agent Status:", JSON.stringify(status, null, 2));
            break;
            
        default:
            console.log("Commands: start, status");
            console.log("Example: bun run bun-runner.ts start -a ../../characters/grinder.json,../../characters/showman.json -p 3000 -r room1");
    }
}