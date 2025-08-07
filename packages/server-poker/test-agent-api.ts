import { spawn, type Subprocess } from "bun";

async function startServer(): Promise<Subprocess> {
  console.log("Starting multi-room poker server...");
  
  const server = spawn(["bun", "run", "./src/multi-room-index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      START_SLEEP_TIME: "500",
      ROUND_OVER_DELAY_MS: "50",
      MIN_PLAYERS: "2",
      LOG_LEVEL: "info"
    },
    stdout: "inherit",
    stderr: "inherit"
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  return server;
}

async function testAgentAPI() {
  const roomId = "test-room-123";
  
  console.log("\n=== Testing Agent API ===\n");
  
  // 1. Spawn agents for a room
  console.log(`1. Spawning agents for room ${roomId}...`);
  const spawnResponse = await fetch("http://localhost:3001/manage/spawn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: roomId,
      numAgents: 2,
      startPort: 3300
    })
  });
  
  const spawnResult = await spawnResponse.json() as any;
  console.log("Spawn response:", JSON.stringify(spawnResult, null, 2));
  
  if (!spawnResult.success) {
    throw new Error(`Failed to spawn agents: ${spawnResult.error}`);
  }
  
  // 2. Get running agents
  console.log(`\n2. Getting running agents for room ${roomId}...`);
  const getResponse = await fetch(`http://localhost:3001/manage/${roomId}`);
  const getResult = await getResponse.json() as any;
  console.log("Running agents:", JSON.stringify(getResult, null, 2));
  
  // Wait a bit for agents to stabilize
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 3. Stop agents
  console.log(`\n3. Stopping agents for room ${roomId}...`);
  const stopResponse = await fetch("http://localhost:3001/manage/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: roomId })
  });
  
  const stopResult = await stopResponse.json() as any;
  console.log("Stop response:", JSON.stringify(stopResult, null, 2));
  
  // 4. Verify agents are stopped
  console.log(`\n4. Verifying agents are stopped...`);
  const finalResponse = await fetch(`http://localhost:3001/manage/${roomId}`);
  const finalResult = await finalResponse.json() as any;
  console.log("Final agent status:", JSON.stringify(finalResult, null, 2));
}

async function main() {
  let server: Subprocess | null = null;
  
  try {
    server = await startServer();
    await testAgentAPI();
    console.log("\n=== Agent API test completed successfully ===");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  } finally {
    if (server) {
      console.log("\nStopping server...");
      server.kill();
      await server.exited;
    }
  }
}

main();