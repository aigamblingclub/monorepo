import React, { useEffect, useState } from 'react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { PokerState, PlayerState } from '@/types/poker';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: Date;
  playerName: string;
}

interface ChatProps {
  gameState?: PokerState;
}
  
export const Chat: React.FC<ChatProps> = ({ gameState }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const roleplay = gameState?.lastMove?.move?.decisionContext?.roleplay;
    const player = gameState?.players?.find(
      (p: PlayerState) => p.id === gameState?.lastMove?.playerId
    );
    if (roleplay && player) {
      const playerName = player?.playerName || player?.id;

      const roleplayMessage: ChatMessage = {
        id: `${player?.id}-${Date.now()}`,
        text: roleplay,
        timestamp: new Date(),
        playerName: playerName,
      };

      setMessages((prevMessages) => [roleplayMessage, ...prevMessages]);
    }
  }, [gameState]);

  return (
    <div className="h-full max-h-[20vh] w-full max-w-[800px] mx-auto border border-theme-primary rounded-border-radius-element bg-surface-primary">
      {/* Chat header */}
      <div className="p-2 border-b border-theme-primary">
        <h3 className="text-theme-primary text-shadow-cyan text-lg font-bold">AI Agent Thoughts</h3>
      </div>

      {/* Thoughts container */}
      <SimpleBar 
        autoHide={false}
        className="ai-thoughts-scrollbar h-[150px] overflow-y-auto"
      >
        <div className="p-4 space-y-2">
          {messages.map((thought: ChatMessage) => (
            <div key={thought.id} className="flex items-baseline space-x-2">
              <span className="text-theme-primary text-shadow-cyan font-bold min-w-[100px]">
                {thought.playerName}:
              </span>
              <span className="text-theme-secondary text-shadow-cyan">
                {thought.text}
              </span>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-theme-secondary text-shadow-cyan text-center">
              Waiting for AI agent&apos;s thoughts...
            </div>
          )}
        </div>
      </SimpleBar>
    </div>
  );
}; 