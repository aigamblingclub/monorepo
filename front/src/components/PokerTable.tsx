import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { Player } from './Player';
import {
  PlayerState,
  PokerState,
  formatChips,
  getPhaseLabel,
  Card as CardType,
} from '../types/poker';
import { PlayerBet } from './AccountManager';

interface PokerTableProps {
  gameState: PokerState;
  playerBets: PlayerBet[];
}

const getPlayerPosition = (
  index: number,
  totalPlayers: number
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 => {
  if (totalPlayers === 2) {
    return index === 0 ? 7 : 8;
  }
  return (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

export const PokerTable: React.FC<PokerTableProps> = ({
  gameState,
  playerBets,
}) => {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timer, setTimer] = useState(120); // 2 minutos em segundos
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [waitingProgress, setWaitingProgress] = useState(0);
  const [waitingStartTime, setWaitingStartTime] = useState<number | null>(null);
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    if (gameState?.players?.length > 1) {
      setReady(true);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState.tableStatus === 'GAME_OVER') {
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
      setTimer(prev => prev - 1);
      setProgress(prev => prev + 100 / 120);
    }, 1000);

    return () => clearInterval(interval);
  }, [showProgressBar, timer]);

  // Handle WAITING status and 2-minute progress
  useEffect(() => {
    if (gameState.tableStatus === 'WAITING') {
      const now = Date.now();

      // First time receiving WAITING status
      if (waitingStartTime === null) {
        setWaitingStartTime(now);
        setWaitingProgress(0);
        setIsDelayed(false);
      } else {
        // Check if we've exceeded 2 minutes since first WAITING
        const elapsed = now - waitingStartTime;
        if (elapsed >= 120000) {
          // 2 minutes = 120,000ms
          setIsDelayed(true);
        }
      }

      const interval = setInterval(() => {
        const currentTime = Date.now();
        const elapsed = currentTime - (waitingStartTime || currentTime);
        const progressPercent = Math.min((elapsed / 120000) * 100, 100); // 2 minutes = 120,000ms
        setWaitingProgress(progressPercent);

        // Check for delayed state
        if (elapsed >= 120000) {
          setIsDelayed(true);
        }
      }, 100);

      return () => clearInterval(interval);
    } else {
      // Reset when not in WAITING state
      setWaitingStartTime(null);
      setWaitingProgress(0);
      setIsDelayed(false);
    }
  }, [gameState.tableStatus, waitingStartTime]);

  const getGamePlayerById = (id: string) => {
    return gameState?.players?.find(player => player.id === id);
  };

  return (
    <div className='w-[50vw] h-[50vh] max-w-[800px] max-h-[500px] bg-black border-2 border-white relative overflow-hidden flex justify-center items-center'>
      {/* Center area with POT and cards */}
      <div className='flex items-center gap-8'>
        {/* Left Player - The Showman */}
        {gameState?.players?.length > 0 && (
          <div className='flex-shrink-0'>
            <Player
              key={gameState.players[0].id}
              tablePosition={7}
              {...gameState.players[0]}
              isCurrentPlayer={0 === gameState?.currentPlayerIndex}
              totalContractBet={
                playerBets.find(bet => bet.playerId === gameState.players[0].id)
                  ?.totalBet || 0
              }
              userContractBet={
                playerBets.find(bet => bet.playerId === gameState.players[0].id)
                  ?.betAmount || 0
              }
            />
          </div>
        )}

        {/* Center Content */}
        <div className='text-center flex-shrink-0'>
          {/* Game status */}
          <div className='text-base text-white font-mono mb-2.5 border-2 border-white p-1.5 bg-black w-[249px] mx-auto'>
            {gameState.tableStatus === 'WAITING' &&
              (isDelayed ? 'Delayed' : 'Waiting...')}
            {gameState.tableStatus === 'PLAYING' &&
              !ready &&
              'Waiting for players...'}
            {gameState.tableStatus === 'ROUND_OVER' &&
              gameState.winner &&
              `Winner: ${gameState.winner}`}
            {gameState.tableStatus === 'GAME_OVER' &&
              gameState.winner &&
              `Game Over - Winner: ${getGamePlayerById(gameState.winner)?.playerName}`}

            {gameState.tableStatus === 'PLAYING' && ready && (
              <>
                <div>Phase: {getPhaseLabel(gameState.phase.street)}</div>
                <div>Round: {gameState.round.roundNumber}</div>
                <div>Turn: {gameState.phase.actionCount}</div>
              </>
            )}
          </div>
          {gameState.tableStatus === 'WAITING' && (
            <div className='mb-4 w-[249px] mx-auto'>
              <div
                className='progress-bar-outer'
                style={isDelayed ? { borderColor: '#ef4444' } : {}}
              >
                <div
                  className='progress-bar-inner'
                  style={{
                    width: `${waitingProgress}%`,
                    backgroundColor: isDelayed ? '#ef4444' : undefined,
                  }}
                />
              </div>
            </div>
          )}
          {showProgressBar && (
            <div className='progress-bar-container'>
              <div className='progress-bar-outer'>
                <div
                  className='progress-bar-inner'
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className='progress-bar-label'>
                [ Loading next game... {timer}s ]
              </div>
            </div>
          )}
          {ready && (
            <>
              {/* Pot and current bet */}
              <div className='text-base text-white font-mono mb-4 border border-white p-2 bg-black w-[249px] mx-auto'>
                <div>
                  POT:{' '}
                  <span className='text-green-400'>
                    ${formatChips(gameState?.round?.volume || 0)}
                  </span>
                </div>
                {gameState.round?.currentBet > 0 && (
                  <div className='current-bet'>
                    Current Bet:{' '}
                    <span className='text-green-400'>
                      ${formatChips(gameState?.round?.currentBet || 0)}
                    </span>
                  </div>
                )}
              </div>
              {/* Community cards */}
              <div className='flex justify-center gap-1.5'>
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

        {/* Right Player - The Strategist */}
        {gameState?.players?.length > 1 && (
          <div className='flex-shrink-0'>
            <Player
              key={gameState.players[1].id}
              tablePosition={8}
              {...gameState.players[1]}
              isCurrentPlayer={1 === gameState?.currentPlayerIndex}
              totalContractBet={
                playerBets.find(bet => bet.playerId === gameState.players[1].id)
                  ?.totalBet || 0
              }
              userContractBet={
                playerBets.find(bet => bet.playerId === gameState.players[1].id)
                  ?.betAmount || 0
              }
            />
          </div>
        )}
      </div>

      {/* Render additional players (3+) using original absolute positioning if needed */}
      {gameState?.players
        ?.slice(2)
        .map((player: PlayerState, index: number) => {
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
                index + 2,
                gameState.players.length
              )}
              {...player}
              isCurrentPlayer={index + 2 === gameState?.currentPlayerIndex}
              totalContractBet={playerBet.totalBet}
              userContractBet={playerBet.betAmount}
            />
          );
        })}
    </div>
  );
};
