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

    // Get room ID from character settings or environment variable
    const roomId = runtime.character.settings?.pokerRoom || 
                   process.env.POKER_ROOM_ID || 
                   "default";

    elizaLogger.info(`Creating poker client for ${characterName} in room: ${roomId}`);

    return new PokerClient({
        apiKey: "", // TODO: add api key logic, do it on backend
        apiBaseUrl: process.env.POKER_API_URL,
        playerName: characterName,
        roomId: roomId,
    });
}
