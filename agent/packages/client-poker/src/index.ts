import { PokerClient } from "./poker-client";
import { elizaLogger } from "@elizaos/core";

export function createPokerClient(runtime: any, characterName: string) {
    // const apiKey = runtime.character.settings?.secrets?.POKER_API_KEY;
    // if (!apiKey) {
    //     elizaLogger.error("API key not found in character configuration");
    //     throw new Error(
    //         "POKER_API_KEY is required in character settings.secrets"
    //     );
    // }

    // Get inactivity timeout from environment or use default
    const inactivityTimeoutMs = process.env.POKER_INACTIVITY_TIMEOUT_MS
        ? parseInt(process.env.POKER_INACTIVITY_TIMEOUT_MS)
        : 300000; // Default 5 minutes

    // Get max inactivity resets from environment or use default
    const maxInactivityResets = process.env.POKER_MAX_INACTIVITY_RESETS
        ? parseInt(process.env.POKER_MAX_INACTIVITY_RESETS)
        : 3; // Default 3 resets

    return new PokerClient({
        apiKey: "", // TODO: add api key logic, do it on backend
        apiBaseUrl: process.env.POKER_API_URL,
        playerName: characterName,
        inactivityTimeoutMs,
        maxInactivityResets,
    });
}
