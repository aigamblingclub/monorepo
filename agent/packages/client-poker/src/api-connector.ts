import { elizaLogger } from "@elizaos/core";
import {
    GameState,
    PokerDecision,
    AvailableGamesResponse,
    AvailableGame,
} from "./game-state";

export class ApiConnector {
    private baseUrl: string;
    private playerId: string | null = null;
    private playerName: string | null = null;
    private apiKey: string | null = null;

    constructor(baseUrl: string, apiKey?: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey || null;
        elizaLogger.log("ApiConnector initialized with base URL:", baseUrl);
        if (apiKey) {
            elizaLogger.log("ApiConnector initialized with API key");
        }
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };

        if (this.apiKey) {
            headers["x-api-key"] = this.apiKey;
            elizaLogger.debug("Adding API key to request headers");
        } else {
            elizaLogger.warn("No API key available for request");
        }

        elizaLogger.debug("Request headers:", {
            ...headers,
            "x-api-key": this.apiKey ? "[REDACTED]" : "undefined",
        });
        return headers;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getPlayerId(): string | null {
        return this.playerId;
    }

    setApiKey(apiKey: string) {
        this.apiKey = apiKey;
        elizaLogger.info("API key updated");
    }

    async checkPlayerGame(): Promise<{
        inGame: boolean;
        gameId?: string;
        game?: {
            id: string;
            state: string;
            players: Array<{
                id: string;
                name: string;
                isReady: boolean;
            }>;
            createdAt: string;
        };
    }> {
        try {
            const url = `${this.baseUrl}/api/game/player-game`;
            elizaLogger.log(`Checking if player is in a game: ${url}`);

            const response = await fetch(url, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            elizaLogger.log(`Player game check result:`, data);

            // If player is in a game, update local state
            if (data.inGame && data.gameId) {
                // O jogador que fez a requisição é o dono do apiKey
                // Não precisamos procurar, todos os dados são sobre ele

                if (data.player) {
                    // Buscamos o nome se disponível
                    const playerInfo = data.player;
                    this.playerName = playerInfo.name;

                    elizaLogger.info(
                        `Found player in game: ${data.gameId},player: ${
                            playerInfo.name
                        }, ready: ${!!playerInfo?.isReady}`
                    );
                }
            }

            return data;
        } catch (error) {
            elizaLogger.error(`Error checking player game:`, error);
            return { inGame: false };
        }
    }

    async getAvailableGames(): Promise<AvailableGame[]> {
        try {
            const url = `${this.baseUrl}/api/game/available-games`;
            const headers = this.getHeaders();
            elizaLogger.log(`Fetching available games from: ${url}`);

            const response = await fetch(url, {
                headers,
            });
            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                elizaLogger.error("Request details:", {
                    url,
                    headers: {
                        ...headers,
                        "x-api-key": headers["x-api-key"]
                            ? "[REDACTED]"
                            : "undefined",
                    },
                    status: response.status,
                    statusText: response.statusText,
                });
                elizaLogger.debug("Request details:", {
                    url,
                    headers: {
                        ...headers,
                        "x-api-key": headers["x-api-key"],
                    },
                    status: response.status,
                    statusText: response.statusText,
                });
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as AvailableGamesResponse;
            elizaLogger.log(`Available games:`, data);
            return data.games;
        } catch (error) {
            elizaLogger.error("Error fetching available games:", error);
            return [];
        }
    }

    async getGameState(gameId: string): Promise<GameState> {
        try {
            if (!gameId) {
                throw new Error("Cannot get game state: Game ID is not set");
            }

            const url = `${this.baseUrl}/api/game/state`;
            elizaLogger.log(`Fetching game state from: ${url}`);

            const response = await fetch(url, {
                headers: this.getHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return (await response.json()) as GameState;
        } catch (error) {
            elizaLogger.error(`Error fetching game state:`, error);
            throw error;
        }
    }

    async joinGame(gameId: string, playerName: string): Promise<string> {
        try {
            const url = `${this.baseUrl}/api/game/join`;
            elizaLogger.info(
                `Joining game at: ${url} with player name: ${playerName} and gameId: ${gameId}`
            );

            const response = await fetch(url, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({
                    gameId,
                    playerName,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );

                // Parse error response to check for "already in game" message
                try {
                    const errorJson = JSON.parse(errorText);
                    if (
                        errorJson.message &&
                        errorJson.message.includes(
                            "already in an active game"
                        ) &&
                        errorJson.gameId
                    ) {
                        // Create a custom error with the gameId
                        const customError = new Error(errorJson.message);
                        (customError as any).gameId = errorJson.gameId;
                        throw customError;
                    }
                } catch (parseError) {
                    // If can't parse JSON, just continue with generic error
                    elizaLogger.debug(
                        "Could not parse error response as JSON:",
                        parseError
                    );
                }

                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            elizaLogger.log(`Successfully joined game, response:`, data);
            this.playerId = data.playerId;
            this.playerName = playerName; // Store the player name when joining

            // Once joined, mark as ready
            await this.setPlayerReady();

            return data.playerId;
        } catch (error) {
            elizaLogger.error(`Error joining game:`, error);
            throw error;
        }
    }

    async setPlayerReady(): Promise<void> {
        try {
            const url = `${this.baseUrl}/api/game/ready`;
            elizaLogger.log(`Setting player ready at: ${url}`);

            const response = await fetch(url, {
                method: "POST",
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            elizaLogger.log(`Player ready status set, response:`, data);
        } catch (error) {
            elizaLogger.error(`Error setting player ready:`, error);
            throw error;
        }
    }

    async leaveGame(gameId: string, playerId: string): Promise<void> {
        try {
            const url = `${this.baseUrl}/api/game/leave/${playerId}`;
            elizaLogger.log(`Leaving game at: ${url}`);

            const response = await fetch(url, {
                method: "POST",
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            elizaLogger.log(`Successfully left game ${gameId}`);

            // Clear player data after leaving game
            if (this.playerId === playerId) {
                this.playerId = null;
                // We keep playerName as it's connected to the agent identity
            }
        } catch (error) {
            elizaLogger.error(`Error leaving game:`, error);
            throw error;
        }
    }

    async createGame(gameName: string, options: any = {}): Promise<string> {
        try {
            const url = `${this.baseUrl}/api/game/new-game`;
            elizaLogger.log(`Creating new game at: ${url}`);

            const response = await fetch(url, {
                method: "POST",
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            elizaLogger.log(`Game creation response:`, data);

            // Return a dummy game ID since the server doesn't return one
            return "current";
        } catch (error) {
            elizaLogger.error("Error creating game:", error);
            throw error;
        }
    }

    async getAllGames(): Promise<GameState[]> {
        try {
            const url = `${this.baseUrl}/api/game/games`;
            elizaLogger.log(`Fetching all games from: ${url}`);

            const response = await fetch(url, {
                headers: this.getHeaders(),
            });
            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            elizaLogger.log(`All games response:`, data);
            return data.games;
        } catch (error) {
            elizaLogger.error("Error fetching all games:", error);
            return [];
        }
    }

    async submitAction(
        gameId: string,
        playerId: string,
        decision: PokerDecision
    ): Promise<void> {
        try {
            const playerIdForAction = playerId;
            const url = `${this.baseUrl}/api/game/action`;
            elizaLogger.log(
                `Submitting action to game ${gameId} for player ${this.playerName} (ID: ${playerIdForAction})`,
                decision
            );

            const response = await fetch(url, {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({
                    gameId,
                    playerId: playerIdForAction,
                    action: decision.action,
                    amount: decision.amount,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                elizaLogger.error(
                    `HTTP error (${response.status}): ${errorText}`
                );
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            elizaLogger.log(
                `Successfully submitted action for player ${this.playerName}`
            );
        } catch (error) {
            elizaLogger.error(`Error submitting action:`, error);
            throw error;
        }
    }
}
