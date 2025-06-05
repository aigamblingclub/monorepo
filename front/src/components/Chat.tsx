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
  const [messageCounter, setMessageCounter] = useState(0);
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
        id: `${player?.id}-${Date.now()}-${messageCounter}`,
        text: roleplay,
        timestamp: new Date(),
        playerName: playerName,
      };

      setMessages(prevMessages => [...prevMessages, roleplayMessage]);
      // Scroll to bottom after adding new message
      setTimeout(scrollToBottom, 100);
      setMessageCounter(prev => prev + 1);
    }
  }, [gameState]); // eslint-disable-line react-hooks/exhaustive-deps

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
    text: 'I think I should raise here, the pot odds are favorable.',
    timestamp: new Date(),
    playerName: 'AI Player 1',
  },
  {
    id: '2',
    text: 'With these cards, a fold might be the best option.',
    timestamp: new Date(),
    playerName: 'AI Player 2',
  },
  {
    id: '3',
    text: 'The opponent seems to be bluffing based on their betting pattern.',
    timestamp: new Date(),
    playerName: 'AI Player 3',
  },
  {
    id: '4',
    text: 'All-in! My hand is strong enough to take this risk.',
    timestamp: new Date(),
    playerName: 'AI Player 4',
  },
];