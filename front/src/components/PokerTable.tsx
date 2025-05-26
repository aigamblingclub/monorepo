import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Player } from './Player';
import { PlayerState, PokerState, formatChips, getPhaseLabel, Card as CardType } from '../types/poker';

interface PokerTableProps {
  gameState: PokerState;
  playerBets: Array<{
    playerId: string;
    totalContractBet: number;
    userContractBet: number;
  }>;
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
        <div className="poker-table-container">
          <div className="table-surface">
            {/* Players */}
            {gameState?.players?.map((player: PlayerState, index: number) => {
              const playerBet = playerBets.find(
                (bet: { playerId: string; totalContractBet: number; userContractBet: number }) => bet.playerId === player.id
              ) || {
                playerId: player.id,
                totalContractBet: 0,
                userContractBet: 0,
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
                  totalContractBet={playerBet.totalContractBet}
                  userContractBet={playerBet.userContractBet}
                />
              );
            })}

            {/* Center area */}
            <div className="center-area">
              {/* Game status */}
              <div className="game-status">
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
                    <div>Phase: {getPhaseLabel(gameState.round.phase)}</div>
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
                  <div className="pot">
                    <div>POT: ${formatChips(gameState.pot)}</div>
                    {gameState.round?.currentBet > 0 && (
                      <div className="current-bet">
                        Current Bet: ${formatChips(gameState.round.currentBet)}
                      </div>
                    )}
                    {gameState.round?.roundPot > 0 && (
                      <div className="round-pot">
                        Round Pot: ${formatChips(gameState.round.roundPot)}
                      </div>
                    )}
                  </div>
                  {/* Community cards */}
                  <div className="river">
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