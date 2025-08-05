import { elizaLogger, stringToUuid } from "@elizaos/core";
import {
    GameState,
    PokerDecision,
    AvailableGame,
    PlayerAction,
} from "./game-state";
import {
    GameEvent,
    PlayerView,
    PokerState,
    PlayerEvent,
    Move,
} from "./schemas";

export class ApiConnector {
    private baseUrl: string;
    private playerId: string | null = null;
    private playerName: string | null = null;
    private roomId: string;
    private apiKey: string | null = null;
    private ws: WebSocket | null = null;
    private messageId = 0;
    private messageCallbacks: Map<number, (data: any) => void> = new Map();
    private stateUpdateCallbacks: ((state: PokerState) => void)[] = [];
    private playerViewCallbacks: ((view: PlayerView) => void)[] = [];
    private connected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(baseUrl: string, apiKey?: string, playerName?: string, roomId?: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey || null;
        this.playerName = playerName || null;
        this.roomId = roomId || "default";
        elizaLogger.log(
            `[${this.playerName || 'Unknown'}] EffectApiConnector initialized with base URL:`,
            baseUrl,
            "room:",
            this.roomId
        );
        if (apiKey) {
            elizaLogger.log(`[${this.playerName || 'Unknown'}] EffectApiConnector initialized with API key`);
        }
    }

    private getHeaders(verbose: boolean = false): HeadersInit {
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };

        if (this.apiKey) {
            headers["x-api-key"] = this.apiKey;
            if (verbose) elizaLogger.debug(`[${this.playerName || 'Unknown'}] Adding API key to request headers`);
        } else {
            elizaLogger.warn(`[${this.playerName || 'Unknown'}] No API key available for request`);
        }

        if (verbose) {
            elizaLogger.debug(`[${this.playerName || 'Unknown'}] Request headers:`, {
                ...headers,
                "x-api-key": this.apiKey ? "[REDACTED]" : "undefined",
            });
        }
        return headers;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getWebSocketState(): number | null {
        return this.ws?.readyState ?? null;
    }

    getPlayerId(): string | null {
        return this.playerId;
    }

    setPlayerId(id: string): void {
        this.playerId = id;
    }

    setPlayerName(name: string): void {
        this.playerName = name;
    }

    // WebSocket connection methods
    connect(verbose: boolean = false): Promise<void> {
        if (verbose) elizaLogger.debug(`[${this.playerName || 'Unknown'}] Connecting to WebSocket`);
        return new Promise((resolve, reject) => {
            if (this.ws) {
                if (this.ws.readyState === WebSocket.OPEN) {
                    if (verbose) elizaLogger.debug(`[${this.playerName || 'Unknown'}] WebSocket already connected`);
                    resolve();
                    return;
                }
                this.ws.close();
            }

            const wsUrl = this.baseUrl.replace(/^http/, "ws") + `/rpc?room=${this.roomId}`;
            elizaLogger.log(`[${this.playerName || 'Unknown'}] Connecting to WebSocket at ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                elizaLogger.log(`[${this.playerName || 'Unknown'}] WebSocket connection established`);
                this.connected = true;
                this.reconnectAttempts = 0;
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    elizaLogger.error(
                        `[${this.playerName || 'Unknown'}] Error parsing WebSocket message:`,
                        error
                    );
                }
            };

            this.ws.onclose = () => {
                elizaLogger.log(`[${this.playerName || 'Unknown'}] WebSocket connection closed`);
                this.connected = false;
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                elizaLogger.error(`[${this.playerName || 'Unknown'}] WebSocket error:`, error);
                reject(error);
            };
        });
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] Max reconnection attempts reached`);
            return;
        }

        const backoffTime = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts),
            30000
        );
        elizaLogger.log(
            `[${this.playerName || 'Unknown'}] Attempting to reconnect in ${backoffTime}ms (attempt ${
                this.reconnectAttempts + 1
            }/${this.maxReconnectAttempts})`
        );

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch((error) => {
                elizaLogger.error(`[${this.playerName || 'Unknown'}] Reconnection attempt failed:`, error);
            });
        }, backoffTime);
    }

    private handleWebSocketMessage(data: any): void {
        // Handle Effect Exit responses (for specific message callbacks)
        if (
            (data._tag === "Exit" || data._tag === "Defect") &&
            data.requestId
        ) {
            const id = parseInt(data.requestId);
            if (this.messageCallbacks.has(id)) {
                const callback = this.messageCallbacks.get(id);
                if (callback) {
                    callback(data);
                    this.messageCallbacks.delete(id);
                }
                return;
            }
        }

        // Handle state updates
        if (data.type === "stateUpdate") {
            this.stateUpdateCallbacks.forEach((callback) =>
                callback(data.state)
            );
            return;
        }

        // Handle player view updates
        if (data.type === "playerView") {
            this.playerViewCallbacks.forEach((callback) => callback(data.view));
            return;
        }

        elizaLogger.warn(`[${this.playerName || 'Unknown'}] Unhandled message type:`, data);
    }

    private sendWebSocketMessage(method: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error("WebSocket is not connected"));
                return;
            }

            const id = this.messageId++;
            const message = {
                _tag: "Request",
                id: id.toString(),
                tag: method,
                payload: payload,
                traceId: "traceId",
                spanId: "spanId",
                sampled: true,
                headers: {},
            };

            // Set up callback for this specific message, receive on onmessage > handleWebSocketMessage
            this.messageCallbacks.set(id, (response) => {
                // elizaLogger.debug("Response for message", id, ":", response);
                if (response._tag === "Exit") {
                    if (response.exit._tag === "Success") {
                        resolve(response.exit.value);
                    } else if (response.exit._tag === "Failure") {
                        reject(response.exit.cause);
                    } else {
                        reject(new Error("Unknown exit format"));
                    }
                } else if (response._tag === "Defect") {
                    reject(response.defect);
                } else {
                    reject(new Error("Unknown response format"));
                }
            });

            elizaLogger.debug(`[${this.playerName || 'Unknown'}] Sending WebSocket message:`, message);
            this.ws.send(JSON.stringify(message));
        });
    }

    async getAvailableGames(): Promise<AvailableGame[]> {
        try {
            const response = await fetch(`${this.baseUrl}/games`, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.games.map((game: any) => ({
                id: game.id,
                players: game.players.map((p: any) => ({
                    id: p.id,
                    playerName: p.playerName || "Unknown",
                    status: p.status || "PLAYING"
                })),
                createdAt: game.createdAt,
                tableStatus: game.tableStatus || "WAITING",
                playersNeeded: game.playersNeeded
            }));
        } catch (error) {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] Error fetching available games:`, error);
            throw error;
        }
    }

    // TODO: Implement logic of multiple tables
    async getGameState(gameId?: string): Promise<GameState> {
        const state = await this.getCurrentState();
        return this.convertPokerStateToGameState(state);
    }

    async joinGame({
        gameId,
        playerName,
    }: {
        gameId?: string;
        playerName: string;
    }): Promise<string> {
        await this.connect().catch((error) => {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] [joinGame] Error connecting to WebSocket:`, error);
            throw error;
        });

        const playerId = stringToUuid(playerName);
        this.setPlayerId(playerId);
        this.setPlayerName(playerName);

        // Send join event
        const event: PlayerEvent = {
            type: "table",
            playerId,
            playerName,
            action: "join",
        };

        await this.processEvent(event);
        return playerId;
    }

    async setPlayerReady(): Promise<void> {
        // In the Effect model, players are ready as soon as they join
        // No need for an explicit ready action
    }

    async leaveGame(gameId: string, playerId: string): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not connected");
        }

        const event: PlayerEvent = {
            type: "table",
            playerId,
            playerName: this.playerName,
            action: "leave",
        };

        await this.processEvent(event);
    }

    // async createGame(gameName: string, options: any = {}): Promise<string> {
    //     try {
    //         await this.connect();

    //         // In the Effect model, we don't create games directly
    //         // Instead, we check if the current game is in a state where it can accept new players
    //         const state = await this.getCurrentState();

    //         // Check if the game is in a state where it can accept new players
    //         const canJoinGame = state.status === "WAITING";

    //         if (!canJoinGame) {
    //             elizaLogger.info(
    //                 `Game is in state ${state.status}, cannot join`
    //             );
    //             throw new Error(
    //                 `Game is in state ${state.status}, cannot join`
    //             );
    //         }

    //         // Check if the game is full (more than 9 players)
    //         const playerCount = Object.keys(state.players).length;
    //         const isGameFull = playerCount >= 9;

    //         if (isGameFull) {
    //             elizaLogger.info(`Game is full with ${playerCount} players`);
    //             throw new Error(`Game is full with ${playerCount} players`);
    //         }

    //         elizaLogger.info(`Game is available with ${playerCount} players`);
    //         return "default";
    //     } catch (error) {
    //         elizaLogger.error("Error creating game:", error);
    //         throw error;
    //     }
    // }

    async getAllGames(): Promise<GameState[]> {
        const state = await this.getCurrentState();
        return [this.convertPokerStateToGameState(state)];
    }

    async submitAction({
        gameId,
        playerId,
        decision,
    }: {
        gameId?: string;
        playerId: string;
        decision: PokerDecision;
    }): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not connected");
        }

        const move: Move = this.convertDecisionToMove(decision);

        const event: PlayerEvent = {
            type: "move",
            playerId,
            move,
        };

        await this.processEvent(event);
    }

    // Effect-specific methods
    async getCurrentState(): Promise<PokerState> {
        await this.connect().catch((error) => {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] [getCurrentState] Error connecting to WebSocket:`, error);
            throw error;
        });
        return this.sendWebSocketMessage("currentState", {});
    }

    async processEvent(event: GameEvent): Promise<PokerState> {
        await this.connect().catch((error) => {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] [processEvent] Error connecting to WebSocket:`, error);
            throw error;
        });
        return this.sendWebSocketMessage("processEvent", { event });
    }

    onStateUpdate(callback: (state: PokerState) => void): void {
        this.stateUpdateCallbacks.push(callback);

        // If this is the first callback, start listening for state updates
        if (this.stateUpdateCallbacks.length === 1) {
            this.startListeningToStateUpdates();
        }
    }

    onPlayerView(callback: (view: PlayerView) => void): void {
        this.playerViewCallbacks.push(callback);

        // If this is the first callback, start listening for player view updates
        if (this.playerViewCallbacks.length === 1) {
            this.startListeningToPlayerView();
        }
    }

    private async startListeningToStateUpdates(): Promise<void> {
        try {
            await this.connect().catch((error) => {
                elizaLogger.error(`[${this.playerName || 'Unknown'}] [startListeningToStateUpdates] Error connecting to WebSocket:`, error);
                throw error;
            });

            // Send a message to subscribe to state updates
            this.sendWebSocketMessage("stateUpdates", {})
                .then((response) => {
                    elizaLogger.log(`[${this.playerName || 'Unknown'}] Subscribed to state updates`);
                })
                .catch((error) => {
                    elizaLogger.error(
                        `[${this.playerName || 'Unknown'}] Error subscribing to state updates:`,
                        error
                    );
                });
        } catch (error) {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] Error starting state updates listener:`, error);
        }
    }

    private async startListeningToPlayerView(): Promise<void> {
        try {
            await this.connect().catch((error) => {
                elizaLogger.error(`[${this.playerName || 'Unknown'}] [startListeningToPlayerView] Error connecting to WebSocket:`, error);
                throw error;
            });

            if (!this.playerId) {
                elizaLogger.error(
                    `[${this.playerName || 'Unknown'}] Cannot subscribe to player view without a player ID`
                );
                return;
            }

            // Send a message to subscribe to player view updates
            this.sendWebSocketMessage("playerView", { playerId: this.playerId })
                .then((response) => {
                    elizaLogger.log(`[${this.playerName || 'Unknown'}] Subscribed to player view updates`);
                })
                .catch((error) => {
                    elizaLogger.error(
                        `[${this.playerName || 'Unknown'}] Error subscribing to player view updates:`,
                        error
                    );
                });
        } catch (error) {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] Error starting player view listener:`, error);
        }
    }

    // Conversion methods
    convertPokerStateToGameState(state: PokerState): GameState {
        return {
            players: state.players.map((player) => ({
                id: player.id,
                playerName: player.playerName,
                status: player.status,
                chips: player.chips,
                hand: player.hand.length > 0 ? [...player.hand] : undefined,
                bet: { ...player.bet },
            })),
            tableStatus: state.tableStatus,
            currentPlayerIndex: state.currentPlayerIndex,
            dealerId: state.dealerId,
            winner: state.winner,
            phase: state.phase,
            round: {
                roundNumber: state.round.roundNumber,
                volume: state.round.volume,
                currentBet: state.round.currentBet,
                foldedPlayers: [...state.round.foldedPlayers],
                allInPlayers: [...state.round.allInPlayers],
            },
            communityCards: [...state.community],
            config: { ...state.config },
            roundHistory: [],  // Initialize empty array for round history
        };
    }

    private convertDecisionToMove(decision: PokerDecision): Move {
        switch (decision.action) {
            case PlayerAction.FOLD:
                return {
                    type: "fold",
                    decisionContext: decision.decisionContext || null
                };
            case PlayerAction.CALL:
                return {
                    type: "call",
                    decisionContext: decision.decisionContext || null
                };
            case PlayerAction.ALL_IN:
                return {
                    type: "all_in",
                    decisionContext: decision.decisionContext || null
                };
            case PlayerAction.RAISE:
                if (!decision.amount) {
                    throw new Error("Raise action requires an amount");
                }
                return {
                    type: "raise",
                    amount: decision.amount,
                    decisionContext: decision.decisionContext || null
                };
            default:
                throw new Error(`Unsupported action: ${decision.action}`);
        }
    }

    async getPlayerView(playerId: string): Promise<PlayerView | null> {
        try {
            await this.connect().catch((error) => {
                elizaLogger.error(`[${this.playerName || 'Unknown'}] [getPlayerView] Error connecting to WebSocket:`, error);
                throw error;
            });

            // Send a message to request player view
            elizaLogger.debug(`[${this.playerName || 'Unknown'}] Requesting player view for player ${playerId}`);
            const response = await this.sendWebSocketMessage("playerView", { playerId });
            // elizaLogger.debug(`Response player view ${JSON.stringify(response)}`);
            return response;
        } catch (error) {
            elizaLogger.error(`[${this.playerName || 'Unknown'}] Error requesting player view:`, error);
            throw error;
        }
    }
}
