'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { PokerTable } from '../components/PokerTable';
import { PokerState } from '../types/poker';
import { WalletProvider } from "@/providers/WalletProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { WalletButton } from "@/components/WalletButton";
import { BettingPanel } from "@/components/BettingPanel";
import { usePlayerBetting } from "@/hooks/usePlayerBetting";
import { Chat } from "@/components/Chat";
import { MoveHistoryPanel } from "@/components/MoveHistoryPanel";

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
  const { apiKey } = useAuth();

  console.log("🔍 NEXT_PUBLIC_CONTRACT_ID:", process.env.NEXT_PUBLIC_CONTRACT_ID);

  // Use the betting hook at the page level
  const {
    playerBets,
    userBalance,
    loading: bettingLoading,
    error: bettingError,
    placeBet,
    isConnected
  } = usePlayerBetting();

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
    // getState()

    // const getBalance = async () => {
    //   console.log("🔍 apiKey:", apiKey);
    //   if (!apiKey) {
    //     return;
    //   }
    //   const balance = await fetch('/api/balance', {
    //     headers: {
    //       "x-api-key": apiKey || "",
    //     },
    //   });
    //   const data = await balance.json();
    //   console.log("🔍 Balance:", data);
    // }
    // getBalance();
    // setLoading(false);
    // setGameState({
    //     "tableId": "1",
    //     "tableStatus": "PLAYING",
    //     "players": [
    //         {
    //             "id": "472a3913-2ead-05b5-9ee2-1693304f5862",
    //             "playerName": "The Showman",
    //             "status": "PLAYING",
    //             "playedThisPhase": true,
    //             "position": "SB",
    //             "hand": [
    //                 {
    //                     "rank": 13,
    //                     "suit": "hearts"
    //                 },
    //                 {
    //                     "rank": 12,
    //                     "suit": "hearts"
    //                 }
    //             ],
    //             "chips": 1050,
    //             "bet": {
    //                 "round": 10,
    //                 "total": 10
    //             }
    //         },
    //         {
    //             "id": "058cf225-7d2c-075f-8bf6-b7cad54aa4b7",
    //             "playerName": "The Strategist",
    //             "status": "PLAYING",
    //             "playedThisPhase": false,
    //             "position": "BB",
    //             "hand": [
    //                 {
    //                     "rank": 11,
    //                     "suit": "hearts"
    //                 },
    //                 {
    //                     "rank": 10,
    //                     "suit": "hearts"
    //                 }
    //             ],
    //             "chips": 920,
    //             "bet": {
    //                 "round": 20,
    //                 "total": 20
    //             }
    //         }
    //     ],
    //     "lastMove": null,
    //     "currentPlayerIndex": 0,
    //     "deck": [
    //         {
    //             "rank": 9,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 12,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 5,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 10,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 13,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 5,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 1,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 2,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 3,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 12,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 5,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 4,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 11,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 5,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 6,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 2,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 4,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 8,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 7,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 10,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 7,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 9,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 2,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 4,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 12,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 9,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 8,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 11,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 3,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 10,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 4,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 8,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 7,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 1,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 13,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 13,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 6,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 2,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 11,
    //             "suit": "diamonds"
    //         },
    //         {
    //             "rank": 7,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 9,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 3,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 3,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 1,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 6,
    //             "suit": "hearts"
    //         },
    //         {
    //             "rank": 6,
    //             "suit": "spades"
    //         },
    //         {
    //             "rank": 1,
    //             "suit": "clubs"
    //         },
    //         {
    //             "rank": 8,
    //             "suit": "hearts"
    //         }
    //     ],
    //     "community": [],
    //     "pot": 30,
    //     "round": {
    //         "phase": "PRE_FLOP",
    //         "roundNumber": 4,
    //         "roundPot": 0,
    //         "currentBet": 20,
    //         "foldedPlayers": [],
    //         "allInPlayers": []
    //     },
    //     "dealerId": "472a3913-2ead-05b5-9ee2-1693304f5862",
    //     "winner": null,
    //     "config": {
    //         "maxRounds": null,
    //         "startingChips": 1000,
    //         "smallBlind": 10,
    //         "bigBlind": 20
    //     }
    // })
    const interval = setInterval(getState, 1000);
    return () => clearInterval(interval);
  }, [apiKey]);

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
