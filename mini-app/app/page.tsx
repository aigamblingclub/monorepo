'use client';

import { useState, useEffect, useRef } from 'react';
import PokerTableMobile from '@/components/PokerTableMobile';
import { PokerState, ChatMessage } from '@/types/poker';
import { BottomNav, MenuItemLabel } from '@/components/BottomNav';
import { AppDrawer } from '@/components/AppDrawer';
import { toast } from 'sonner';
import SimpleBar from 'simplebar-react';
import 'simplebar-react/dist/simplebar.min.css';
import { cn } from '@/utils/cn';
import { AgentManager } from '@/components/AgentManager';
import { mockAIChatMessages, mockHumanChatMessages } from '@/utils/mocks';
// We won't use getAgentColor anymore, so we can remove the import if it's not used elsewhere.
// import { getAgentColor } from '@/utils/colors';

// Environment check
const isDev = process.env.NODE_ENV === 'development';

// Mock data similar to front project
const mockGameState: PokerState = {
  tableId: "mini-app-table",
  tableStatus: "PLAYING",
  players: [
    {
      id: "player-1",
      playerName: "The Showman",
      status: "PLAYING",
      playedThisPhase: true,
      position: "SB",
      hand: [
        { rank: 13, suit: "hearts" },
        { rank: 12, suit: "hearts" }
      ],
      chips: 950,
      bet: { amount: 50, volume: 50 }
    },
    {
      id: "player-2", 
      playerName: "The Strategist",
      status: "PLAYING",
      playedThisPhase: true,
      position: "BB",
      hand: [
        { rank: 9, suit: "hearts" },
        { rank: 1, suit: "clubs" }
      ],
      chips: 900,
      bet: { amount: 100, volume: 100 }
    },
    {
      id: "player-3",
      playerName: "The Veteran",
      status: "FOLDED",
      playedThisPhase: true,
      position: "EP",
      hand: [],
      chips: 1000,
      bet: { amount: 0, volume: 0 }
    },
    {
      id: "player-4",
      playerName: "The Wildcard",
      status: "PLAYING",
      playedThisPhase: false,
      position: "MP",
      hand: [
        { rank: 10, suit: "spades" },
        { rank: 10, suit: "diamonds" }
      ],
      chips: 850,
      bet: { amount: 150, volume: 150 }
    },
    {
      id: "player-5",
      playerName: "The Grinder",
      status: "ALL_IN",
      playedThisPhase: true,
      position: "CO",
      hand: [
        { rank: 1, suit: "spades" },
        { rank: 13, suit: "clubs" }
      ],
      chips: 0,
      bet: { amount: 800, volume: 800 }
    },
    {
      id: "player-6",
      playerName: "The Trickster",
      status: "PLAYING",
      playedThisPhase: false,
      position: "BTN",
      hand: [
        { rank: 7, suit: "hearts" },
        { rank: 8, suit: "hearts" }
      ],
      chips: 700,
      bet: { amount: 300, volume: 300 }
    }
  ],
  currentPlayerIndex: 5,
  deck: [],
  community: [
    { rank: 11, suit: "clubs" },
    { rank: 12, suit: "clubs" },
    { rank: 13, suit: "clubs" }
  ],
  phase: {
    street: "FLOP",
    actionCount: 4,
    volume: 1400
  },
  round: {
    roundNumber: 1,
    volume: 1400,
    currentBet: 300,
    foldedPlayers: ["player-3"],
    allInPlayers: ["player-5"]
  },
  dealerId: "player-6",
  winner: null,
  lastMove: null,
  lastRoundResult: null,
  config: {
    maxRounds: null,
    startingChips: 1000,
    smallBlind: 25,
    bigBlind: 50
  }
};

const agentColorMap: { [key: string]: { bg: string; text: string } } = {
  "The Showman": { bg: 'bg-rose-500', text: 'text-rose-400' },
  "The Strategist": { bg: 'bg-sky-500', text: 'text-sky-400' },
  "The Grinder": { bg: 'bg-emerald-500', text: 'text-emerald-400' },
  "The Veteran": { bg: 'bg-amber-500', text: 'text-amber-400' },
  "The Wildcard": { bg: 'bg-violet-500', text: 'text-violet-400' },
  "The Trickster": { bg: 'bg-pink-500', text: 'text-pink-400' },
  "You": { bg: 'bg-gray-500', text: 'text-gray-300' },
};

const defaultColors = { bg: 'bg-blue-600', text: 'text-blue-400' };

const getAgentColor = (agentName: string) => {
  return agentColorMap[agentName] || defaultColors;
};

const ChatContent: React.FC<{
  messages: ChatMessage[];
  activeTab: 'ai' | 'human';
  setActiveTab: (tab: 'ai' | 'human') => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}> = ({ messages, activeTab, setActiveTab, setMessages }) => {
  const simpleBarRef = useRef<any>(null);

  const scrollToBottom = () => {
    if (simpleBarRef.current) {
      const scrollElement = simpleBarRef.current.getScrollElement();
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  };

  useEffect(() => {
    if (messages.length) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex p-1 mt-4 bg-gray-900/50">
        <button
          onClick={() => setActiveTab('ai')}
          className={cn(
            'w-1/2 py-2 text-sm font-medium rounded-md',
            activeTab === 'ai'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-700'
          )}
        >
          AI Chat
        </button>
        <button
          onClick={() => setActiveTab('human')}
          className={cn(
            'w-1/2 py-2 text-sm font-medium rounded-md',
            activeTab === 'human'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-700'
          )}
        >
          Human Chat
        </button>
      </div>

      {/* Content */}
      <div className="flex-grow p-4 overflow-y-auto">
        {(activeTab === 'ai' || activeTab === 'human') && (
          <SimpleBar ref={simpleBarRef} className="h-full form-scrollbar">
            <div className="space-y-4 pr-2">
              {messages.map((msg) => {
                const { bg, text } = getAgentColor(msg.playerName);
                
                return (
                  <div key={msg.id} className="flex items-center space-x-3">
                    <div
                      className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm',
                        bg
                      )}
                    >
                      {msg.playerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className={cn('font-bold', text)}>
                          {msg.playerName}
                        </span>
                        <span className="ml-2 text-gray-300">{msg.text}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SimpleBar>
        )}
      </div>

      {/* Input */}
      {activeTab === 'human' && (
        <div className="p-2 border-t border-slate-700">
          <input
            type="text"
            placeholder="Type your message..."
            className="w-full bg-slate-900 text-white p-2 rounded-md border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                // For MVP, we'll just add the message to the state
                const new_message: ChatMessage = {
                  id: Date.now().toString(),
                  text: e.currentTarget.value,
                  timestamp: new Date(),
                  playerName: "You",
                  isAI: false
                };
                setMessages((prev) => [...prev, new_message]);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>
      )}
    </div>
  );
};


export default function Home() {
  const [gameState, setGameState] = useState<PokerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState<MenuItemLabel>('Chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChatTab, setActiveChatTab] = useState<'ai' | 'human'>('ai');

  useEffect(() => {
    // Set initial messages based on active tab
    setMessages(activeChatTab === 'ai' ? mockAIChatMessages : mockHumanChatMessages);
  }, [activeChatTab]);

  useEffect(() => {
    const roleplay = gameState?.lastMove?.move?.decisionContext?.roleplay;
    if (roleplay) {
      const { lastMove } = gameState;
      if (lastMove) {
        const player = gameState.players.find(
          (p) => p.id === lastMove.playerId
        );
        if (player && lastMove.move.decisionContext) {
          const playerName = player.playerName || player.id;
          const new_message: ChatMessage = {
            id: `${player.id}-${Date.now()}`,
            text: lastMove.move.decisionContext.roleplay || '',
            timestamp: new Date(),
            playerName: playerName,
            isAI: false
          };
          setMessages((prev) => [...prev, new_message]);
        }
      }
    }
  }, [gameState?.lastMove]);

  useEffect(() => {
    const getState = async () => {
      try {
        let data;
        if (isDev) {
          // Use mock data in development
          data = mockGameState;
        } else {
          try {
            const response = await fetch('/api/current-state');
            if (!response.ok) {
              throw new Error('Failed to fetch game state');
            }
            data = await response.json();
          } catch (err) {
            data = { error: 'Failed to load game state' };
            console.error("getState error:", err);
            setError('Failed to load game state');
            setLoading(false);
            return;
          }
        }

        // Only update the state if the data is different
        setGameState(prevState => {
          const prevStateStr = JSON.stringify(prevState);
          const newStateStr = JSON.stringify(data);
          if (prevStateStr !== newStateStr && !data.error) {
            if (isDev) {
              console.info("🔄 Updating game state:", data);
            }
            return data;
          }
          return prevState;
        });

        setError(null);
      } catch (err) {
        if (isDev) {
          console.error("getState error:", err);
        }
        setError('Failed to load game state');
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    getState();
    const interval = setInterval(getState, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [isDev]);

  const handleMenuItemClick = (item: MenuItemLabel) => {
    if (isDrawerOpen && activeMenuItem === item) {
      setDrawerOpen(false);
    } else {
      setActiveMenuItem(item);
      setDrawerOpen(true);
    }
  };

  const renderDrawerContent = () => {
    switch (activeMenuItem) {
      case 'Chat':
        return <ChatContent messages={messages} activeTab={activeChatTab} setActiveTab={setActiveChatTab} setMessages={setMessages} />;
      case 'Agents':
        return gameState ? (
          <AgentManager players={[...gameState.players]} />
        ) : (
          <div className="p-4">Loading player data...</div>
        );
      case 'Mint':
      case 'Bet':
      case 'More':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <h3 className="text-lg font-semibold">Coming Soon</h3>
              <p className="text-sm">
                This feature will be available shortly.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="bg-black/50 border-b border-gray-800 p-3 w-full sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">🃏 Poker AI</h1>
          <div className="flex items-center space-x-2">
            
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto p-4 flex flex-col items-center justify-start flex-grow">
        

        {loading ? (
          <div className="flex items-center justify-center flex-grow">
            <div className="text-2xl font-bold mb-4">Loading Game...</div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500  flex-grow flex flex-col justify-center">
            <div className="text-2xl font-bold mb-4">Error</div>
            <p>{error}</p>
          </div>
        ) : gameState ? (
          <>
            <PokerTableMobile gameState={gameState} />
          </>
        ) : (
          <div className="text-center  flex-grow flex flex-col justify-center">
            <div className="text-2xl font-bold mb-4">No Active Game</div>
            <p>Please check back later.</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-full pointer-events-none z-[60]">
        <AppDrawer
          isOpen={isDrawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={activeMenuItem}
        >
          {renderDrawerContent()}
        </AppDrawer>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[100]">
        <BottomNav onMenuItemClick={handleMenuItemClick} />
      </div>
    </main>
  );
} 