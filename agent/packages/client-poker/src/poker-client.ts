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

    async joinGame(gameId: string): Promise<void> {
        try {
            this.playerName = this.runtime?.character.name || "ElizaPokerBot";
            elizaLogger.info(
                "Attempting to join game",
                gameId,
                "as",
                this.playerName
            );
            this.playerId = await this.apiConnector.joinGame(
                gameId,
                this.playerName
            );
            this.gameId = gameId;
            elizaLogger.info(
                `Agent joined game ${gameId} as player ${this.playerName} (ID: ${this.playerId})`
            );
            // The apiConnector.joinGame method calls setPlayerReady internally
            this.playerReadySet = true;
            // Reset backoff on successful join
            this.joinBackoffMs = 5000;
        } catch (error: any) {
            elizaLogger.error("Failed to join game:", error);

            // Check if error is because player is already in this game
            if (
                error.message?.includes(
                    "Player is already in an active game"
                ) &&
                error.gameId
            ) {
                // Use the gameId from the error response
                elizaLogger.info(
                    `Player already in game ${error.gameId}, connecting to existing game`
                );

                // Verificar o estado atual do jogador usando o novo endpoint
                try {
                    const playerGameStatus =
                        await this.apiConnector.checkPlayerGame();

                    if (playerGameStatus.inGame && playerGameStatus.gameId) {
                        this.gameId = playerGameStatus.gameId;

                        // Atualizar o ID do jogador se estiver disponível
                        const ourPlayer = playerGameStatus.game?.players.find(
                            (player) => player.name === this.playerName
                        );

                        if (ourPlayer) {
                            this.playerId = ourPlayer.id;
                            elizaLogger.info(
                                `Found player ID: ${this.playerId} in existing game`
                            );

                            // Verificar se o jogador precisa ser marcado como ready
                            if (!ourPlayer.isReady) {
                                elizaLogger.info(
                                    "Player is not ready yet, setting ready status"
                                );
                                try {
                                    await this.apiConnector.setPlayerReady();
                                    elizaLogger.info(
                                        "Successfully set player ready status"
                                    );
                                    // Mark that we've set the player ready
                                    this.playerReadySet = true;
                                } catch (readyError) {
                                    elizaLogger.error(
                                        "Error setting player ready status:",
                                        readyError
                                    );
                                }
                            } else {
                                elizaLogger.info(
                                    "Player is already ready according to server"
                                );
                                this.playerReadySet = true; // Update flag to match server state
                            }

                            return; // Successfully connected to existing game
                        }
                    }
                } catch (e) {
                    elizaLogger.error(
                        "Error retrieving player data from existing game:",
                        e
                    );
                }
            } else if (error.message?.includes("Game is full")) {
                // If game is full, increase backoff time
                this.joinBackoffMs = Math.min(this.joinBackoffMs * 2, 30000);
            }

            // Reset state since join failed and we couldn't recover
            this.resetGame();
        }
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

    // Método auxiliar para verificar se o jogador já está em um jogo e conectar a ele
    private async checkAndConnectToExistingGame(): Promise<boolean> {
        try {
            elizaLogger.info("Checking for existing game");
            // Verificar se já está em um jogo usando o endpoint específico
            const playerGameStatus = await this.apiConnector.checkPlayerGame();
            elizaLogger.info(
                `Player game status: ${JSON.stringify(playerGameStatus)}`
            );
            if (playerGameStatus.inGame && playerGameStatus.gameId) {
                // Jogador já está em um jogo, conectar a ele
                elizaLogger.info(
                    `Player already in game: ${playerGameStatus.gameId}`
                );
                this.gameId = playerGameStatus.gameId;

                // Store the current game state
                if (playerGameStatus.game) {
                    this.gameState = {
                        id: playerGameStatus.game.id,
                        players: playerGameStatus.game.players.map((p) => ({
                            id: p.id,
                            name: p.name,
                            isReady: p.isReady,
                            chips: 0,
                            currentBet: 0,
                            isFolded: false,
                        })),
                        gameState: playerGameStatus.game.state as
                            | "waiting"
                            | "preflop"
                            | "flop"
                            | "turn"
                            | "river"
                            | "showdown",
                        pot: 0,
                        isGameOver: false,
                        lastUpdateTime: playerGameStatus.game.createdAt,
                        currentBet: 0,
                        communityCards: [],
                    };
                }

                // Verificar se o player precisa ser marcado como ready
                const ourPlayer = playerGameStatus.game?.players.find(
                    (player) => player.name === this.playerName
                );

                if (ourPlayer) {
                    // Save the player ID
                    // this.playerId = ourPlayer.id;

                    // Only set ready if player is not already ready and we haven't set it yet
                    if (!ourPlayer.isReady && !this.playerReadySet) {
                        elizaLogger.info(
                            "Player is not ready yet, setting ready status"
                        );
                        try {
                            await this.apiConnector.setPlayerReady();
                            elizaLogger.info(
                                "Successfully set player ready status"
                            );

                            // Mark that we've set the player ready
                            this.playerReadySet = true;

                            // Update local state to avoid repeated calls
                            if (this.gameState && this.gameState.players) {
                                const playerIndex =
                                    this.gameState.players.findIndex(
                                        (p) => p.name === this.playerName
                                    );
                                if (playerIndex >= 0) {
                                    this.gameState.players[
                                        playerIndex
                                    ].isReady = true;
                                }
                            }
                        } catch (error) {
                            elizaLogger.error(
                                "Error setting player ready status:",
                                error
                            );
                        }
                    } else {
                        // If already ready or we've already set it
                        if (ourPlayer.isReady) {
                            elizaLogger.info(
                                "Player is already ready according to server"
                            );
                            this.playerReadySet = true; // Update our flag to match server state
                        } else if (this.playerReadySet) {
                            elizaLogger.info(
                                "Player ready status already set in this session"
                            );
                        }
                    }
                }

                return true; // Conectado a um jogo existente
            } else {
                elizaLogger.info(
                    "Player is not in a game, checking for available games"
                );
                const availableGames =
                    await this.apiConnector.getAvailableGames();
                elizaLogger.info(
                    `Available games: ${JSON.stringify(availableGames)}`
                );

                if (availableGames.length > 0) {
                    // Entrar no primeiro jogo disponível
                    await this.joinGame(availableGames[0].id);
                    return true; // Tentativa de entrada em um jogo
                } else {
                    elizaLogger.info("No available games found to join");
                    return false; // Nenhum jogo disponível para entrar
                }
            }
        } catch (error) {
            elizaLogger.error("Error checking player game status:", error);
            return false;
        }
    }

    private async makeDecision(gameState: GameState): Promise<PokerDecision> {
        try {
            if (!this.runtime) return { action: PlayerAction.FOLD };
            elizaLogger.info("gameState:", gameState);
            // Preparar contexto para o modelo
            const context = this.prepareGameContext(gameState);

            // Consultar o agente para tomar uma decisão
            elizaLogger.info("Asking agent for poker decision");

            const response = await generateText({
                runtime: this.runtime,
                context: context,
                modelClass: ModelClass.MEDIUM,
                customSystemPrompt: `Você é um jogador de poker experiente chamado ${
                    this.runtime.character.name || "PokerBot"
                }.

                Na mesa temos ${gameState.players.length} jogadores. Na mesa ${
                    this.gameId
                }
                Seu objetivo é maximizar seus ganhos usando estratégia avançada de poker.
                Analise cuidadosamente a situação atual do jogo e tome uma decisão estratégica.

                Considere os seguintes elementos para sua decisão:
                1. A força da sua mão atual
                2. Suas chances de melhorar com as cartas comunitárias
                3. O tamanho do pote e da aposta atual
                4. Sua posição na mesa e quantidade de fichas
                5. O comportamento dos outros jogadores

                Evite dar fold constantemente - use check, call ou raise quando apropriado.
                Uma estratégia de poker bem sucedida envolve uma mistura de jogadas conservadoras e agressivas.

                IMPORTANTE: Responda APENAS com um dos seguintes formatos:
                - "FOLD" (quando quiser desistir)
                - "CHECK" (quando quiser passar sem apostar)
                - "CALL" (quando quiser igualar a aposta atual)
                - "RAISE X" (onde X é o valor total da aposta, incluindo a aposta atual)

                NÃO inclua explicações ou comentários adicionais - apenas a ação.`,
            });
            elizaLogger.info(`Agent response: ${response}`);
            elizaLogger.info(`Agent context: ${context}`);
            // Analisar a resposta para extrair a ação
            const decision = this.parseAgentResponse(response);
            elizaLogger.info(`Agent decision: ${JSON.stringify(decision)}`);

            // Substituir a lógica aleatória por uma análise estratégica determinística
            if (decision.action === PlayerAction.FOLD) {
                // Obter informações do jogador e do estado do jogo
                const playerInfo = gameState.players.find(
                    (p) => p.id === this.playerId
                );

                if (playerInfo) {
                    // Se não há aposta atual, sempre é melhor CHECK do que FOLD
                    if (gameState.currentBet === 0) {
                        elizaLogger.info(
                            "Overriding FOLD to CHECK when no current bet"
                        );
                        return { action: PlayerAction.CHECK };
                    }

                    // Se o jogador tem uma mão forte, considerar CALL ou CHECK em vez de FOLD
                    if (
                        playerInfo.hand &&
                        this.hasStrongHand(
                            playerInfo.hand,
                            gameState.communityCards
                        )
                    ) {
                        // Se a aposta é pequena em relação às fichas do jogador, fazer CALL
                        if (gameState.currentBet <= playerInfo.chips / 10) {
                            elizaLogger.info(
                                "Overriding FOLD to CALL with strong hand and small bet"
                            );
                            return { action: PlayerAction.CALL };
                        }
                    }

                    // Se a fase do jogo é preflop e o jogador tem boas cartas iniciais
                    if (gameState.gameState === "preflop" && playerInfo.hand) {
                        const hasHighCard = this.hasHighCard(playerInfo.hand);
                        const hasPair = this.hasPair(playerInfo.hand);

                        // Com par inicial ou cartas altas, vale a pena continuar na mão
                        if (hasPair || hasHighCard) {
                            // Se a aposta é razoável
                            if (gameState.currentBet <= playerInfo.chips / 5) {
                                elizaLogger.info(
                                    "Overriding FOLD to CALL with strong starting hand"
                                );
                                return { action: PlayerAction.CALL };
                            }
                        }
                    }

                    // Em estágios finais (turn/river) com pot substancial, considere CALL em apostas pequenas
                    if (
                        (gameState.gameState === "turn" ||
                            gameState.gameState === "river") &&
                        gameState.pot > playerInfo.chips / 2 &&
                        gameState.currentBet <= playerInfo.chips / 20
                    ) {
                        elizaLogger.info(
                            "Overriding FOLD to CALL with large pot and small bet in late stage"
                        );
                        return { action: PlayerAction.CALL };
                    }
                }
            }

            return decision;
        } catch (error) {
            elizaLogger.error("Error making decision:", error);
            return { action: PlayerAction.FOLD };
        }
    }
}
