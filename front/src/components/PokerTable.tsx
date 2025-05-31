import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Player } from './Player';
import { PlayerState, PokerState, formatChips, getPhaseLabel, Card as CardType } from '../types/poker';
import { PlayerBet } from './BettingPanel';

interface PokerTableProps {
  gameState: PokerState;
  playerBets: PlayerBet[];
}

const getPlayerPosition = (index: number, totalPlayers: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 => {
  if (totalPlayers === 2) {
    return index === 0 ? 7 : 8;
  }
  return ((index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
};

export const PokerTable: React.FC<PokerTableProps> = ({ 
  gameState,
  playerBets
}) => {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timer, setTimer] = useState(120); // 2 minutos em segundos
  const [showProgressBar, setShowProgressBar] = useState(false);

  useEffect(() => {
    if (gameState?.players?.length > 1) {
      setReady(true);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState.tableStatus === "GAME_OVER") {
      setShowProgressBar(true);
      setTimer(120);
      setProgress(0);
    } else {
      setTimer(2);
      setProgress(99);
      // setShowProgressBar(false);
    }
  }, [gameState.tableStatus]);

  useEffect(() => {
    if (!showProgressBar) return;

    if (timer === 0) {
      setShowProgressBar(false);
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
      setProgress((prev) => prev + (100 / 120));
    }, 1000);

    return () => clearInterval(interval);
  }, [showProgressBar, timer]);

  return (
    <div className="h-full bg-black flex flex-row">
      {/* Main poker table */}
      <div className="flex-grow flex justify-center items-start">
        <div className="relative w-[60vw] h-[60vh] max-w-[1000px] max-h-[600px] flex justify-center items-start">
          <div className="w-[90%] h-[90%] bg-[var(--surface-primary)] border border-[var(--border-width)] border-[var(--theme-primary)] shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)] rounded-[var(--border-radius-table)] relative overflow-hidden flex justify-center items-center">
            {/* Players */}
            {gameState?.players?.map((player: PlayerState, index: number) => {
              const playerBet = playerBets.find(
                (bet: PlayerBet) => bet.playerId === player.id
              ) || {
                playerId: player.id,
                totalBet: 0,
                betAmount: 0,
              };

              return (
                <Player
                  key={player.id}
                  tablePosition={getPlayerPosition(
                    index,
                    gameState.players.length
                  )}
                  {...player}
                  isCurrentPlayer={index === gameState?.currentPlayerIndex}
                  totalContractBet={playerBet.totalBet}
                  userContractBet={playerBet.betAmount}
                />
              );
            })}

            {/* Center area */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-[300px]">
              {/* Game status */}
              <div className="text-base text-[var(--theme-accent)] [text-shadow:0_0_5px_var(--theme-accent),0_0_10px_var(--theme-accent)] mb-2.5 border-2 border-[var(--theme-accent)] p-1.5 rounded-none bg-black/50">
                {gameState.tableStatus === "PLAYING" &&
                  !ready &&
                  "Waiting for players..."}
                {gameState.tableStatus === "ROUND_OVER" &&
                  gameState.winner &&
                  `Winner: ${gameState.winner}`}
                {gameState.tableStatus === "GAME_OVER" &&
                  gameState.winner &&
                  `Game Over - Winner: ${gameState.winner}`}

                {gameState.tableStatus === "PLAYING" && (
                  <>
                    <div>Phase: {getPhaseLabel(gameState.phase.street)}</div>
                    <div>Round: {gameState.round.roundNumber}</div>
                  </>
                )}
              </div>
              {showProgressBar && (
                <div className="progress-bar-container">
                  <div className="progress-bar-outer">
                    <div
                      className="progress-bar-inner"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="progress-bar-label">
                    [ Loading next game... {timer}s ]
                  </div>
                </div>
              )}
              {ready && !showProgressBar && (
                <>
                  {/* Pot and current bet */}
                  <div className="text-base text-[var(--theme-highlight)] [text-shadow:0_0_5px_var(--theme-highlight)] mb-4 border border-[var(--theme-highlight)] p-2 rounded-md bg-black/50">
                    <div>POT: ${formatChips(gameState.round.volume)}</div>
                    {gameState.round?.currentBet > 0 && (
                      <div className="current-bet">
                        Current Bet: ${formatChips(gameState.round.currentBet)}
                      </div>
                    )}
                  </div>
                  {/* Community cards */}
                  <div className="flex justify-center gap-1.5">
                    {gameState?.community?.map((card: CardType, index: number) => (
                      <Card
                        key={`${card.rank}-${card.suit}-${index}`}
                        card={card}
                      />
                    ))}
                    {/* Empty cards to complete 5 */}
                    {Array.from({
                      length: Math.max(0, 5 - gameState?.community?.length),
                    }).map((_, index) => (
                      <Card key={`empty-${index}`} card={null} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 