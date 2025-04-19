import { PokerClient } from "./poker-client";
import { elizaLogger } from "@elizaos/core";

export function createPokerClient(runtime: any) {
    const apiKey = runtime.character.settings?.secrets?.POKER_API_KEY;
    if (!apiKey) {
        elizaLogger.error("API key not found in character configuration");
        throw new Error(
            "POKER_API_KEY is required in character settings.secrets"
        );
    }

    return new PokerClient({
        apiKey,
        apiBaseUrl: process.env.POKER_API_URL,
    });
}

export * from "./poker-client";
export * from "./game-state";
export * from "./api-connector";
