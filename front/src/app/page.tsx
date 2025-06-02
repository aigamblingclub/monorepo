'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { PokerTable } from '../components/PokerTable';
import { PokerState } from '../types/poker';
import { WalletProvider } from "@/providers/WalletProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { WalletMenu } from "@/components/WalletMenu";
import { AccountManager } from "@/components/AccountManager";
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
              {/* Terminal-style title container */}
              <div className="relative mb-4">
                {/* Terminal window frame */}
                <div className="border-[var(--border-width)] border-[var(--theme-primary)] bg-[var(--surface-secondary)] rounded-[var(--border-radius-element)] shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)]">
                  {/* Terminal prompt line */}
                  <div className="font-mono text-[var(--theme-primary)] text-sm mb-2 [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)]">
                    <span className="opacity-70">user@agc:~$</span> <span className="opacity-90">cat banner.txt</span>
                  </div>
                  
                  {/* ASCII-style title */}
                  <div className="font-mono text-[var(--theme-primary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)]">
                    <pre className="text-xl leading-tight whitespace-pre">
{`╔═══════════════════════════════════╗
║ AI GAMBLING CLUB          [ALPHA] ║
║ ================          █████   ║
║ PROMPT2WIN  v0.1                  ║
╚═══════════════════════════════════╝`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ width: '30vw' }} className="flex justify-end items-center">
              <WalletMenu />
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
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load game state');
        setLoading(false);
      }
    };

    const interval = setInterval(getState, 1000);
    return () => clearInterval(interval);
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center pt-20 bg-black">
        <div className="bg-black border-2 border-white rounded p-6">
          <div className="text-white font-mono text-lg mb-4">
            Loading game state...
          </div>
          <div className="flex items-center justify-center">
            <div className="animate-pulse w-4 h-4 bg-green-400 rounded mr-2"></div>
            <div className="animate-pulse w-4 h-4 bg-green-400 rounded mr-2" style={{ animationDelay: '0.2s' }}></div>
            <div className="animate-pulse w-4 h-4 bg-green-400 rounded" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center pt-20 bg-black">
        <div className="bg-black border-2 border-red-500 rounded p-6 max-w-md">
          <div className="text-red-400 font-mono text-lg mb-2">
            System Error
          </div>
          <div className="text-white font-mono text-sm border-t border-red-500 pt-3">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center pt-20 bg-black">
        <div className="bg-black border-2 border-white rounded p-6">
          <div className="text-white font-mono text-lg mb-4">
            Waiting for game...
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-green-400 font-mono text-sm">
              {"> Connecting to server"}
            </div>
            <div className="animate-pulse text-green-400">_</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main Content Area - Balanced three-column layout */}
      <div className="flex justify-center px-4">
        <div className="flex items-start max-w-[1400px] w-full">
          {/* Left Side - Move History */}
          <div className="w-80 flex-shrink-0">
            <MoveHistoryPanel gameState={gameState} />
          </div>
          
          {/* Center - Poker Table + Chat (flexible space) */}
          <div className="flex-1 flex flex-col gap-6 px-6 min-w-0">
            <div className="flex justify-center">
              <PokerTable 
                gameState={gameState} 
                playerBets={playerBets.map(bet => ({
                  playerId: bet.playerId,
                  totalBet: bet.totalBet,
                  betAmount: bet.betAmount
                }))} 
              />
            </div>
            <div className="flex justify-center">
              <Chat gameState={gameState} />
            </div>
          </div>

          {/* Right Side - Account Manager */}
          <div className="w-80 flex-shrink-0">
            <AccountManager
              players={
                gameState?.players?.length > 0 ? [...gameState.players] : []
              }
              playerBets={playerBets}
              onPlaceBet={placeBet}
              tableStatus={gameState?.tableStatus}
            />
            {bettingError && (
              <div className="mt-4 p-2 border border-red-500 bg-black">
                <p className="text-red-400 font-mono text-sm">
                  {bettingError}
                </p>
              </div>
            )}
            {bettingLoading && (
              <div className="mt-4 text-center">
                <p className="text-gray-400 font-mono text-sm">
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
    "tableStatus": "GAME_OVER",
    "players": [
      {
        "id": "472a3913-2ead-05b5-9ee2-1693304f5862",
        "playerName": "The Showman",
        "status": "PLAYING",
        "playedThisPhase": false,
        "position": "SB",
        "hand": [
          {
            "rank": 1,
            "suit": "hearts"
          },
          {
            "rank": 13,
            "suit": "diamonds"
          }
        ],
        "chips": 1000,
        "bet": {
          "amount": 50,
          "volume": 0
        }
      },
      {
        "id": "058cf225-7d2c-075f-8bf6-b7cad54aa4b7",
        "playerName": "The Strategist",
        "status": "PLAYING",
        "playedThisPhase": false,
        "position": "BB",
        "hand": [
          {
            "rank": 5,
            "suit": "spades"
          },
          {
            "rank": 10,
            "suit": "clubs"
          }
        ],
        "chips": 1000,
        "bet": {
          "amount": 0,
          "volume": 0
        }
      }
    ],
    "lastMove": null,
    "currentPlayerIndex": 0,
    "deck": [],
    "community": [
      {
        "rank": 11,
        "suit": "clubs"
      },
      {
        "rank": 12,
        "suit": "clubs"
      },
      {
        "rank": 13,
        "suit": "clubs"
      },
      {
        "rank": 1,
        "suit": "diamonds"
      },
      {
        "rank": 1,
        "suit": "spades"
      }
    ],
    "phase": {
      "street": "SHOWDOWN",
      "actionCount": 0,
      "volume": 0
    },
    "round": {
      "roundNumber": 1,
      "volume": 0,
      "currentBet": 50,
      "foldedPlayers": [],
      "allInPlayers": []
    },
    "dealerId": "",
    "winner": "The Showman",
    "config": {
      "maxRounds": null,
      "startingChips": 1000,
      "smallBlind": 10,
      "bigBlind": 20
    }
  },
]