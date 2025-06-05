import React, { useEffect, useState, useRef } from 'react';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { PokerState, PlayerState } from '@/types/poker';
import { isDev } from '@/utils/env';

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
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      const scrollElement = containerRef.current.querySelector('.simplebar-content-wrapper');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  useEffect(() => {
    if (isDev) {
      setMessages(fakeData);
      // Scroll to bottom after setting fake data
      setTimeout(scrollToBottom, 100);
    }
  }, [gameState]);

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

      setMessages(prevMessages => [...prevMessages, roleplayMessage]);
      // Scroll to bottom after adding new message
      setTimeout(scrollToBottom, 100);
    }
  }, [gameState]);

  return (
    <div className='w-[50vw] max-w-[800px] h-full max-h-[40vh] border-2 border-white bg-black'>
      {/* Chat header */}
      <div className='p-2 border-b border-white'>
        <h3 className='text-white font-mono font-bold text-lg'>
          AI Agent Thoughts
        </h3>
      </div>

      {/* Thoughts container */}
      <div ref={containerRef}>
        <SimpleBar
          autoHide={false}
          className='ai-thoughts-scrollbar h-[200px] overflow-y-auto'
        >
          <div className='p-4 space-y-2'>
            {messages.map((thought: ChatMessage) => (
              <div key={thought.id} className='flex items-baseline space-x-2'>
                <span className='text-green-400 font-mono font-bold text-sm'>
                  {thought.playerName}:
                </span>
                <span className='text-white font-mono text-sm'>{thought.text}</span>
              </div>
            ))}
            {messages.length === 0 && (
              <div className='text-gray-400 font-mono text-center text-sm'>
                Waiting for AI agent&apos;s thoughts...
              </div>
            )}
          </div>
        </SimpleBar>
      </div>
    </div>
  );
};

const fakeData = [
  {
      id: '1',
      text: 'Hello, how are you?',
      timestamp: new Date(),
      playerName: 'John Doe',
    },
    {
      id: '2',
      text: 'I am fine, thank you!',
      timestamp: new Date(),
      playerName: 'Jane Doe',
    },
    {
      id: '3',
      text: 'I am fine, thank you!',
      timestamp: new Date(),
      playerName: 'Jane Doe',
    },
    {
      id: '4',
      text: 'I am fine, thank you!',
      timestamp: new Date(),
      playerName: 'Jane Doe',
    },
    {
      id: '5',
      text: 'I am fine, thank you!',
      timestamp: new Date(),
      playerName: 'Jane Doe',
    },
    {
      id: '6',
      text: 'I am fine, thank you!',
      timestamp: new Date(),
      playerName: 'Jane Doe',
    },
    {
      id: '7',
      text: 'I am fine, thank you!',
      timestamp: new Date(),
      playerName: 'Jane Doe',
    },
    
    
    
];