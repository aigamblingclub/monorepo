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

        // Iniciar polling para verificar o estado do jogo ou encontrar jogos disponíveis
        this.intervalId = setInterval(async () => {
            try {
                // Se não estiver em um jogo, tentar encontrar e juntar-se a um
                if (!this.gameId) {
                    const now = Date.now();
                    // Only attempt to join if enough time has passed since last attempt
                    if (now - this.lastJoinAttempt >= this.joinBackoffMs) {
                        this.lastJoinAttempt = now;

                        // Verificar se já está em um jogo ou tentar entrar em um novo
                        await this.checkAndConnectToExistingGame();
                    }
                }
                // Se estiver em um jogo, verificar atualizações do estado do jogo
                else if (this.gameId) {
                    try {
                        const gameState = await this.apiConnector.getGameState(
                            this.gameId
                        );
                        await this.handleGameUpdate(gameState);
                    } catch (error) {
                        elizaLogger.error("Error getting game state:", error);
                        // On error, reset the game connection after a few tries
                        this.resetFailedCount =
                            (this.resetFailedCount || 0) + 1;
                        if (this.resetFailedCount > 5) {
                            elizaLogger.info(
                                "Too many failures, resetting connection"
                            );
                            this.resetGame();
                        }
                    }
                }
            } catch (error) {
                elizaLogger.error("Error in poker client polling:", error);
            }
        }, 5000);

        return this;
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

    private async handleGameUpdate(gameState: GameState): Promise<void> {
        try {
            // Handle game over state
            if (gameState.isGameOver) {
                elizaLogger.info("Game is over:", {
                    winner: gameState.winner?.name,
                    finalPot: gameState.finalPot,
                    finalCommunityCards: gameState.finalCommunityCards,
                });

                // Reset game state to allow joining new games
                this.resetGame();
                return;
            }

            // Save the current game state
            this.gameState = gameState;

            // Find player by name in the game state (instead of by ID)
            const ourPlayer = gameState.players.find(
                (player) => player.name === this.playerName
            );

            if (!ourPlayer) {
                elizaLogger.error(
                    `Player ${this.playerName} not found in game, cannot make decisions`
                );
                this.resetGame();
                return;
            }

            // Update our playerID if it's changed (helps with reconnection)
            if (this.playerId !== ourPlayer.id) {
                elizaLogger.info(
                    `Updating player ID from ${this.playerId} to ${ourPlayer.id}`
                );
                this.playerId = ourPlayer.id;
            }

            // Don't make decisions if game is in waiting state, but check if we need to set ready
            if (gameState.gameState === "waiting") {
                elizaLogger.info("Game is in waiting state");

                // Check if we need to set ready status - only if we haven't already set it or if server says we're not ready
                // Use both the playerReadySet flag and the server-reported ready status
                if (!this.playerReadySet && !ourPlayer.isReady) {
                    elizaLogger.info(
                        "Player is not ready yet, setting ready status"
                    );
                    try {
                        await this.apiConnector.setPlayerReady();
                        elizaLogger.info(
                            "Successfully set player ready status"
                        );
                        // Mark that we've set the player ready, regardless of server state
                        this.playerReadySet = true;

                        // After setting ready, update the player state locally to avoid repeated calls
                        if (this.gameState && this.gameState.players) {
                            const playerIndex =
                                this.gameState.players.findIndex(
                                    (p) => p.id === ourPlayer.id
                                );
                            if (playerIndex >= 0) {
                                this.gameState.players[playerIndex].isReady =
                                    true;
                            }
                        }
                    } catch (error) {
                        elizaLogger.error(
                            "Error setting player ready status:",
                            error
                        );
                    }
                } else {
                    // If we've already set ready before OR if server says we're ready
                    if (this.playerReadySet) {
                        elizaLogger.info(
                            "Player ready status already set in this session"
                        );
                    } else if (ourPlayer.isReady) {
                        elizaLogger.info(
                            "Player is already ready according to server"
                        );
                        this.playerReadySet = true; // Update our flag to match server state
                    }
                    elizaLogger.info("Waiting for game to start");
                }

                return;
            }

            // Check if it's our turn
            const isOurTurn =
                gameState.currentPlayerIndex !== undefined &&
                gameState.players[gameState.currentPlayerIndex]?.name ===
                    this.playerName;

            if (isOurTurn) {
                elizaLogger.info("It's our turn, making a decision");
                const decision = await this.makeDecision(gameState);
                elizaLogger.info(`Decision made: ${decision.action}`, decision);

                // Submit the action to the server
                if (this.gameId && this.playerId) {
                    await this.apiConnector.submitAction(
                        this.gameId,
                        this.playerId,
                        decision
                    );
                } else {
                    elizaLogger.error(
                        "Cannot submit action: gameId or playerId is missing"
                    );
                }
            }
        } catch (error) {
            elizaLogger.error("Error handling game update:", error);
        }
    }
}
