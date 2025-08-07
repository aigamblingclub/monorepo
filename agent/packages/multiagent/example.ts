#!/usr/bin/env bun

import { MultiAgentRunner } from "./index";
import { elizaLogger } from "@elizaos/core";

async function runExample() {
    const runner = new MultiAgentRunner();
    
    // Example 1: Start agents in different rooms
    elizaLogger.info("Starting poker tournament setup...");
    
    // Room 1: High stakes table
    await runner.startAgents([
        { 
            character: "../../characters/grinder.json", 
            roomId: "high-stakes"
        },
        { 
            character: "../../characters/showman.json", 
            roomId: "high-stakes"
        },
        { 
            character: "../../characters/veteran.json", 
            roomId: "high-stakes"
        }
    ], 3000);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Room 2: Beginners table
    await runner.startAgents([
        { 
            character: "../../characters/strategist.json", 
            roomId: "beginners"
        },
        { 
            character: "../../characters/wildcard.json", 
            roomId: "beginners"
        }
    ], 3100);
    
    // Show status
    const status = runner.getStatus();
    elizaLogger.info("Current status:", status);
    
    // Keep running until interrupted
    elizaLogger.info("Agents running. Press Ctrl+C to stop.");
    
    process.on('SIGINT', async () => {
        elizaLogger.info("\nShutting down agents...");
        await runner.stopAllAgents();
        process.exit(0);
    });
}

runExample().catch(error => {
    elizaLogger.error("Failed to run example:", error);
    process.exit(1);
});