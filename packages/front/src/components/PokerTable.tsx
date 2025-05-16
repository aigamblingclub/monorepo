import React, { useEffect } from 'react';
import { Card } from './Card';
import { Player } from './Player';
import { PokerState, formatChips, getPhaseLabel } from '../types/poker';
import { BettingPanel } from './BettingPanel';
import { usePlayerBetting } from '../hooks/usePlayerBetting';

interface PokerTableProps {
  gameState: PokerState;
  contractId: string;
}

const getPlayerPosition = (index: number, totalPlayers: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 => {
  if (totalPlayers === 2) {
    return index === 0 ? 7 : 8;
  }
  return ((index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
};

export const PokerTable: React.FC<PokerTableProps> = ({ 
  gameState,
  contractId
}) => {
  // Use the betting hook directly with contract ID
  const {
    playerBets,
    userBalance,
    loading,
    error,
    placeBet,
    isReady,
    isConnected,
    accountId
  } = usePlayerBetting({
    contractId
  });

  // Debug logs to check connection state
  useEffect(() => {
    console.log('🔍 NEAR wallet state in PokerTable (direct):', {
      connected: isConnected,
      accountId: accountId,
      ready: isReady
    });
  }, [isConnected, accountId, isReady]);

  return (
    <div className="h-full bg-black flex flex-row">
      {/* Main poker table */}
      <div className="flex-grow flex justify-center items-center">
        <div className="poker-table-container">
          <div className="table-surface">
            {/* Players */}
            {gameState?.players?.map((player, index) => {
              const playerBet = playerBets.find(bet => bet.playerId === player.id) || {
                playerId: player.id,
                totalContractBet: 0,
                userContractBet: 0
              };
              
              return (
                <Player
                  key={player.id}
                  position={getPlayerPosition(index, gameState.players.length)}
                  {...player}
                  isCurrentPlayer={index === gameState?.currentPlayerIndex}
                  isDealer={player.id === gameState.dealerId}
                  totalContractBet={playerBet.totalContractBet}
                  userContractBet={playerBet.userContractBet}
                />
              );
            })}

            {/* Center area */}
            <div className="center-area">
              {/* Game status */}
              <div className="game-status">
                {gameState.status === "WAITING" && "Waiting for players..."}
                {gameState.status === "ROUND_OVER" && gameState.winner && `Winner: ${gameState.winner}`}
                {gameState.status === "GAME_OVER" && gameState.winner && `Game Over - Winner: ${gameState.winner}`}
                {gameState.status === "PLAYING" && (
                  <>
                    <div>Phase: {getPhaseLabel(gameState.round.phase)}</div>
                    <div>Round: {gameState.round.roundNumber}</div>
                  </>
                )}
              </div>
              {/* Pot and current bet */}
              <div className="pot">
                <div>POT: ${formatChips(gameState.pot)}</div>
                {gameState.round.currentBet > 0 && (
                  <div className="current-bet">Current Bet: ${formatChips(gameState.round.currentBet)}</div>
                )}
                {gameState.round.roundPot > 0 && (
                  <div className="round-pot">Round Pot: ${formatChips(gameState.round.roundPot)}</div>
                )}
              </div>
              {/* Community cards */}
              <div className="river">
                {gameState?.community?.map((card, index) => (
                  <Card key={`${card.rank}-${card.suit}-${index}`} card={card} />
                ))}
                {/* Empty cards to complete 5 */}
                {Array.from({ length: Math.max(0, 5 - gameState.community.length) }).map((_, index) => (
                  <Card key={`empty-${index}`} card={null} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Betting sidebar */}
      <div className="w-80 p-4">
        <BettingPanel
          players={[...gameState.players]}
          playerBets={playerBets}
          onPlaceBet={placeBet}
          userBalance={userBalance}
          isLoggedIn={isConnected}
        />
        {error && (
          <div className="mt-4 p-2 border border-theme-alert rounded-border-radius-element bg-surface-secondary">
            <p className="text-theme-alert text-shadow-red text-sm">{error}</p>
          </div>
        )}
        {loading && (
          <div className="mt-4 text-center">
            <p className="text-theme-secondary text-shadow-cyan text-sm">Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}; 