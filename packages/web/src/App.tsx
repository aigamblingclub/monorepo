import React, { useState, useRef, useEffect } from 'react';
import Chat from './components/Chat';
import PokerCanvas from './components/PokerCanvas';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const DEFAULT_MESSAGES: Message[] = [
  {
    id: '0',
    sender: 'assistant',
    text: "Welcome to the Poker Agent Demo! I can help you spawn AI agents to play poker. What room would you like to start a game in?",
    timestamp: new Date(),
  }
]

function App() {
  const [messages, setMessages] = useState<Message[]>(DEFAULT_MESSAGES);
  const [chatWidth, setChatWidth] = useState(33); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string>('demo-room-1');
  const [isSpawningAgents, setIsSpawningAgents] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Check if user wants to change room
    const roomMatch = text.toLowerCase().match(/room[:\s]+([a-zA-Z0-9-_]+)/);
    if (roomMatch) {
      const newRoom = roomMatch[1];
      setCurrentRoom(newRoom);
      
      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: `Switched to room "${newRoom}". You can now start a poker game by typing "start game" or "spawn agents".`,
          sender: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      }, 500);
      return;
    }
    
    // Check if user wants to start a game
    const gameKeywords = ['start game', 'spawn agents', 'play poker', 'begin game', 'start'];
    const isGameCommand = gameKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isGameCommand && !isSpawningAgents) {
      setIsSpawningAgents(true);
      
      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: `Starting a poker game in room "${currentRoom}"! Spawning AI agents now...`,
          sender: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
      }, 500);
      
      // Trigger agent spawning via the poker canvas
      // This will be handled by the PokerCanvas component's spawn function
      return;
    }
    
    // Default responses
    const responses = [
      `I understand you want to "${text}". Try typing "start game" to begin a poker match, or "room: [room-name]" to switch rooms.`,
      "To play poker, just say 'start game' and I'll spawn AI agents for you!",
      `Current room is "${currentRoom}". Say "start game" to begin, or "room: [name]" to change rooms.`,
      "Ready to play poker? Type 'start game' and I'll get the AI agents running!",
    ];
    
    setTimeout(() => {
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: randomResponse,
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  const handleAgentsSpawned = (agents: any[]) => {
    setIsSpawningAgents(false);
    
    setTimeout(() => {
      const botMessage: Message = {
        id: Date.now().toString(),
        text: `Great! I've spawned ${agents.length} AI agents: ${agents.map(a => a.name).join(' and ')}. They're now playing poker in room "${currentRoom}". Watch the table to see them play!`,
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }, 1000);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const newWidth = (e.clientX / containerWidth) * 100;
      
      // Limit between 20% and 60%
      if (newWidth >= 20 && newWidth <= 60) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        display: 'flex', 
        height: '100vh', 
        width: '100vw',
        margin: 0,
        padding: 0,
        userSelect: isResizing ? 'none' : 'auto'
      }}
    >
      <div style={{ 
        width: `${chatWidth}vw`, 
        height: '100vh',
        background: 'white',
        position: 'relative'
      }}>
        <Chat 
          messages={messages} 
          onSendMessage={handleSendMessage}
          isSpawningAgents={isSpawningAgents}
          currentRoom={currentRoom}
        />
      </div>
      
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '4px',
          height: '100vh',
          background: isResizing ? '#007aff' : '#e0e0e0',
          cursor: 'col-resize',
          transition: 'background 0.2s',
          position: 'relative',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#007aff';
        }}
        onMouseLeave={(e) => {
          if (!isResizing) {
            e.currentTarget.style.background = '#e0e0e0';
          }
        }}
      />
      
      <div style={{ 
        flex: 1,
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <PokerCanvas 
          roomId={currentRoom}
          onAgentsSpawned={handleAgentsSpawned}
          shouldStartGame={isSpawningAgents}
        />
      </div>
    </div>
  );
}

export default App;