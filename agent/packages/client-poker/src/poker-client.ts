import {
    Client,
    IAgentRuntime,
    ModelClass,
    UUID,
    elizaLogger,
    generateText,
    Memory,
    getEmbeddingZeroVector,
    stringToUuid,
    Content
} from "@elizaos/core";
import { GameState, PlayerAction, PokerDecision } from "./game-state";
import { ApiConnector } from "./api-connector";
import { PokerState, PlayerView, GameEvent, Card } from "./schemas";
import { embed } from "@elizaos/core";
import { delay } from "effect/Effect";

export interface PokerClientConfig {
    apiBaseUrl?: string;
    apiKey?: string; // Make API key required in config
    playerName?: string;
    roomId?: string; // Room ID to connect to
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

// Extend the Content type for poker
interface PokerContent extends Content {
    gameId: string;
    roundId?: string;
    pokerAction: PokerDecision;
    gameState: {
        pot: number;
        playerCards?: readonly Card[];
        communityCards: readonly Card[];
        chips: number;
        position: number;
        phase: string;
        players: Array<{
            id: string;
            chips: number;
            bet: {
                round: number;
                total: number;
            };
            status: "PLAYING" | "FOLDED" | "ALL_IN";
        }>;
        round: {
            phase: "PRE_FLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN";
            roundNumber: number;
            roundPot: number;
            currentBet: number;
            foldedPlayers: string[];
            allInPlayers: string[];
        };
    };
    outcome?: {
        won: boolean;
        chipsWon?: number;
        finalPot?: number;
        finalCommunityCards?: readonly Card[];
        finalPlayerCards?: readonly Card[];
        roundEndState?: string;
        handStrength?: string;
        opponentActions?: string[];
        opponentFinalCards?: readonly Card[];
    };
}

export class PokerClient implements Client {
    name = "poker"; // Identifier for the Eliza system
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
    private isConnected = false;
    private playerViewPollingInterval: NodeJS.Timeout | null = null;
    private playerViewPollingIntervalMs = 10000; // Increase to 10 seconds
    private isSendingMessage = false;
    private lastPollTime = 0;
    private minPollInterval = 5000; // Minimum time between polls in milliseconds
    private roundId: string | null = null;

    constructor(config: PokerClientConfig) {
        // if (!config.apiKey) {
        //     elizaLogger.error("API key is required to create PokerClient");
        //     throw new Error(
        //         "POKER_API_KEY is required in PokerClient configuration"
        //     );
        // }

        // Check for environment variable first, then config, then default
        const apiBaseUrl =
            process.env.POKER_API_URL ||
            config.apiBaseUrl ||
            "http://localhost:3001";

        // Initialize API connector with both URL and API key
        this.apiConnector = new ApiConnector(apiBaseUrl, config.apiKey, config.playerName, config.roomId);
        elizaLogger.info(`[${config.playerName || "PokerBot"}] Poker client created with API endpoint:`, apiBaseUrl, "room:", config.roomId || "default");

        // elizaLogger.debug("API key configured:", {
        //     apiKeyLength: config.apiKey.length,
        // });
    }

    async start(runtime?: IAgentRuntime, verbose: boolean = true): Promise<any> {
        if (!runtime) {
            throw new Error("Runtime is required for PokerClient");
        }

        // Cast the runtime to our extended type
        this.runtime = runtime;
        this.playerName = this.runtime.character.name || "ElizaPokerBot"; // Store player name

        // Log configuration for debugging
        if (verbose) {
            elizaLogger.debug(`[${this.playerName}] PokerClient configuration:`, {
                apiUrl: this.apiConnector.getBaseUrl(),
                agentName: this.playerName,
            });
        }

        // Connect to WebSocket with retry
        let connected = false;
        let retryCount = 0;
        const maxRetries = 5;
        const baseDelay = 1000; // 1 second

        while (!connected && retryCount < maxRetries) {
            try {
                await this.apiConnector.connect().catch((error) => {
                    elizaLogger.error(`[${this.playerName}] Failed to connect/join (attempt ${retryCount}/${maxRetries}), retrying in ${delay}ms:`, error);
                    throw error;
                });
                this.isConnected = true;
                connected = true;
                elizaLogger.info(`[${this.playerName}] Connected to poker server WebSocket`);

                // Set up state update listeners
                this.apiConnector.onStateUpdate((state: PokerState) => {
                    this.handlePokerStateUpdate(state, verbose);
                });

                // Try to join game after successful connection
                await this.joinGame(undefined, verbose);
            } catch (error) {
                retryCount++;
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000); // Max 30 seconds
                elizaLogger.error(`[${this.playerName}] Failed to connect/join (attempt ${retryCount}/${maxRetries}), retrying in ${delay}ms:`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        if (!connected) {
            elizaLogger.error(`[${this.playerName}] Failed to connect after maximum retries`);
            return this;
        }

        // Start polling to check game state
        this.intervalId = setInterval(async () => {
            try {
                if (this.isConnected) {
                    try {
                        if (verbose) {
                            elizaLogger.debug(`[${this.playerName}] getGameState, isSendingMessage:`, {
                                isSendingMessage: this.isSendingMessage,
                            });
                        }
                        if (this.isSendingMessage) {
                            if (verbose) {
                                elizaLogger.debug(`[${this.playerName}] Skipping getGameState because we are sending a message`, {
                                    isSendingMessage: this.isSendingMessage,
                                });
                            }
                            return;
                        }
                        const gameState = await this.apiConnector.getGameState();
                        await this.handleGameUpdate(gameState, verbose);
                    } catch (error) {
                        elizaLogger.error(`[${this.playerName}] Error getting game state:`, {
                            error,
                            message: error.message,
                            stack: error.stack,
                            isConnected: this.isConnected,
                            wsState: this.apiConnector.getWebSocketState()
                        });
                        // On error, reset the game connection after a few tries
                        this.resetFailedCount = (this.resetFailedCount || 0) + 1;
                        if (this.resetFailedCount > 5) {
                            elizaLogger.info(`[${this.playerName}] Too many failures, resetting connection`);
                            this.resetGame();
                            // Try to reconnect immediately after reset
                            await this.joinGame(undefined, verbose);
                        }
                    }
                } else {
                    // If not connected, try to reconnect
                    elizaLogger.error(`[${this.playerName}] Not connected, attempting to reconnect`);
                    await this.joinGame(undefined, verbose);
                }
            } catch (error) {
                elizaLogger.error(`[${this.playerName}] Error in poker client polling:`, error);
            }
        }, 5000);

        return this;
    }

    private handlePokerStateUpdate(state: PokerState, verbose: boolean = true): void {
        try {
            elizaLogger.info(`[${this.playerName}] Received poker state update`);
            const gameState = this.apiConnector.convertPokerStateToGameState(state);
            elizaLogger.debug(`[${this.playerName}] gameState:`, gameState);
            this.handleGameUpdate(gameState, verbose);
        } catch (error) {
            elizaLogger.error(`[${this.playerName}] Error handling poker state update:`, error);
        }
    }

    private isPlayerTurn(gameState: GameState | PlayerView, verbose: boolean = true): boolean {
        try {
            // Early return if we don't have a playerId
            if (!this.playerId) {
                if (verbose) elizaLogger.debug(`[${this.playerName}] Cannot check turn - no playerId set`);
                return false;
            }

            // Handle PlayerView type
            if ('currentPlayerId' in gameState) {
                const view = gameState as PlayerView;
                const isOurTurn = view.currentPlayerId &&
                    (typeof view.currentPlayerId === 'object' && 'value' in view.currentPlayerId
                        ? view.currentPlayerId.value === this.playerId
                        : typeof view.currentPlayerId === 'string' && view.currentPlayerId === this.playerId);

                if (verbose) elizaLogger.debug(`[${this.playerName}] Turn check from PlayerView`, {
                    currentPlayerId: view.currentPlayerId,
                    ourPlayerId: this.playerId,
                    isOurTurn
                });

                return isOurTurn;
            }

            // Handle GameState type
            const state = gameState as GameState;
            const player = state.players.find(p => p.id === this.playerId);
            const isOurTurn = state.currentPlayerIndex === state.players.findIndex(p => p.id === this.playerId);

            if (verbose) elizaLogger.debug(`[${this.playerName}] Turn check from GameState`, {
                currentPlayerIndex: state.currentPlayerIndex,
                ourPlayerIndex: state.players.findIndex(p => p.id === this.playerId),
                playerStatus: player?.status,
                isOurTurn
            });

            return isOurTurn && player?.status === "PLAYING";
        } catch (error) {
            elizaLogger.error(`[${this.playerName}] Error checking player turn:`, error);
            return false;
        }
    }

    private async handlePlayerViewUpdate(view: PlayerView, verbose: boolean = true): Promise<void> {
        try {
            // Skip processing if we're currently sending a message
            if (this.isSendingMessage) {
                if (verbose) elizaLogger.debug(`[${this.playerName}] Skipping player view update processing while sending message`, {
                    isSendingMessage: this.isSendingMessage
                });
                return;
            }

            elizaLogger.info(`[${this.playerName}] Received player view update`);
            // Update our player ID if needed
            if (view.player && view.player.id && this.playerId !== view.player.id) {
                this.playerId = view.player.id;
                elizaLogger.info(`[${this.playerName}] Updated player ID to ${this.playerId}`);
            }

            // If round is over, stop polling
            if (view.tableStatus === "ROUND_OVER") {
                elizaLogger.info(`[${this.playerName}] Round is over, stopping player view polling`);
                this.stopPlayerViewPolling();
                return;
            }

            // If we have a game state, update it with the player view information
            if (this.gameState) {
                // Update our player's hand
                const ourPlayer = this.gameState.players.find(p => p.id === this.playerId);
                if (ourPlayer) {
                    ourPlayer.hand = view.hand.map(card => ({
                        rank: card.rank,
                        suit: card.suit
                    }));
                }

                // Update community cards
                this.gameState.communityCards = view.community.map(card => ({
                    rank: card.rank,
                    suit: card.suit
                }));

                // Update pot and bet
                this.gameState.phase.volume = view.round.volume;
                this.gameState.round.currentBet = view.round.currentBet;

                // Update opponents
                if (view.opponents) {
                    Object.entries(view.opponents).forEach(([id, opponent]) => {
                        const player = this.gameState!.players.find(p => p.id === id);
                        if (player) {
                            player.chips = opponent.chips;
                            player.bet.amount = opponent.bet.amount;
                            player.bet.volume = opponent.bet.volume;
                            player.status = opponent.status;
                        }
                    });
                }

                // Check if it's our turn using the unified method
                if (this.isPlayerTurn(view)) {
                    // Set flag before sending
                    this.isSendingMessage = true;

                    elizaLogger.info(`[${this.playerName}] It's our turn, making a decision`);
                    let decision = await this.makeDecision(this.gameState, false);
                    elizaLogger.info(
                        `[${this.playerName}] Decision made: ${decision.action}`,
                        decision
                    );

                    // Submit the action to the server
                    if (this.playerId) {
                        if (verbose) elizaLogger.debug(`[${this.playerName}] Submitting action:`, {
                            playerId: this.playerId,
                            decision,
                        });

                        try {
                            if (verbose) elizaLogger.debug(`[${this.playerName}] Sending action to server`);
                            await this.apiConnector.submitAction({
                                playerId: this.playerId,
                                decision,
                            });
                            if (verbose) elizaLogger.debug(`[${this.playerName}] Action sent successfully`);
                        } catch (error) {
                            elizaLogger.error(
                                `[${this.playerName}] Error submitting action:`,
                                error
                            );
                        } finally {
                            this.isSendingMessage = false;
                            if (verbose) elizaLogger.debug(
                                `[${this.playerName}] Setting isSendingMessage to false`
                            );
                        }
                    } else {
                        elizaLogger.error(
                            `[${this.playerName}] Cannot submit action: gameId or playerId is missing`
                        );
                    }
                } else {
                    elizaLogger.info(`[${this.playerName}] Not our turn, waiting for next update`);
                }
            }
        } catch (error) {
            elizaLogger.error(`[${this.playerName}] Error handling player view update:`, error);
        } finally {
            this.isSendingMessage = false;
        }
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
        // Stop player view polling
        this.stopPlayerViewPolling();
        elizaLogger.debug(`[${this.playerName}] Game state reset`);
    }

    // Method to change room
    async changeRoom(roomId: string): Promise<void> {
        elizaLogger.info(`[${this.playerName}] Changing room from ${this.apiConnector.getRoomId()} to ${roomId}`);
        
        // Leave current game if connected
        if (this.isConnected && this.gameId && this.playerId) {
            try {
                await this.apiConnector.leaveGame(this.gameId, this.playerId);
            } catch (error) {
                elizaLogger.error(`[${this.playerName}] Error leaving current game:`, error);
            }
        }
        
        // Reset state
        this.resetGame();
        
        // Change room in API connector
        this.apiConnector.setRoomId(roomId);
        
        // Rejoin with new room
        if (this.runtime && this.playerName) {
            await this.joinGame();
        }
    }
    
    // Method to get current room
    getCurrentRoom(): string {
        return this.apiConnector.getRoomId();
    }

    async stop(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Stop player view polling
        this.stopPlayerViewPolling();

        if (this.gameId && this.playerId) {
            try {
                await this.apiConnector.leaveGame(this.gameId, this.playerId);
            } catch (error) {
                elizaLogger.error(`[${this.playerName}] Error leaving game:`, error);
            }
        }

        elizaLogger.info(`[${this.playerName}] PokerClient stopped`);
    }

    async joinGame(gameId?: string, verbose: boolean = true): Promise<void> {
        try {
            this.playerName = this.runtime?.character.name || "ElizaPokerBot";
            elizaLogger.info(
                `[${this.playerName}] Attempting to join game`,
                gameId,
                "as",
                this.playerName
            );
            this.playerId = await this.apiConnector.joinGame({
                gameId,
                playerName: this.playerName,
            });
            this.gameId = gameId || null; // TODO implement logic of more tables
            elizaLogger.info(
                `[${this.playerName}] Agent joined game ${gameId} as player ${this.playerName} (ID: ${this.playerId})`
            );

            // Set up player view listener after successful join
            this.apiConnector.onPlayerView((view: PlayerView) => {
                if (verbose) elizaLogger.debug(`[${this.playerName}] Player view update received, isSendingMessage:`, {isSendingMessage: this.isSendingMessage});
                if (this.isSendingMessage) {
                    if (verbose) elizaLogger.debug(`[${this.playerName}] Skipping player view update because we are sending a message`, {
                        isSendingMessage: this.isSendingMessage,
                    });
                    return;
                }
                this.handlePlayerViewUpdate(view, verbose);
            });

            // Start polling for player view updates
            this.startPlayerViewPolling(verbose);
            // The apiConnector.joinGame method calls setPlayerReady internally
            this.playerReadySet = true;
            // Reset backoff on successful join
            this.joinBackoffMs = 5000;
        } catch (error: any) {
            elizaLogger.error(`[${this.playerName}] Failed to join game:`, error);
            // Reset state and try again with backoff
            this.resetGame();
            const delay = this.joinBackoffMs;
            this.joinBackoffMs = Math.min(this.joinBackoffMs * 2, 30000); // Max 30 second backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            await this.joinGame(gameId, verbose); // Try again
        }
    }

    private startPlayerViewPolling(verbose: boolean = true): void {
        // Clear any existing polling interval
        if (this.playerViewPollingInterval) {
            clearInterval(this.playerViewPollingInterval);
            this.playerViewPollingInterval = null;
        }

        // Start a new polling interval
        elizaLogger.info(`[${this.playerName}] Starting player view polling every ${this.playerViewPollingIntervalMs}ms`);
        this.playerViewPollingInterval = setInterval(() => {
            this.pollPlayerView(verbose);
        }, this.playerViewPollingIntervalMs);
    }

    private async pollPlayerView(verbose: boolean = true): Promise<void> {
        try {
            if (!this.playerId) {
                elizaLogger.warn(`[${this.playerName}] Cannot poll player view: player ID is not set`);
                return;
            }

            // Skip polling if we're currently sending a message
            if (this.isSendingMessage) {
                if (verbose) elizaLogger.debug(`[${this.playerName}] Skipping player view polling while sending message`, {
                    isSendingMessage: this.isSendingMessage
                });
                return;
            }

            // Check if enough time has passed since last poll
            const now = Date.now();
            if (now - this.lastPollTime < this.minPollInterval) {
                if (verbose) elizaLogger.debug(`[${this.playerName}] Skipping poll - too soon since last poll`, {
                    timeSinceLastPoll: now - this.lastPollTime,
                    minInterval: this.minPollInterval
                });
                return;
            }

            // Update last poll time
            this.lastPollTime = now;

            // Request player view update
            if (verbose) elizaLogger.debug(`[${this.playerName}] Polling for player view update`, {
                isSendingMessage: this.isSendingMessage,
                timeSinceLastPoll: now - this.lastPollTime
            });
            const response = await this.apiConnector.getPlayerView(this.playerId);
            if (response) {
                this.handlePlayerViewUpdate(response, verbose);
            }
        } catch (error) {
            elizaLogger.error(`[${this.playerName}] Error polling for player view:`, error);
        }
    }

    private stopPlayerViewPolling(): void {
        if (this.playerViewPollingInterval) {
            clearInterval(this.playerViewPollingInterval);
            this.playerViewPollingInterval = null;
            elizaLogger.info(`[${this.playerName}] Stopped player view polling`);
        }
    }

    private async handleGameUpdate(gameState: GameState, verbose: boolean = true): Promise<void> {
        if (!this.runtime) {
            return;
        }

        // Initialize roundHistory if undefined
        if (!gameState.roundHistory) {
            gameState.roundHistory = [];
        }

        if (gameState.players.length === 0) {
            elizaLogger.info(`[${this.playerName}] No players in game, trying to join`);
            this.resetGame();
            this.joinGame(undefined, verbose);
            return;
        }

        // Find player by name in the game state (instead of by ID)
        const ourPlayer = gameState.players.find(
            (player) => player.id === this.playerId
        );

        if (!ourPlayer) {
            elizaLogger.error(
                `[${this.playerName}] Player ${this.playerName} not found in game, cannot make decisions`
            );
            this.resetGame();
            this.joinGame(undefined, verbose);
            return;
        }

        // Don't make decisions if game is in waiting state, but check if we need to set ready
        if (gameState.tableStatus === "WAITING") {
            elizaLogger.info(`[${this.playerName}] Game is in waiting state`);

            // Check if we need to set ready status - only if we haven't already set it or if server says we're not ready
            // Use both the playerReadySet flag and the server-reported ready status
            if (!this.playerReadySet && ourPlayer.status !== "PLAYING") {
                elizaLogger.info(
                    `[${this.playerName}] Player is not ready yet, setting ready status`
                );
                try {
                    await this.apiConnector.setPlayerReady();
                    elizaLogger.info(`[${this.playerName}] Successfully set player ready status`);
                    // Mark that we've set the player ready, regardless of server state
                    this.playerReadySet = true;

                    // After setting ready, update the player state locally to avoid repeated calls
                    if (this.gameState && this.gameState.players) {
                        const playerIndex = this.gameState.players.findIndex(
                            (p) => p.id === ourPlayer.id
                        );
                        if (playerIndex >= 0) {
                            this.gameState.players[playerIndex].status = "PLAYING";
                        }
                    }
                } catch (error) {
                    elizaLogger.error(
                        `[${this.playerName}] Error setting player ready status:`,
                        error
                    );
                }
            } else {
                // If we've already set ready before OR if server says we're ready
                if (this.playerReadySet) {
                    elizaLogger.info(
                        `[${this.playerName}] Player ready status already set in this session`
                    );
                } else if (ourPlayer.status === "PLAYING") {
                    elizaLogger.info(
                        `[${this.playerName}] Player is already ready according to server`
                    );
                    this.playerReadySet = true; // Update our flag to match server state
                }
                elizaLogger.info(`[${this.playerName}] Waiting for game to start`);
            }

            return;
        }

        // Check if it's our turn using the unified method
        if (this.isPlayerTurn(gameState)) {
            // Skip if we're already in the process of making a decision
            if (this.isSendingMessage) {
                elizaLogger.warn(`[${this.playerName}] Already processing a decision, skipping turn`, {
                    event: 'TURN_SKIP_WARNING',
                    timestamp: new Date().toISOString(),
                    agent: {
                        name: this.playerName,
                        id: this.playerId
                    },
                    gameState: {
                        phase: gameState.tableStatus,
                        currentPlayerIndex: gameState.currentPlayerIndex,
                        roundNumber: gameState.round.roundNumber
                    }
                });
                return;
            }

            this.isSendingMessage = true;
            try {
                const decision = await this.makeDecision(gameState, false);
                if (verbose) elizaLogger.debug(`[${this.playerName}] Decision made:`, decision);
                await this.apiConnector.submitAction({
                    playerId: this.playerId!,
                    decision,
                });
            } catch (error) {
                elizaLogger.error(`[${this.playerName}] Error making decision:`, error);
            } finally {
                this.isSendingMessage = false;
                if (verbose) elizaLogger.debug(`[${this.playerName}] Turn processing completed`);
            }
        }

        // Update game state
        this.gameState = gameState;

        // Generate round history based on player actions
        gameState.roundHistory = gameState.roundHistory.concat(
            gameState.players.map((player) => {
                const isOurPlayer = player.id === this.playerId;
                const handInfo =
                    isOurPlayer && player.hand && player.hand.length > 0
                        ? ` with hand [${player.hand
                              .map((c) => `${c.rank}${c.suit[0]}`)
                              .join(", ")}]`
                        : "";

                if (player.status === "FOLDED")
                    return `${player.playerName} FOLDED${handInfo}`;
                if (player.status === "ALL_IN")
                    return `${player.playerName} ALL_IN with ${player.bet.volume} chips${handInfo}`;
                if (player.bet.volume > 0)
                    return `${player.playerName} bet ${player.bet.volume} chips${handInfo}`;
                return `${player.playerName} waiting${handInfo}`;
            })
        );

        // Check for game end
        if (gameState.tableStatus === "GAME_OVER") {
            const winner = gameState.winner;
            const outcome: PokerContent["outcome"] = {
                won: winner === this.playerId,
                chipsWon: ourPlayer.chips,
                finalPot: gameState.round.volume,
                finalCommunityCards: gameState.communityCards,
                finalPlayerCards: ourPlayer.hand,
                roundEndState: gameState.tableStatus,
            };

            // Update memory with outcome
            const memory = await this.runtime.messageManager?.getMemories({
                roomId: stringToUuid(this.gameId || "default-poker-room"),
                count: 1,
            });
            if (memory && memory.length > 0) {
                await this.updateMemoryWithOutcome(memory[0], gameState);
            }
        }
    }

    async getRelevantMemories(currentState: GameState, limit: number = 5, verbose: boolean = true): Promise<Memory[]> {
        if (!this.runtime?.messageManager) {
            return [];
        }

        try {
            // Criar uma descrição semântica da situação atual
            const currentSituation = `Poker game in ${currentState.tableStatus} phase with pot ${currentState.round.volume}.
                ${currentState.communityCards.length} community cards showing: ${currentState.communityCards.map(c => `${c.rank}${c.suit}`).join(' ')}.
                ${currentState.players.filter(p => p.status === "PLAYING").length} active players.
                Current bet is ${currentState.round.currentBet}.
                Player position: ${currentState.players.findIndex(p => p.id === this.playerId)}.
                Stack sizes: ${currentState.players.map(p => p.chips).join(', ')}.`;

            // Gerar embedding para a situação atual
            const embedding = await embed(this.runtime, currentSituation);

            // Buscar memórias semanticamente similares
            const memories = await this.runtime.messageManager.searchMemoriesByEmbedding(
                embedding,
                {
                    match_threshold: 0.7, // Ajustar conforme necessário
                    count: limit,
                    roomId: stringToUuid(this.gameId || 'default-poker-room'),
                    unique: true
                }
            );

            // Log para debug
            if (verbose) elizaLogger.debug(`[${this.playerName}] Semantic search results:`, {
                currentSituation,
                memoriesFound: memories.length,
                memories: memories.map(m => ({
                    id: m.id,
                    phase: (m.content as unknown as PokerContent).gameState?.phase,
                    action: (m.content as unknown as PokerContent).pokerAction?.action,
                    similarity: m.similarity
                }))
            });

            return memories;
        } catch (error) {
            elizaLogger.error(`[${this.playerName}] Error in semantic memory search:`, error);
            return [];
        }
    }

    private async makeDecision(gameState: GameState, verbose: boolean = true): Promise<PokerDecision> {
        this.isSendingMessage = true;
        try {
            if (verbose) elizaLogger.debug(`[${this.playerName}] Making decision`, {
                event: 'POKER_DECISION_START',
                timestamp: new Date().toISOString(),
                agent: {
                    name: this.playerName,
                    id: this.playerId
                },
                runtimeOK: !!this.runtime,
                gameId: this.gameId,
                roundId: this.roundId
            });

            if (!this.runtime) {
                elizaLogger.error(`[${this.playerName}] Runtime not found`);
                return {
                    action: PlayerAction.FOLD,
                    decisionContext: null
                };
            }

            const sleep = (ms: number): Promise<void> => {
                return new Promise(resolve => setTimeout(resolve, ms));
            };
            // elizaLogger.debug(`[${this.playerName}] Waiting 10 seconds before making decision`);
            // await sleep(5000); // Wait 5 seconds
            // elizaLogger.debug(`[${this.playerName}] Done waiting`);

            if (verbose) elizaLogger.debug(`[${this.playerName}] Timeout reached, making decision`, {
                event: "POKER_DECISION_TIMEOUT",
                timestamp: new Date().toISOString(),
                agent: {
                    name: this.playerName,
                    id: this.playerId,
                },
                game: {
                    id: this.gameId,
                    tableStatus: gameState.tableStatus,
                    phase: gameState.phase.street,
                    roundNumber: gameState.round.roundNumber,
                    currentBet: gameState.round.currentBet
                },
            });

            // Get relevant memories using the runtime's message manager
            const relevantMemories = await this.getRelevantMemories(gameState, undefined, verbose);
            const context = this.prepareGameContext(gameState, relevantMemories, verbose);
            const systemPrompt = this.prepareSystemPrompt(gameState);

            // Log the decision-making process
            if (verbose) elizaLogger.workflow(JSON.stringify({
                event: 'POKER_DECISION_START',
                timestamp: new Date().toISOString(),
                agent: {
                    name: this.playerName,
                    id: this.playerId
                },
                game: {
                    id: this.gameId,
                    phase: gameState.tableStatus,
                    pot: gameState.round.volume,
                    currentBet: gameState.round.currentBet,
                    roundHistory: gameState.roundHistory,
                    players: gameState.players.map(p => ({
                        id: p.id,
                        chips: p.chips,
                        bet: p.bet,
                        status: p.status
                    }))
                },
                context: {
                    relevantMemoriesCount: relevantMemories.length,
                    systemPrompt: systemPrompt,
                    gameContext: context
                }
            }));

            const response = await generateText({
                runtime: this.runtime,
                context: context,
                modelClass: ModelClass.MEDIUM,
                customSystemPrompt: systemPrompt,
                verbose: true
            });

            const decision = this.parseAgentResponse(response, false);

            // Log the decision outcome
            if (verbose) elizaLogger.workflow(JSON.stringify({
                event: 'POKER_DECISION_MADE',
                timestamp: new Date().toISOString(),
                agent: {
                    name: this.playerName,
                    id: this.playerId
                },
                game: {
                    id: this.gameId,
                    phase: gameState.tableStatus
                },
                decision: {
                    raw: response,
                    parsed: {
                        action: decision.action,
                        amount: decision.amount || 'N/A'
                    }
                }
            }));

            return decision;
        } catch (error) {
            elizaLogger.error(`[${this.playerName}] Error making decision:`, error);
            return {
                action: PlayerAction.FOLD,
                decisionContext: null
            };
        } finally {
            this.isSendingMessage = false;
            if (verbose) elizaLogger.debug(`[${this.playerName}] Decision making process completed, isSendingMessage set to false`);
        }
    }

    private prepareGameContext(gameState: GameState, relevantMemories: Memory[] = [], verbose: boolean = true): string {
        const baseContext = this.prepareBaseGameContext(gameState);
        let memoryContext = '';

        if (relevantMemories.length > 0) {
            const memoryAnalysis = relevantMemories.map(m => {
                const content = m.content as unknown as PokerContent;
                let resultDescription = "outcome unknown";

                if (content.outcome) {
                    resultDescription = content.outcome.won
                        ? `won ${content.outcome.chipsWon} chips`
                        : `lost ${Math.abs(content.outcome.chipsWon || 0)} chips`;

                    if (content.outcome.finalPlayerCards) {
                        resultDescription += ` with ${content.outcome.finalPlayerCards.map(c => `${c.rank}${c.suit}`).join(', ')}`;
                    }
                    if (content.outcome.finalCommunityCards) {
                        resultDescription += `\n  * Final board: ${content.outcome.finalCommunityCards.map(c => `${c.rank}${c.suit}`).join(', ')}`;
                    }

                    if (content.outcome.opponentFinalCards) {
                        resultDescription += `\n  * Opponent final cards: ${content.outcome.opponentFinalCards.map(c => `${c.rank}${c.suit}`).join(', ')}`;
                    }
                    if (content.outcome.opponentActions) {
                        resultDescription += `\n  * Opponent responses: ${content.outcome.opponentActions.join(', ')}`;
                    }
                }

                return [
                    `- Similar situation analysis:`,
                    `  * Phase: ${content.gameState.phase}`,
                    `  * Pot size: ${content.gameState.pot} chips`,
                    `  * Community cards: ${content.gameState.communityCards.map(c => `${c.rank}${c.suit}`).join(', ')}`,
                    `  * Active players: ${content.gameState.players.filter(p => p.status === "PLAYING").length}`,
                    `  * My position: ${content.gameState.position}`,
                    `  * My action: ${content.pokerAction.action}${content.pokerAction.amount ? ` (${content.pokerAction.amount})` : ''}`,
                    `  * Strategy used: ${content.pokerAction.decisionContext?.strategy || 'Not recorded'}`,
                    `  * Outcome: ${resultDescription}`
                ].join('\n');
            });

            memoryContext = [
                `\n\nLearned from previous similar situations:`,
                memoryAnalysis.join("\n\n"),
                `\n\nUse these past experiences to inform your current decision, noting which strategies led to positive outcomes.`,
            ].join("\n");
        }

        if (verbose) elizaLogger.debug("Game context:", `${baseContext}${memoryContext}`);
        return `${baseContext}${memoryContext}`;
    }

    private prepareSystemPrompt(gameState: GameState): string {
        const character = this.runtime?.character as any;

        const bio = Array.isArray(this.runtime?.character.bio) ? this.runtime?.character.bio.join("\n") : this.runtime?.character.bio;
        const lore = Array.isArray(this.runtime?.character.lore) ? this.runtime?.character.lore.join("\n") : this.runtime?.character.lore;

        const response = {
            action: 'One of ["FOLD", "CHECK", "CALL", "RAISE", "ALL_IN"]',
            amount: "number (required only for RAISE, represents total bet amount including current bet) as a single string",
            thinking:
                "Your internal thought process, including psychological reads and strategic considerations as a single string,",
            explanation:
                "A technical explanation of the mathematical and strategic reasons for your decision as a single string,",
            analysis:
                "A detailed breakdown of the current game situation and your position as a single string,",
            reasoning: "The logical steps that led to your decision as a single string,",
            strategy:
                "Your tactical approach and how this action fits into your broader game plan as a single string,",
            logic: "The fundamental poker concepts and principles guiding your decision as a single string,",
            roleplay:
                "A character-appropriate comment or reaction showing your emotional state as a single string",
        };

        const responseExample = {
            action: "RAISE",
            amount: 500,
            thinking:
                "The player to my right has been aggressive but tends to fold to resistance. My pocket Kings are strong enough to apply pressure.",
            explanation:
                "With pocket Kings pre-flop, raising to 500 represents 2.5x the big blind, maintaining pot control while building value.",
            analysis:
                "Stack sizes are deep, position is favorable as cutoff, and table dynamics suggest players are playing straightforward.",
            reasoning:
                "Strong hand + good position + exploitable opponent tendencies = opportunity for value raise.",
            strategy:
                "Establishing an aggressive image now will help get paid off with future strong hands.",
            logic: "Premium pairs should be played aggressively pre-flop to build pot and narrow field.",
            roleplay:
                "I adjust my sunglasses and confidently push forward a stack of chips",
        };

        const systemPrompt = [
            `You are an experienced poker player named ${
                character?.name || "PokerBot"
            }.`,
            `# Knowledge`,
            `${this.POKER_RULES}`,
            `# About You`,
            `${bio}`,
            `${lore}`,
            `# Game State`,
            `At the table we have ${gameState.players.length} players. At table ${this.gameId}`,
            `Your goal is to maximize your winnings using advanced poker strategy while staying true to your character.`,
            `# Decision Considerations`,
            `Consider the following elements for your decision:`,
            `1. Hand Strength Analysis`,
            `- Current hand strength`,
            `- Potential for improvement`,
            `- Position at the table`,
            `- Pot odds and implied odds`,
            `2. Player Psychology`,
            `- Your table image`,
            `- Opponent tendencies`,
            `- Your character's personality impact`,
            `3. Strategic Elements`,
            `- Stack sizes and betting patterns`,
            `- Position and table dynamics`,
            `- Stage of the tournament/game`,
            `- Risk/reward balance`,
            `4. Previous Experiences`,
            `- Learn from past similar situations`,
            `- Adapt based on results`,
            `- Consider successful patterns`,
            `5. Pre-flop Strategy`,
            `- In pre-flop, prefer calling to see the flop unless facing very aggressive raises or holding very weak hands`,
            `- Give marginal hands a chance by seeing more flops when the price is reasonable`,
            `- Only fold pre-flop with the weakest hands or when facing large raises that threaten your stack`,
            `- Balance your natural playing style with selective aggression to create memorable moments`,
            `IMPORTANT: Respond with a JSON object containing the following fields:`,
            `{`,
            `${Object.keys(response)
                .map((key) => `${key}: ${response[key]}`)
                .join("\n")}`,
            `}`,
            `Example response:`,
            `{`,
            `${Object.keys(responseExample)
                .map((key) => `${key}: ${responseExample[key]}`)
                .join("\n")}`,
            `}`,
            `IMPORTANT FORMAT RULES:`,
            `1. All fields must be strings, not objects or arrays`,
            `2. The analysis field must be a single string containing all analysis points`,
            `3. Do not use nested objects or arrays in any field`,
            `4. Ensure your response is a valid JSON object with all required fields.`,
            `5. Do NOT escape quotes within string values - use regular quotes inside strings`,
            `6. For the roleplay field, use simple text without special characters or quotes that need escaping`,
            `7. Example of CORRECT roleplay: "I adjust my sunglasses and push chips forward"`,
            `8. Example of INCORRECT roleplay: "I adjust my sunglasses and push chips forward" (with escaped quotes)`,
        ].join("\n");

        // elizaLogger.debug("System prompt:", systemPrompt);
        return systemPrompt;
    }

    private prepareBaseGameContext(gameState: GameState): string {
        const player = gameState.players.find((p) => p.id === this.playerId);
        if (!player) {
            throw new Error("Player not found in game state");
        }

        const opponents = gameState.players.filter((p) => p.id !== this.playerId);
        const opponentInfo = opponents
            .map(
                (opp) =>
                    `${opp.playerName} (${opp.chips} chips, ${
                        opp.status === "FOLDED"
                            ? "FOLDED"
                            : opp.status === "ALL_IN"
                            ? "ALL_IN"
                            : `bet: ${opp.bet.volume}`
                    })`
            )
            .join(", ");

        const baseGameContext = [
            `Current game state:`,
            `- Your chips: ${player.chips}`,
            `- Pot: ${gameState.round.volume}`,
            `- Current bet: ${gameState.round.currentBet}`,
            `- Round phase: ${gameState.phase.street}`,
            `- Round number: ${gameState.round.roundNumber}`,
            `- Your position: ${
                gameState.currentPlayerIndex === gameState.players.findIndex((p) => p.id === this.playerId)
                    ? "Your turn"
                    : "Waiting"
            }`,
            `- Opponents: ${opponentInfo}`,
            `- Community cards: ${this.formatCards(gameState.communityCards)}`,
            `${
                player.hand && player.hand.length > 0
                ? `- Your cards: ${this.formatCards(player.hand)}`
                : ""
            }`,
        ].join('\n');

        // elizaLogger.debug("Base game context:", baseGameContext);
        return baseGameContext;
    }

    private formatCard(card: Card): string {
        const rankMap: { [key: number]: string } = {
            1: "A",
            11: "J",
            12: "Q",
            13: "K",
        };
        const suitMap: { [key: string]: string } = {
            hearts: "♥",
            diamonds: "♦",
            clubs: "♣",
            spades: "♠",
        };
        const rank = rankMap[card.rank] || card.rank.toString();
        const suit = suitMap[card.suit] || card.suit;
        return `${rank}${suit}`;
    }

    private formatCards(cards: readonly Card[]): string {
        return cards.map((card) => this.formatCard(card)).join(" ");
    }

    private parseAgentResponse(response: string, verbose: boolean = true): PokerDecision {
        try {
            // Log the raw response
            if (verbose) elizaLogger.debug("Raw response from agent:", response);

            // Clean the response by removing code block markers if present
            let cleanResponse = response.replace(/```json\n/, '').replace(/```/, '').trim();

            // Fix common JSON escaping issues
            // Remove escaped quotes that are incorrectly placed
            cleanResponse = cleanResponse.replace(/\\"/g, '"');
            // Fix double-escaped quotes
            cleanResponse = cleanResponse.replace(/\\\\"/g, '\\"');
            // Remove any trailing commas before closing braces
            cleanResponse = cleanResponse.replace(/,(\s*[}\]])/g, '$1');

            if (verbose) elizaLogger.debug("Cleaned response:", cleanResponse);

            // Try to parse the response as JSON
            let parsed;
            try {
                parsed = JSON.parse(cleanResponse);
            } catch (jsonError) {
                // If JSON parsing fails, try to extract just the action field
                elizaLogger.warn("JSON parsing failed, attempting to extract action field:", jsonError);

                // Try to find action field using regex
                const actionMatch = cleanResponse.match(/"action"\s*:\s*"([^"]+)"/i);
                if (actionMatch) {
                    const action = actionMatch[1].toUpperCase();
                    if (Object.values(PlayerAction).includes(action as PlayerAction)) {
                        elizaLogger.info("Successfully extracted action from malformed JSON:", action);
                        return {
                            action: action as PlayerAction,
                            decisionContext: null
                        };
                    }
                }

                // If we can't extract action, re-throw the original error
                throw jsonError;
            }

            if (verbose) elizaLogger.debug("Parsed JSON:", parsed);

            let action: string = parsed.action?.toUpperCase();
            if (verbose) elizaLogger.debug("Parsed action:", action);

            if (action.includes("ALL IN") || action.includes("ALL-IN")) {
                action = PlayerAction.ALL_IN;
            }

            if (action.includes("CHECK")) {
                action = PlayerAction.CALL;
            }

            // Validate the action
            if (!action || !Object.values(PlayerAction).includes(action as PlayerAction)) {
                elizaLogger.error(`Invalid action: ${action}, valid actions are: ${Object.values(PlayerAction).join(', ')}`);
                throw new Error(`Invalid action: ${action}`);
            }

            // Build the decision object with all analysis fields
            const decision: PokerDecision = {
                action: action as PlayerAction,
                decisionContext: {
                    thinking: parsed.thinking || null,
                    explanation: parsed.explanation || null,
                    analysis: parsed.analysis || null,
                    reasoning: parsed.reasoning || null,
                    strategy: parsed.strategy || null,
                    logic: parsed.logic || null,
                    roleplay: parsed.roleplay || null
                }
            };

            // Add amount if it's a RAISE action
            if (action === PlayerAction.RAISE) {
                const amount = parseInt(parsed.amount);
                if (isNaN(amount) || amount <= 0) {
                    throw new Error(`Invalid raise amount: ${parsed.amount}`);
                }
                decision.amount = amount;
            }

            // Log the complete decision with all fields
            if (verbose) elizaLogger.workflow(JSON.stringify({
                event: 'POKER_DECISION_PARSED',
                decision: decision
            }));

            return decision;

        } catch (error) {
            console.error("Error parsing agent response:", error);
            elizaLogger.error("Error parsing agent response:", error);
            elizaLogger.error("Original response:", response);
            return {
                action: PlayerAction.FOLD,
                decisionContext: null
            };
        }
    }

    private async updateMemoryWithOutcome(memory: Memory, gameState: GameState): Promise<void> {
        if (!this.runtime?.messageManager) return;

        const content = memory.content as unknown as PokerContent;
        const myInitialChips = content.gameState.chips;
        const currentChips = gameState.players.find(p => p.id === this.playerId)?.chips || 0;

        const outcome = {
            won: currentChips > myInitialChips,
            chipsWon: currentChips - myInitialChips,
            finalPot: gameState.round.volume,
            finalCommunityCards: gameState.communityCards,
            finalPlayerCards: content.gameState.playerCards,
            roundEndState: gameState.tableStatus,
            opponentActions: gameState.roundHistory?.slice(
                gameState.roundHistory.findIndex(h => h.includes(content.pokerAction.action)) + 1
            ) || [],
            completeRoundHistory: gameState.roundHistory
        };

        // Update the memory with the outcome
        content.outcome = outcome;
        memory.content = content as unknown as Content;
        // Save the updated memory
        await this.runtime.messageManager.createMemory(memory, true);
    }

    // private evaluateHandStrength(communityCards: SchemaCard[], playerCards: SchemaCard[]): string {
    //     const allCards = [...communityCards, ...playerCards];
    //     // This is a simplified evaluation - you'd want a more sophisticated hand evaluator in practice
    //     const ranks = allCards.map(c => c.rank);
    //     const suits = allCards.map(c => c.suit);

    //     // Simple patterns - you'd want more sophisticated logic in practice
    //     const hasFlush = suits.filter(s => suits.filter(x => x === s).length >= 5).length > 0;
    //     const hasPair = ranks.filter(r => ranks.filter(x => x === r).length >= 2).length > 0;
    //     const hasTrips = ranks.filter(r => ranks.filter(x => x === r).length >= 3).length > 0;

    //     if (hasFlush) return "Flush or better";
    //     if (hasTrips) return "Three of a kind";
    //     if (hasPair) return "Pair";
    //     return "High card";
    // }

    private POKER_RULES = `
    # Texas Hold'em Poker Rules

    ## Hand Rankings (from highest to lowest)
    1. Royal Flush: A, K, Q, J, 10 of the same suit
    2. Straight Flush: Five consecutive cards of the same suit
    3. Four of a Kind: Four cards of the same rank
    4. Full House: Three of a kind plus a pair
    5. Flush: Any five cards of the same suit
    6. Straight: Five consecutive cards of any suit
    7. Three of a Kind: Three cards of the same rank
    8. Two Pair: Two different pairs
    9. One Pair: Two cards of the same rank
    10. High Card: Highest card when no other hand is made

    ## Regular Game Structure (3+ Players)
    1. Positions and Blinds:
       - Small Blind (SB): First forced bet, left of button
       - Big Blind (BB): Second forced bet, twice the small blind
       - Button (BTN): Dealer position, acts last post-flop
       - Early Position (EP): First positions after blinds
       - Middle Position (MP): Middle positions
       - Cut-off (CO): Position before button
       - Action moves clockwise

    2. Betting Rounds:
       - Pre-flop: After hole cards dealt
         * Action starts from player after BB
         * Must at least call BB to continue
       - Flop: After first three community cards
         * Action starts from first active player after button
       - Turn: After fourth community card
         * Action starts from first active player after button
       - River: After fifth community card
         * Action starts from first active player after button
       - Showdown: Players show hands to determine winner

    ## Heads-Up Structure (2 Players)
    1. Positions and Blinds:
       - Button/Small Blind (BTN/SB): Same player posts SB and is button
       - Big Blind (BB): Other player posts BB
       - Positions alternate every hand
       - Pre-flop: BTN/SB acts first
       - Post-flop: BB acts first

    2. Betting Rounds:
       - Pre-flop: After hole cards dealt
         * BTN/SB acts first
         * BB acts last
       - Flop, Turn, River:
         * BB acts first
         * BTN/SB acts last
       - Showdown: Players show hands to determine winner

    ## Universal Rules
    1. Betting Actions:
       - Fold: Give up hand and any bets made
       - Check: Pass action when no bet to call
       - Call: Match the current bet
       - Raise: Increase the current bet (min-raise = previous bet size)
       - All-in: Bet all remaining chips

    2. General Rules:
       - Each player gets 2 hole cards face down
       - 5 community cards dealt face up (3 flop, 1 turn, 1 river)
       - Best 5-card hand wins using any combination of hole and community cards
       - Betting round ends when all active players have bet the same amount
       - Hand ends when all but one player folds or at showdown
       - Split pots possible with identical hands

    3. Odd Chip Rule:
       - If the pot is odd, the player with the odd chip will win the pot
       - If the pot is even, the player with the higher chip will win the pot
       - If the pot is even and the players have the same chip, the player with the higher card will win the pot
       - If the pot is even and the players have the same chip and card, the player with the higher rank will win the pot
       - If the pot is even and the players have the same chip and card and rank, the player with the higher suit will win the pot
       - If the pot is even and the players have the same chip and card and rank and suit, the player with the higher rank will win the pot

    4. Game Over:
       - Game ends when only one player has chips left
    `;
}

// ## Strategic Guidelines
//     1. Position Play:
//        - Late position (BTN, CO): Play more hands, more aggressive
//        - Middle position: Be more selective
//        - Early position: Play premium hands only
//        - Blinds: Defend with appropriate hands, consider pot odds

//     2. Pot Odds and Math:
//        - Calculate pot odds: (Call amount) / (Pot size + Call amount)
//        - Compare to hand equity
//        - Consider implied odds for drawing hands

//     3. Stack Size Strategy:
//        - Deep (>100BB): More room for post-flop play
//        - Medium (40-100BB): Standard play
//        - Short (<40BB): Push/fold strategy becomes more important

//     4. Hand Selection:
//        - Premium hands: AA, KK, QQ, AK
//        - Strong hands: JJ, TT, AQ, AJs
//        - Speculative hands: Small pairs, suited connectors
//        - Marginal hands: Weak aces, unsuited connectors
