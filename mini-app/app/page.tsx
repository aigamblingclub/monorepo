'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import PokerTableMobile from '@/components/PokerTableMobile';
import FarcasterAuth from '@/components/FarcasterAuth';
import FarcasterWallet from '@/components/FarcasterWallet';
import FarcasterNotifications from '@/components/FarcasterNotifications';
import { PokerState } from '@/types/poker';
import { useRouter } from 'next/navigation';

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
  config: {
    maxRounds: null,
    startingChips: 1000,
    smallBlind: 25,
    bigBlind: 50
  }
};

export default function Home() {
  const [gameState, setGameState] = useState<PokerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const [walletInfo, setWalletInfo] = useState<any>(null);

  // Initialize Farcaster Mini App
  useEffect(() => {
    const initializeMiniApp = async () => {
      try {
        // Check if we're in Farcaster
        const context = await sdk.context;
        setIsInFarcaster(!!context);
        
        if (context) {
          console.log('✅ Running in Farcaster Mini App');
          console.log('Context:', context);
          
          // Auto-authenticate when inside Farcaster
          const autoAuthUser = {
            isAuthenticated: true,
            fid: context.user?.fid,
            username: context.user?.username || 'Farcaster User',
            displayName: context.user?.displayName,
          };
          setFarcasterUser(autoAuthUser);
          
          // Signal that the app is ready to display
          await sdk.actions.ready();
          console.log('🎮 App is ready to display');
        } else {
          console.log('🌐 Running in regular browser');
        }
        
      } catch (error) {
        console.error('Failed to initialize Mini App:', error);
        // Continue anyway for non-Farcaster environments
      }
    };

    initializeMiniApp();
  }, []);

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
        setLoading(false);
      } catch (err) {
        if (isDev) {
          console.error("getState error:", err);
        }
        setError('Failed to load game state');
        setLoading(false);
      }
    };

    // HTTP polling every 1 second (same as front project)
    const interval = setInterval(getState, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-black border-2 border-green-400 rounded-lg p-8">
          <div className="text-green-400 font-mono text-xl mb-4 text-center">
            {isInFarcaster ? '🚀 Loading Mini App...' : 'Loading Game...'}
          </div>
          <div className="flex items-center justify-center">
            <div className="animate-pulse w-4 h-4 bg-green-400 rounded-full mr-2"></div>
            <div 
              className="animate-pulse w-4 h-4 bg-green-400 rounded-full mr-2"
              style={{ animationDelay: '0.2s' }}
            ></div>
            <div 
              className="animate-pulse w-4 h-4 bg-green-400 rounded-full"
              style={{ animationDelay: '0.4s' }}
            ></div>
          </div>
          {isInFarcaster && (
            <div className="text-green-300 text-sm mt-4 text-center">
              Connected to Farcaster
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-red-900/50 border-2 border-red-400 rounded-lg p-8 max-w-md w-full">
          <div className="text-red-100 font-mono text-xl mb-4 text-center">
            ⚠️ Error
          </div>
          <p className="text-red-200 text-center mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-yellow-900/50 border-2 border-yellow-400 rounded-lg p-8 max-w-md w-full">
          <div className="text-yellow-100 font-mono text-xl mb-4 text-center">
            🎲 No Game Active
          </div>
          <p className="text-yellow-200 text-center">
            No poker game is currently active. Check back later!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Compact Header */}
      <header className="bg-black/50 border-b border-gray-800 p-2 mb-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            🃏 AI Poker Club
          </h1>
          
          {/* Auth Controls */}
          <div className="flex items-center space-x-2">
            {/* Show Connect Farcaster button ONLY when in browser (not in Farcaster app) */}
            {!isInFarcaster && !farcasterUser?.isAuthenticated && (
              <button
                onClick={() => {
                  const authComponent = document.getElementById('farcaster-auth');
                  authComponent?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
              >
                🔗 Connect Farcaster
              </button>
            )}
            
            {/* Show Connect Wallet button when Farcaster is connected but wallet is not */}
            {farcasterUser?.isAuthenticated && !walletInfo?.isConnected && (
              <button
                onClick={() => {
                  const walletComponent = document.getElementById('wallet-connect');
                  walletComponent?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
              >
                💳 Connect Wallet
              </button>
            )}

            {/* Show wallet info and notifications when both are connected */}
            {farcasterUser?.isAuthenticated && walletInfo?.isConnected && (
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1 bg-green-900/30 border border-green-400 rounded text-sm">
                  <span className="text-green-200">
                    {walletInfo.address && `${walletInfo.address.slice(0, 4)}...${walletInfo.address.slice(-4)}`}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const notifComponent = document.getElementById('notifications');
                    notifComponent?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  🔔
                </button>
              </div>
            )}
            
            {/* Status indicator for Farcaster users without wallet */}
            {isInFarcaster && farcasterUser?.isAuthenticated && !walletInfo?.isConnected && (
              <div className="px-2 py-1 bg-purple-900/30 border border-purple-400 rounded text-xs">
                <span className="text-purple-200">
                  {farcasterUser.username || 'Farcaster User'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {/* Game Table */}
        <div className="mb-6">
          <PokerTableMobile gameState={gameState} />
        </div>

        {/* Auth Components (Hidden by Default) */}
        <div className="max-w-md mx-auto space-y-3 hidden">
          <div id="farcaster-auth">
            <FarcasterAuth onUserChange={(user) => setFarcasterUser(user)} />
          </div>
          
          <div id="wallet-connect">
            <FarcasterWallet onWalletChange={(wallet) => setWalletInfo(wallet)} />
          </div>
          
          <div id="notifications">
            <FarcasterNotifications 
              gameState={gameState}
              isAuthenticated={!!farcasterUser?.isAuthenticated} 
            />
          </div>
        </div>

        {/* Mini App Footer */}
        <div className="text-center text-gray-400 text-xs mt-6">
          <p>Powered by Farcaster Mini Apps</p>
          {isDev && (
            <p className="mt-1 text-yellow-400">Development Mode</p>
          )}
        </div>
      </main>
    </div>
  );
} 