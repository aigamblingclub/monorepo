import {
    Client,
    IAgentRuntime,
    ModelClass,
    UUID,
    elizaLogger,
    generateText,
} from "@elizaos/core";
import { GameState, PlayerAction, PokerDecision, Card } from "./game-state";
import { ApiConnector } from "./api-connector";

export interface PokerClientConfig {
    apiBaseUrl?: string;
    apiKey: string; // Make API key required in config
}

// Extended character interface to include settings
interface ExtendedCharacter {
    name: string;
    id?: string;
    settings?: {
        secrets?: {
            POKER_API_KEY?: string;
        };
    };
}

export class PokerClient implements Client {
    name = "poker"; // Identificador para o sistema Eliza
    private runtime: IAgentRuntime | null = null;
    private apiConnector: ApiConnector;
    private gameState: GameState | null = null;
    private gameId: string | null = null;
    private playerId: string | null = null;
    private playerName: string | null = null; // Add player name storage
    private intervalId: NodeJS.Timeout | null = null;
    private resetFailedCount = 0;
    private lastJoinAttempt = 0;
    private joinBackoffMs = 5000; // Start with 5 second backoff
    private playerReadySet = false; // Flag to track if we've already set the player ready

    constructor(config: PokerClientConfig) {
        if (!config.apiKey) {
            elizaLogger.error("API key is required to create PokerClient");
            throw new Error(
                "POKER_API_KEY is required in PokerClient configuration"
            );
        }

        // Check for environment variable first, then config, then default
        const apiBaseUrl =
            process.env.POKER_API_URL ||
            config.apiBaseUrl ||
            "http://localhost:3001";

        // Initialize API connector with both URL and API key
        this.apiConnector = new ApiConnector(apiBaseUrl, config.apiKey);
        elizaLogger.info("Poker client created with API endpoint:", apiBaseUrl);
        elizaLogger.debug("API key configured:", {
            apiKeyLength: config.apiKey.length,
        });
    }

    async start(runtime?: IAgentRuntime): Promise<any> {
        if (!runtime) {
            throw new Error("Runtime is required for PokerClient");
        }

        // Cast the runtime to our extended type
        this.runtime = runtime;
        this.playerName = this.runtime.character.name || "ElizaPokerBot"; // Store player name

        // Log configuration for debugging
        elizaLogger.debug("PokerClient configuration:", {
            apiUrl: this.apiConnector.getBaseUrl(),
            botName: this.playerName,
        });

        return this;
    }

    async stop(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.gameId && this.playerId) {
            try {
                await this.apiConnector.leaveGame(this.gameId, this.playerId);
            } catch (error) {
                elizaLogger.error("Error leaving game:", error);
            }
        }

        elizaLogger.info("PokerClient stopped");
    }

    private resetGame(): void {
        this.playerId = null;
        this.gameId = null;
        this.gameState = null;
        this.playerReadySet = false; // Reset ready flag when resetting game
        // playerName is retained as it's based on the agent's identity
        this.resetFailedCount = 0;
        // Increase backoff time when resetting due to failures
        this.joinBackoffMs = Math.min(this.joinBackoffMs * 2, 30000); // Max 30 second backoff
    }
}
