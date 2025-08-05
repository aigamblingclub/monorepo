# @elizaos/client-poker

This package implements a client for the Eliza system that enables integration with an API-based Poker game.

## Installation

```bash
cd packages/client-poker
pnpm install
pnpm build
```

Then, add it to the agent:

```bash
cd ../../agent
pnpm add @elizaos/client-poker@workspace:*
```

## Configuration

### 1. Character File (Required)

The API key is **required** and must be configured in the character file at `characters/poker-player.json`:

```json
{
    "name": "TexasHoldBot",
    "archetype": "Professional Poker Player",
    "personality": "Calculating, patient, and observant.",
    "background": "An experienced poker player who has won several major tournaments.",
    "clients": ["poker"],
    "plugins": ["plugin-bootstrap"],
    "settings": {
        "secrets": {
            "POKER_API_KEY": "your-api-key-here" // Required: API key for authentication
        }
    }
}
```

⚠️ **IMPORTANT**: The client will not start if the API key is not configured.

### 2. Environment Variables (Optional)

The client can be configured through the following environment variables:

| Variable                        | Description                                    | Default                 |
| ------------------------------- | ---------------------------------------------- | ----------------------- |
| `POKER_API_URL`                | Base URL of the poker server API               | `http://localhost:3001` |
| `POKER_API_KEY`                | API key for authentication                     | `string`                |
| `POKER_INACTIVITY_TIMEOUT_MS`  | Timeout for inactivity in milliseconds         | `300000` (5 minutes)    |
| `POKER_MAX_INACTIVITY_RESETS`  | Maximum number of inactivity resets            | `3`                     |

Configuration example:

```bash
export POKER_API_URL=http://localhost:3001
export POKER_API_KEY=your-api-key-here
export POKER_INACTIVITY_TIMEOUT_MS=180000  # 3 minutes
export POKER_MAX_INACTIVITY_RESETS=5       # 5 resets before giving up
```

### 3. Precedence Order

The configuration is loaded in the following order:

1. API key from character file (required)
2. Environment variables (optional)
3. Default values (for API URL)

## Inactivity Timeout Feature

The client includes an automatic inactivity timeout feature that monitors the time since the last action was taken and automatically restarts the connection if no actions are performed for a specified period.

### How It Works

1. **Action Tracking**: The client tracks the timestamp of the last successful action submission
2. **Inactivity Monitoring**: A monitoring interval runs every 30 seconds to check for inactivity
3. **Automatic Restart**: If the time since the last action exceeds the configured timeout, a restart is triggered
4. **Maximum Resets**: If the maximum number of resets is reached, the client stops completely

### Configuration

```typescript
interface PokerClientConfig {
    apiBaseUrl?: string;
    apiKey?: string;
    playerName?: string;
    inactivityTimeoutMs?: number; // Timeout for inactivity in milliseconds
    maxInactivityResets?: number; // Maximum number of inactivity resets before giving up
}
```

### Usage Examples

```typescript
// Basic usage (with defaults)
const client = new PokerClient({
    apiBaseUrl: "http://localhost:3001",
    playerName: "PokerBot"
});
// Uses 5-minute timeout and 3 max resets

// Custom configuration
const client = new PokerClient({
    apiBaseUrl: "http://localhost:3001",
    playerName: "PokerBot",
    inactivityTimeoutMs: 600000, // 10 minutes
    maxInactivityResets: 5 // 5 resets before giving up
});
```

For more detailed information, see [INACTIVITY_TIMEOUT.md](./INACTIVITY_TIMEOUT.md).

## Usage

Run Eliza with the poker player character:

```bash
pnpm start --characters="characters/poker-player.json"
```

### Verifying Configuration

The client logs its configuration at startup. You can verify if everything is configured correctly by checking the logs:

```
[INFO] PokerClient created with API endpoint: http://localhost:3001
[DEBUG] API key configured: { apiKeyLength: 64 }
[DEBUG] PokerClient configuration: {
    apiUrl: "http://localhost:3001",
    agentName: "TexasHoldAgent",
    inactivityTimeoutMs: 300000,
    maxInactivityResets: 3
}
```

### Common Errors

1. **API Key not configured**:

```
[ERROR] API key not found in character configuration
Error: POKER_API_KEY is required in character settings.secrets
```

2. **Invalid API Key**:

```
[ERROR] HTTP error (401): {"error":"Invalid API key"}
```

3. **Inactivity Timeout**:

```
[WARN] Inactivity timeout reached (5 minutes), attempting to restart connection
```

## About the Client

This client is designed to automatically connect to the Poker server, join available games, and make decisions based on game state analysis using Eliza's AI.

### Features

- Automatic detection of available games
- Automatic game entry
- AI-based decision making using the Eliza system
- Game state management
- Communication with the Poker game's RESTful API
- Secure authentication using API key
- **Automatic inactivity timeout and restart functionality**

### Authentication

The client uses an API key for server authentication. The API key is required and must be configured in the agent's character file under `settings.secrets.SERVER_MAIN_API_KEY`. The client:

1. Validates the presence of the API key during initialization
2. Includes the API key in all requests in the `x-api-key` header
3. Manages authentication errors

If you receive a 401 (Unauthorized) error, check:

1. If the API key is configured in the character file
2. If the API key is correct
3. If the server is expecting the API key in the `x-api-key` header

### Adaptation

You may need to modify some aspects of this client to adapt it to your specific Poker server implementation. The main areas that might require adaptation are:

1. API endpoints in `api-connector.ts`
2. Game state format in `game-state.ts`
3. Decision-making mechanism in `poker-client.ts`

## Troubleshooting

### Inactivity Issues

If the client stops due to max inactivity resets:

1. Check WebSocket connection stability
2. Verify server is responding to actions
3. Review logs for specific error patterns
4. Consider adjusting timeout duration or max resets

### Monitoring

The client provides detailed logging for debugging inactivity issues:

```typescript
// Inactivity check logs
elizaLogger.debug(`[PlayerName] Inactivity check:`, {
    timeSinceLastAction,
    timeSinceLastActionMinutes,
    inactivityTimeoutMs: this.inactivityTimeoutMs,
    inactivityResets: this.inactivityResets,
    maxInactivityResets: this.maxInactivityResets,
    isConnected: this.isConnected,
    wsState: this.apiConnector.getWebSocketState()
});
```
