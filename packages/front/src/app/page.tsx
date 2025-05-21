'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { PokerTable } from '../components/PokerTable';
import { PokerState } from '../types/poker';
import { WalletProvider } from "@/providers/WalletProvider";
import { WalletButton } from "@/components/WalletButton";
import { CONTRACT_ID } from "@/utils/constants";
import { BettingPanel } from "@/components/BettingPanel";
import { usePlayerBetting } from "@/hooks/usePlayerBetting";
import { Chat } from "@/components/Chat";
import { MoveHistoryPanel } from "@/components/MoveHistoryPanel";

function PageLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <div className="bg-black">
        <header className="w-full flex justify-between items-start">
          <div style={{ width: '150px' }}></div>
          <div className="flex flex-col justify-center items-center">
            <h1 className="title">AI Gambling Club</h1>
            <h2 className="subtitle">Poker Texas Hold&apos;em</h2>
          </div>
          <WalletButton />
        </header>
        {children}
      </div>
    </WalletProvider>
  );
}

export default function Home() {
  const [gameState, setGameState] = useState<PokerState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Use the betting hook at the page level
  const {
    playerBets,
    userBalance,
    loading: bettingLoading,
    error: bettingError,
    placeBet,
    isConnected
  } = usePlayerBetting({
    contractId: CONTRACT_ID
  });

  useEffect(() => {
    const getState = async () => {
      try {
        const state = await fetch('/api/current-state');
        const data = await state.json();
        
        // Only update the state if the data is different
        if (JSON.stringify(data) !== JSON.stringify(gameState) && !data?.error) {
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
  }, [gameState]);

  if (loading) {
    return (
      <PageLayout>
        <div className="text-neon-green text-2xl">Loading game state...</div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <div className="text-neon-red text-2xl">Error: {error}</div>
      </PageLayout>
    );
  }

  if (!gameState) {
    return (
      <PageLayout>
        <div className="text-neon-yellow text-2xl flex justify-center items-center" style={{ marginTop: '200px' }}>
          Waiting for game...
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="h-full flex flex-col">
        <div className="flex-grow flex flex-row">
          <div className="w-[300px] p-4">
            <MoveHistoryPanel gameState={gameState} />
          </div>
          <div className="flex-grow">
            <PokerTable gameState={gameState} playerBets={playerBets} />
          </div>
          <div className="w-[300px] p-4">
            <BettingPanel
              players={gameState?.players?.length > 0 ? [...gameState.players] : []}
              playerBets={playerBets}
              onPlaceBet={placeBet}
              userBalance={userBalance}
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
        <div className="h-64 mt-4 px-4 pb-4">
          <Chat gameState={gameState} />
        </div>
      </div>
    </PageLayout>
  );
}
