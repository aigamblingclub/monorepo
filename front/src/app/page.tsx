'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { PokerTable } from '../components/PokerTable';
import { PokerState } from '../types/poker';
import { WalletProvider } from "@/providers/WalletProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { WalletButton } from "@/components/WalletButton";
import { BettingPanel } from "@/components/BettingPanel";
import { usePlayerBetting } from "@/hooks/usePlayerBetting";
import { Chat } from "@/components/Chat";
import { MoveHistoryPanel } from "@/components/MoveHistoryPanel";
import { isDev } from '@/utils/env';

function PageLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <AuthProvider>
        <div className="bg-black">
          <header className="w-full flex justify-between items-start px-4 pt-2">
            <div style={{ width: '30vw' }}></div>
            <div className="flex flex-col justify-center items-center">
              <h1 className="text-[var(--theme-primary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)] text-4xl font-bold my-1 block">AI Gambling Club</h1>
              <h2 className="text-[var(--theme-highlight)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-highlight)] text-xl mb-8 block">Poker Texas Hold&apos;em</h2>
            </div>
            <div style={{ width: '30vw' }} className="flex justify-end items-center">
              <WalletButton />
            </div>
          </header>
          {children}
        </div>
      </AuthProvider>
    </WalletProvider>
  );
}

function HomeContent() {
  const [gameState, setGameState] = useState<PokerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Use the betting hook at the page level
  const {
    playerBets,
    userBalance,
    usdcBalance,
    loading: bettingLoading,
    error: bettingError,
    placeBet,
    isConnected
  } = usePlayerBetting();

  useEffect(() => {
    const getState = async () => {
      try {
        let data;
        if(isDev) {
          data = fakeData[0];
        } else {
          const state = await fetch('/api/current-state');
          data = await state.json();
        }
        
        // Only update the state if the data is different
        if (JSON.stringify(data) !== JSON.stringify(gameState)) {
          setGameState(data);
          console.log("🔍 Game state:", data);
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load game state');
        setLoading(false);
        console.error(err);
      }
    };

    const interval = setInterval(getState, 1000);
    return () => clearInterval(interval);
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="text-neon-green text-2xl">Loading game state...</div>
    );
  }

  if (error) {
    return (
      <div className="text-neon-red text-2xl">Error: {error}</div>
    );
  }

  if (!gameState) {
    return (
      <div className="text-neon-yellow text-2xl flex justify-center items-center" style={{ marginTop: '200px' }}>
        Waiting for game...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col lg:flex-row">
        {/* History Panel - Moves to bottom on mobile */}
        <div className="w-full lg:w-[400px] px-4 order-3 lg:order-1">
          <MoveHistoryPanel gameState={gameState} />
        </div>
        
        {/* Main Game Area - Stays in middle */}
        <div className="flex flex-col w-full order-2">
          <PokerTable 
            gameState={gameState} 
            playerBets={playerBets.map(bet => ({
              playerId: bet.playerId,
              totalBet: bet.totalBet,
              betAmount: bet.betAmount
            }))} 
          />
          <div className="w-full max-h-64 mt-4 px-4 pb-4">
            <Chat gameState={gameState} />
          </div>
        </div>

        {/* Betting Panel - Moves to top on mobile */}
        <div className="w-full lg:w-[400px] px-4 order-1 lg:order-3">
          <div className="">
            <BettingPanel
              players={
                gameState?.players?.length > 0 ? [...gameState.players] : []
              }
              playerBets={playerBets}
              onPlaceBet={placeBet}
              userBalance={userBalance}
              usdcBalance={usdcBalance}
              isLoggedIn={isConnected}
            />
            {bettingError && (
              <div className="mt-4 p-2 border border-theme-alert rounded-border-radius-element bg-surface-secondary">
                <p className="text-theme-alert text-shadow-red text-sm">
                  {bettingError}
                </p>
              </div>
            )}
            {bettingLoading && (
              <div className="mt-4 text-center">
                <p className="text-theme-secondary text-shadow-cyan text-sm">
                  Loading...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <PageLayout>
      <HomeContent />
    </PageLayout>
  );
}

const fakeData: PokerState[] = [
  {
    "tableId": "1",
    "tableStatus": "WAITING",
    "players": [
      {
        "id": "472a3913-2ead-05b5-9ee2-1693304f5862",
        "playerName": "The Showman",
        "status": "PLAYING",
        "playedThisPhase": false,
        "position": "SB",
        "hand": [],
        "chips": 1000,
        "bet": {
          "amount": 0,
          "volume": 0
        }
      },
      {
        "id": "058cf225-7d2c-075f-8bf6-b7cad54aa4b7",
        "playerName": "The Strategist",
        "status": "PLAYING",
        "playedThisPhase": false,
        "position": "BB",
        "hand": [],
        "chips": 800,
        "bet": {
          "amount": 0,
          "volume": 0
        }
      }
    ],
    "lastMove": null,
    "currentPlayerIndex": -1,
    "deck": [],
    "community": [],
    "phase": {
      "street": "PRE_FLOP",
      "actionCount": 0,
      "volume": 0
    },
    "round": {
      "roundNumber": 1,
      "volume": 0,
      "currentBet": 0,
      "foldedPlayers": [],
      "allInPlayers": []
    },
    "dealerId": "",
    "winner": null,
    "config": {
      "maxRounds": null,
      "startingChips": 1000,
      "smallBlind": 10,
      "bigBlind": 20
    }
  },
]