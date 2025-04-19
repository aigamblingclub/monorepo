import { elizaLogger } from "@elizaos/core";
import {
    GameState,
    PokerDecision,
    AvailableGamesResponse,
    AvailableGame,
} from "./game-state";
import { ApiError } from './types';

export class ApiConnector {
    private baseUrl: string;
    private playerId: string;
    private playerName: string;
    private apiKey: string | null = null;

    constructor(baseUrl: string, playerId: string, playerName: string) {
        this.baseUrl = baseUrl;
        this.playerId = playerId;
        this.playerName = playerName;
        elizaLogger.log("ApiConnector initialized with base URL:", baseUrl);
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            "Content-Type": "application/json",
            "X-Player-ID": this.playerId,
            "X-Player-Name": this.playerName,
        };

        if (this.apiKey) {
            headers["X-API-Key"] = this.apiKey;
            elizaLogger.debug("Adding API key to request headers");
        } else {
            elizaLogger.warn("No API key available for request");
        }

        elizaLogger.debug("Request headers:", {
            ...headers,
            "X-API-Key": this.apiKey ? "[REDACTED]" : "undefined",
        });
        return headers;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getPlayerId(): string {
        return this.playerId;
    }

    setApiKey(apiKey: string) {
        this.apiKey = apiKey;
        elizaLogger.info("API key updated");
    }

    clearApiKey() {
        this.apiKey = null;
        elizaLogger.info("API key cleared");
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new ApiError(
                error.message || 'API request failed',
                response.status,
                error.code
            );
        }
        return response.json();
    }

    public async get<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        return this.handleResponse<T>(response);
    }

    public async post<T>(endpoint: string, data: any): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
        return this.handleResponse<T>(response);
    }

    public async put<T>(endpoint: string, data: any): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
        return this.handleResponse<T>(response);
    }

    public async delete<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
        });
        return this.handleResponse<T>(response);
    }
}
