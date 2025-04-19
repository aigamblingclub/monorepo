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
}
