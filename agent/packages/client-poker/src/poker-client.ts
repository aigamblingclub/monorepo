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
import { GameState, PlayerAction, PokerDecision, Card } from "./game-state";
import { ApiConnector } from "./api-connector";
import { PokerState, PlayerView, GameEvent } from "./schemas";
import { embed } from "@elizaos/core";

export interface PokerClientConfig {
    apiBaseUrl?: string;
    apiKey?: string; // Make API key required in config
    playerName?: string;
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
    pokerAction: ExtendedPokerDecision;
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

// Add this near the top of the file, with other interfaces
interface ExtendedPokerDecision extends PokerDecision {
    thinking?: string;
    explanation?: string;
    analysis?: string;
    reasoning?: string;
    strategy?: string;
    logic?: string;
    roleplay?: string;
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
        this.apiConnector = new ApiConnector(apiBaseUrl, config.apiKey, config.playerName);
        elizaLogger.info("Poker client created with API endpoint:", apiBaseUrl);
        // elizaLogger.debug("API key configured:", {
        //     apiKeyLength: config.apiKey.length,
        // });
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
            agentName: this.playerName,
        });

        // Connect to WebSocket
        try {
            await this.apiConnector.connect();
            this.isConnected = true;
            elizaLogger.info("Connected to poker server WebSocket");

            // Set up state update listeners
            this.apiConnector.onStateUpdate((state: PokerState) => {
                this.handlePokerStateUpdate(state);
            });

            // Removed player view listener setup from here
            // It will be set up after a successful game join
        } catch (error) {
            elizaLogger.error("Failed to connect to poker server:", error);
        }

        // I think that we will not need because of the websocket listener
        // Start polling to check game state or find available games
        this.intervalId = setInterval(async () => {
            try {
                // If not in a game, try to find and join one
                // if (!this.gameId) {
                //     const now = Date.now();
                //     // Only attempt to join if enough time has passed since last attempt
                //     if (now - this.lastJoinAttempt >= this.joinBackoffMs) {
                //         this.lastJoinAttempt = now;

                //         // Check if already in a game or try to enter a new one
                //         await this.checkAndConnectToExistingGame();
                //     }
                // }

                // I think that we will not need because of the websocket listener
                // If in a game, check for game state updates
                if (this.isConnected) {
                    try {
                        const gameState = await this.apiConnector.getGameState();
                        elizaLogger.debug("1111 gameState:", gameState);
                        await this.handleGameUpdate(gameState);
                    } catch (error) {
                        elizaLogger.error("Error getting game state:", {
                            error,
                            message: error.message,
                            stack: error.stack,
                            isConnected: this.isConnected,
                            wsState: this.apiConnector.getWebSocketState()
                        });
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

    private handlePokerStateUpdate(state: PokerState): void {
        try {
            elizaLogger.info("Received poker state update");
            const gameState = this.apiConnector.convertPokerStateToGameState(state);
            elizaLogger.debug("gameState:", gameState);
            this.handleGameUpdate(gameState);
        } catch (error) {
            elizaLogger.error("Error handling poker state update:", error);
        }
    }

    private async handlePlayerViewUpdate(view: PlayerView): Promise<void> {
        try {
            // Skip processing if we're currently sending a message
            if (this.isSendingMessage) {
                elizaLogger.debug("Skipping player view update processing while sending message", {
                    isSendingMessage: this.isSendingMessage
                });
                return;
            }

            elizaLogger.info("Received player view update");
            // Update our player ID if needed
            if (view.player && view.player.id && this.playerId !== view.player.id) {
                this.playerId = view.player.id;
                elizaLogger.info(`Updated player ID to ${this.playerId}`);
            }

            // If round is over, stop polling
            if (view.tableStatus === "ROUND_OVER") {
                elizaLogger.info("Round is over, stopping player view polling");
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
                this.gameState.pot = view.pot;
                this.gameState.round.currentBet = view.round.currentBet;

                // Update opponents
                if (view.opponents) {
                    Object.entries(view.opponents).forEach(([id, opponent]) => {
                        const player = this.gameState!.players.find(p => p.id === id);
                        if (player) {
                            player.chips = opponent.chips;
                            player.bet.total = opponent.bet.total;
                            player.status = opponent.status;
                        }
                    });
                }

                // Check if it's our turn
                const isOurTurn = view.currentPlayerId &&
                    (typeof view.currentPlayerId === 'object' && 'value' in view.currentPlayerId
                        ? view.currentPlayerId.value === this.playerId
                        : typeof view.currentPlayerId === 'string' && view.currentPlayerId === this.playerId);

                if (isOurTurn) {
                    // Set flag before sending
                    this.isSendingMessage = true;

                    elizaLogger.info("It's our turn, making a decision");
                    let decision = await this.makeDecision(this.gameState);
                    elizaLogger.info(
                        `Decision made: ${decision.action}`,
                        decision
                    );

                    // Submit the action to the server
                    if (this.playerId) {
                        // gameid is not set in the game state yet
                        elizaLogger.debug("Submitting action:", {
                            playerId: this.playerId,
                            decision,
                        });

                        elizaLogger.debug("Setting isSendingMessage to true");

                        try {
                            elizaLogger.debug("Sending action to server");
                            await this.apiConnector.submitAction({
                                playerId: this.playerId,
                                decision,
                            });
                            elizaLogger.debug("Action sent successfully");
                        } catch (error) {
                            elizaLogger.error(
                                "Error submitting action:",
                                error
                            );
                        } finally {
                            this.isSendingMessage = false;
                            elizaLogger.debug(
                                "Setting isSendingMessage to false"
                            );
                        }
                    } else {
                        elizaLogger.error(
                            "Cannot submit action: gameId or playerId is missing"
                        );
                    }
                } else {
                    elizaLogger.info("Not our turn, waiting for next update");
                }
            }
        } catch (error) {
            elizaLogger.error("Error handling player view update:", error);
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
                elizaLogger.error("Error leaving game:", error);
            }
        }

        elizaLogger.info("PokerClient stopped");
    }

    async joinGame(gameId?: string): Promise<void> {
        try {
            this.playerName = this.runtime?.character.name || "ElizaPokerBot";
            elizaLogger.info(
                "Attempting to join game",
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
                `Agent joined game ${gameId} as player ${this.playerName} (ID: ${this.playerId})`
            );

            // Set up player view listener after successful join
            this.apiConnector.onPlayerView((view: PlayerView) => {
                this.handlePlayerViewUpdate(view);
            });

            // Start polling for player view updates
            this.startPlayerViewPolling();
            // The apiConnector.joinGame method calls setPlayerReady internally
            this.playerReadySet = true;
            // Reset backoff on successful join
            this.joinBackoffMs = 5000;
        } catch (error: any) {
            elizaLogger.error("Failed to join game:", error)
            // Reset state since join failed and we couldn't recover
            // this.resetGame();
        }
    }

    private startPlayerViewPolling(): void {
        // Clear any existing polling interval
        if (this.playerViewPollingInterval) {
            clearInterval(this.playerViewPollingInterval);
            this.playerViewPollingInterval = null;
        }

        // Start a new polling interval
        elizaLogger.info(`Starting player view polling every ${this.playerViewPollingIntervalMs}ms`);
        this.playerViewPollingInterval = setInterval(() => {
            this.pollPlayerView();
        }, this.playerViewPollingIntervalMs);
    }

    private async pollPlayerView(): Promise<void> {
        try {
            if (!this.playerId) {
                elizaLogger.warn("Cannot poll player view: player ID is not set");
                return;
            }

            // Skip polling if we're currently sending a message
            if (this.isSendingMessage) {
                elizaLogger.debug("Skipping player view polling while sending message", {
                    isSendingMessage: this.isSendingMessage
                });
                return;
            }

            // Check if enough time has passed since last poll
            const now = Date.now();
            if (now - this.lastPollTime < this.minPollInterval) {
                elizaLogger.debug("Skipping poll - too soon since last poll", {
                    timeSinceLastPoll: now - this.lastPollTime,
                    minInterval: this.minPollInterval
                });
                return;
            }

            // Update last poll time
            this.lastPollTime = now;

            // Request player view update
            elizaLogger.debug("Polling for player view update", {
                isSendingMessage: this.isSendingMessage,
                timeSinceLastPoll: now - this.lastPollTime
            });
            const response = await this.apiConnector.getPlayerView(this.playerId);
            if (response) {
                this.handlePlayerViewUpdate(response);
            }
        } catch (error) {
            elizaLogger.error("Error polling for player view:", error);
        }
    }

    private stopPlayerViewPolling(): void {
        if (this.playerViewPollingInterval) {
            clearInterval(this.playerViewPollingInterval);
            this.playerViewPollingInterval = null;
            elizaLogger.info("Stopped player view polling");
        }
    }

    private async handleGameUpdate(gameState: GameState): Promise<void> {
        if (!this.runtime) {
            return;
        }

        // Initialize roundHistory if undefined
        if (!gameState.roundHistory) {
            gameState.roundHistory = [];
        }

        // Find player by name in the game state (instead of by ID)
        const ourPlayer = gameState.players.find(
            (player) => player.id === this.playerId
        );

        if (!ourPlayer) {
            elizaLogger.error(
                `Player ${this.playerName} not found in game, cannot make decisions`
            );
            this.resetGame();
            this.joinGame();
            return;
        }

        // Don't make decisions if game is in waiting state, but check if we need to set ready
        if (gameState.tableStatus === "WAITING") {
            elizaLogger.info("Game is in waiting state");

            // Check if we need to set ready status - only if we haven't already set it or if server says we're not ready
            // Use both the playerReadySet flag and the server-reported ready status
            if (!this.playerReadySet && ourPlayer.status !== "PLAYING") {
                elizaLogger.info(
                    "Player is not ready yet, setting ready status"
                );
                try {
                    await this.apiConnector.setPlayerReady();
                    elizaLogger.info("Successfully set player ready status");
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
                } else if (ourPlayer.status === "PLAYING") {
                    elizaLogger.info(
                        "Player is already ready according to server"
                    );
                    this.playerReadySet = true; // Update our flag to match server state
                }
                elizaLogger.info("Waiting for game to start");
            }

            return;
        }

        // Check if it's our turn and we need to make a decision
        const isOurTurn =
            gameState.currentPlayerIndex ===
            gameState.players.findIndex((p) => p.id === this.playerId);
        const player = gameState.players.find((p) => p.id === this.playerId);

        if (isOurTurn && player && player.status === "PLAYING") {
            try {
                const decision = await this.makeDecision(gameState);
                await this.apiConnector.submitAction({
                    playerId: this.playerId!,
                    decision,
                });
            } catch (error) {
                elizaLogger.error("Error making decision:", error);
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
                    return `${player.playerName} ALL_IN with ${player.bet.total} chips${handInfo}`;
                if (player.bet.total > 0)
                    return `${player.playerName} bet ${player.bet.total} chips${handInfo}`;
                return `${player.playerName} waiting${handInfo}`;
            })
        );

        // Check for game end
        if (gameState.tableStatus === "GAME_OVER" && player) {
            const winner = gameState.winner;
            const outcome: PokerContent["outcome"] = {
                won: winner === this.playerId,
                chipsWon: player.chips,
                finalPot: gameState.pot,
                finalCommunityCards: gameState.communityCards,
                finalPlayerCards: player.hand,
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

    async getRelevantMemories(currentState: GameState, limit: number = 5): Promise<Memory[]> {
        if (!this.runtime?.messageManager) {
            return [];
        }

        try {
            // Criar uma descrição semântica da situação atual
            const currentSituation = `Poker game in ${currentState.tableStatus} phase with pot ${currentState.pot}.
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
            elizaLogger.debug('Semantic search results:', {
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
            elizaLogger.error("Error in semantic memory search:", error);
            return [];
        }
    }

    private async makeDecision(gameState: GameState): Promise<ExtendedPokerDecision> {
        try {
            if (!this.runtime) return { action: PlayerAction.FOLD };

            // Get relevant memories using the runtime's message manager
            const relevantMemories = await this.getRelevantMemories(gameState);
            const context = this.prepareGameContext(gameState, relevantMemories);
            const systemPrompt = this.prepareSystemPrompt(gameState);

            // Log the decision-making process
            elizaLogger.workflow(JSON.stringify({
                event: 'POKER_DECISION_START',
                timestamp: new Date().toISOString(),
                agent: {
                    name: this.playerName,
                    id: this.playerId
                },
                game: {
                    id: this.gameId,
                    phase: gameState.tableStatus,
                    pot: gameState.pot,
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
            });

            const decision = this.parseAgentResponse(response);

            // Log the decision outcome
            elizaLogger.workflow(JSON.stringify({
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

            // Create memory with poker-specific content
            const memory: Memory = {
                id: stringToUuid(Date.now().toString()),
                userId: stringToUuid(this.playerId || Date.now().toString()),
                roomId: stringToUuid(this.gameId || 'default-poker-room'),
                agentId: this.runtime.agentId,
                createdAt: Date.now(),
                embedding: getEmbeddingZeroVector(),
                content: {
                    text: response,
                    source: 'poker' as const,
                    action: decision.action,
                    gameId: this.gameId || '',
                    roundId: this.roundId,
                    pokerAction: decision,
                    gameState: {
                        pot: gameState.pot,
                        currentBet: gameState.round.currentBet,
                        playerCards: gameState.players.find(p => p.id === this.playerId)?.hand,
                        communityCards: gameState.communityCards,
                        chips: gameState.players.find(p => p.id === this.playerId)?.chips || 0,
                        position: gameState.players.findIndex(p => p.id === this.playerId),
                        phase: gameState.tableStatus,
                        players: gameState.players.map(p => ({
                            id: p.id,
                            chips: p.chips,
                            bet: p.bet,
                            status: p.status
                        })),
                        round: {
                            phase: gameState.round.phase,
                            roundNumber: gameState.round.roundNumber,
                            roundPot: gameState.round.roundPot,
                            currentBet: gameState.round.currentBet,
                            foldedPlayers: gameState.round.foldedPlayers,
                            allInPlayers: gameState.round.allInPlayers
                        }
                    }
                } as unknown as Content
            };

            // Add embedding to memory for semantic search
            await this.runtime.messageManager.addEmbeddingToMemory(memory);

            // Store memory in the database
            await this.runtime.messageManager.createMemory(memory);

            return decision;
        } catch (error) {
            // Log error in decision making
            elizaLogger.workflow(JSON.stringify({
                event: 'POKER_DECISION_ERROR',
                timestamp: new Date().toISOString(),
                agent: {
                    name: this.playerName,
                    id: this.playerId
                },
                game: {
                    id: this.gameId,
                    phase: gameState.tableStatus
                },
                error: {
                    message: error.message,
                    stack: error.stack
                }
            }));

            elizaLogger.error("Error making decision:", error);
            return { action: PlayerAction.FOLD };
        }
    }

    private prepareGameContext(gameState: GameState, relevantMemories: Memory[] = []): string {
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

                return `- Similar situation analysis:
  * Phase: ${content.gameState.phase}
  * Pot size: ${content.gameState.pot} chips
  * Community cards: ${content.gameState.communityCards.map(c => `${c.rank}${c.suit}`).join(', ')}
  * Active players: ${content.gameState.players.filter(p => p.status === "PLAYING").length}
  * My position: ${content.gameState.position}
  * My action: ${content.pokerAction.action}${content.pokerAction.amount ? ` (${content.pokerAction.amount})` : ''}
  * Strategy used: ${content.pokerAction.strategy || 'Not recorded'}
  * Outcome: ${resultDescription}`;
            }).join('\n\n');

            memoryContext = `\n\nLearned from previous similar situations:\n${memoryAnalysis}\n\nUse these past experiences to inform your current decision, noting which strategies led to positive outcomes.`;
        }

        return `${baseContext}${memoryContext}`;
    }

    private prepareSystemPrompt(gameState: GameState): string {
        const character = this.runtime?.character as any;

        const bio = typeof character?.bio === 'string' ? character.bio : '';
        const lore = typeof character?.lore === 'string' ? character.lore : '';
        const response = {
            action: 'One of ["FOLD", "CHECK", "CALL", "RAISE", "ALL-IN"]',
            amount: "number (required only for RAISE, represents total bet amount including current bet)",
            thinking:
                "Your internal thought process, including psychological reads and strategic considerations,",
            explanation:
                "A technical explanation of the mathematical and strategic reasons for your decision,",
            analysis:
                "A detailed breakdown of the current game situation and your position,",
            reasoning: "The logical steps that led to your decision,",
            strategy:
                "Your tactical approach and how this action fits into your broader game plan,",
            logic: "The fundamental poker concepts and principles guiding your decision,",
            roleplay:
                "A character-appropriate comment or reaction showing your emotional state",
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
                "*adjusts sunglasses and confidently pushes forward a stack of chips*",
        };
        return `You are an experienced poker player named ${
            character?.name || "PokerBot"
        }.

    # Knowledge
    ${this.POKER_RULES}

    # About You
    ${bio}
    ${lore}

    At the table we have ${gameState.players.length} players. At table ${
            this.gameId
        }
    Your goal is to maximize your winnings using advanced poker strategy while staying true to your character.

    Consider the following elements for your decision:
    1. Hand Strength Analysis
    - Current hand strength
    - Potential for improvement
    - Position at the table
    - Pot odds and implied odds

    2. Player Psychology
    - Your table image
    - Opponent tendencies
    - Your character's personality impact

    3. Strategic Elements
    - Stack sizes and betting patterns
    - Position and table dynamics
    - Stage of the tournament/game
    - Risk/reward balance

    4. Previous Experiences
    - Learn from past similar situations
    - Adapt based on results
    - Consider successful patterns

    IMPORTANT: Respond with a JSON object containing the following fields:
        {
            ${Object.keys(response)
                .map((key) => `${key}: ${response[key]}`)
                .join("\n")}
        }

        Example response:
        {
            ${Object.keys(responseExample)
                .map((key) => `${key}: ${responseExample[key]}`)
                .join("\n")}
        }

        Ensure your response is a valid JSON object with all required fields.`;
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
                            : `bet: ${opp.bet.total}`
                    })`
            )
            .join(", ");

        return `
Current game state:
- Your chips: ${player.chips}
- Pot: ${gameState.pot}
- Current bet: ${gameState.round.currentBet}
- Round phase: ${gameState.round.phase}
- Round number: ${gameState.round.roundNumber}
- Your position: ${
            gameState.currentPlayerIndex === gameState.players.findIndex((p) => p.id === this.playerId)
                ? "Your turn"
                : "Waiting"
        }
- Opponents: ${opponentInfo}
- Community cards: ${this.formatCards(gameState.communityCards)}
${
            player.hand && player.hand.length > 0
                ? `- Your cards: ${this.formatCards(player.hand)}`
                : ""
        }
`;
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

    private parseAgentResponse(response: string): ExtendedPokerDecision {
        try {
            // Log the raw response
            elizaLogger.debug("Raw response from agent:", response);

            // Clean the response by removing code block markers if present
            let cleanResponse = response.replace(/```json\n/, '').replace(/```/, '').trim();
            elizaLogger.debug("Cleaned response:", cleanResponse);

            // Try to parse the response as JSON
            const parsed = JSON.parse(cleanResponse);
            elizaLogger.debug("Parsed JSON:", parsed);

            const action = parsed.action?.toUpperCase();
            elizaLogger.debug("Parsed action:", action);

            // Validate the action
            if (!action || !Object.values(PlayerAction).includes(action)) {
                elizaLogger.error(`Invalid action: ${action}, valid actions are: ${Object.values(PlayerAction).join(', ')}`);
                throw new Error(`Invalid action: ${action}`);
            }

            // Build the decision object with all analysis fields
            const decision: ExtendedPokerDecision = {
                action: action as PlayerAction,
                thinking: parsed.thinking || '',
                explanation: parsed.explanation || '',
                analysis: parsed.analysis || '',
                reasoning: parsed.reasoning || '',
                strategy: parsed.strategy || '',
                logic: parsed.logic || '',
                roleplay: parsed.roleplay || ''
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
            elizaLogger.workflow(JSON.stringify({
                event: 'POKER_DECISION_PARSED',
                decision: {
                    action: decision.action,
                    amount: 'amount' in decision ? decision.amount : undefined,
                    thinking: decision.thinking,
                    explanation: decision.explanation,
                    analysis: decision.analysis,
                    reasoning: decision.reasoning,
                    strategy: decision.strategy,
                    logic: decision.logic,
                    roleplay: decision.roleplay
                }
            }));

            return decision;

        } catch (error) {
            elizaLogger.error("Error parsing agent response:", error);
            elizaLogger.error("Original response:", response);
            // In case of error, return FOLD with error explanation
            return {
                action: PlayerAction.FOLD,
                thinking: "Error occurred, choosing safest option",
                explanation: "Error parsing JSON response, folding for safety",
                analysis: "Unable to properly analyze the situation due to error",
                reasoning: "Error handling requires conservative play",
                strategy: "Default to safe play when uncertain",
                logic: "When system errors occur, minimize potential losses",
                roleplay: "*looks confused and folds*"
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
            finalPot: gameState.pot,
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

    ## Game Structure
    1. Blinds and Position:
       - Small Blind (SB): First forced bet, to the left of the button
       - Big Blind (BB): Second forced bet, twice the small blind
       - Button (BTN): Dealer position, best position at the table
       - Position importance: BTN > CO > MP > EP > BB > SB

    2. Betting Rounds:
       - Pre-flop: After hole cards are dealt
       - Flop: After first three community cards
       - Turn: After fourth community card
       - River: After fifth community card

    3. Betting Actions:
       - Fold: Give up the hand and any bets made
       - Check: Pass the action when no bet to call
       - Call: Match the current bet
       - Raise: Increase the current bet (min-raise = previous bet size)
       - All-in: Bet all remaining chips

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
