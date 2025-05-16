'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { PokerTable } from '../components/PokerTable';
import { PokerState } from '../types/poker';
import { WalletProvider } from "@/providers/WalletProvider";
import { WalletButton } from "@/components/WalletButton";

function PageLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <div className=" bg-black ">
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

  useEffect(() => {
    const getState = async () => {
      try {
        const state = await fetch('/api/current-state');
        const data = await state.json();
        setGameState(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load game state');
        setLoading(false);
        console.error(err);
      }
    };

    setInterval(getState, 1000);
  }, []);

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
        <div className="text-neon-yellow text-2xl">No game state available</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PokerTable gameState={gameState} />
    </PageLayout>
  );
}
