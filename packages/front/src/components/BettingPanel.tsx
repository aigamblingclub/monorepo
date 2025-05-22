import React, { useEffect } from 'react';
import { PlayerBetting } from './PlayerBetting';
import { PlayerState } from '../types/poker';

export interface PlayerBet {
  playerId: string;
  totalContractBet: number;
  userContractBet: number;
}

interface BettingPanelProps {
  players: PlayerState[];
  playerBets: PlayerBet[];
  onPlaceBet: (playerId: string, amount: number) => void;
  userBalance: number;
  isLoggedIn: boolean;
}

export const BettingPanel: React.FC<BettingPanelProps> = ({
  players,
  playerBets,
  onPlaceBet,
  userBalance,
  isLoggedIn,
}) => {
  // Only show betting for active players
  const activePlayers = players.filter(player => player.status !== 'FOLDED');
  
  // Log the login state for debugging
  useEffect(() => {
    console.log('🔐 NEAR wallet connected state in BettingPanel:', isLoggedIn);
    console.log('💰 User balance:', userBalance);
    console.log('🎮 Active players:', activePlayers.length);
    console.log('🎯 Player bets:', playerBets);
  }, [isLoggedIn, userBalance, activePlayers.length, playerBets]);

  // Force login to true if we have player bets or a balance
  // This handles edge cases where the wallet is connected but the flag isn't updated
  const actuallyLoggedIn = isLoggedIn || playerBets.length > 0 || userBalance > 0;

  return (
    <div className="betting-panel-container border-2 border-theme-primary rounded-border-radius-element p-4 bg-surface-secondary">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-theme-accent text-shadow-pink text-xl">Player Betting</h3>
        <div className="text-theme-primary text-shadow-green text-sm">
          {actuallyLoggedIn ? (
            `Your Balance: $${userBalance}`
          ) : (
            "Not Connected"
          )}
        </div>
      </div>
      
      {!actuallyLoggedIn ? (
        <div className="text-center py-4">
          <p className="text-theme-highlight text-shadow-yellow mb-2">Connect your NEAR wallet to place bets</p>
          <p className="text-theme-secondary text-shadow-cyan text-xs">
            Make sure you&apos;re connected to the NEAR wallet in your account settings
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 p-2 border border-theme-primary rounded-border-radius-element bg-surface-tertiary">
            <p className="text-theme-primary text-shadow-green text-sm">
              NEAR Wallet: <span className="text-theme-highlight">Connected ✓</span>
            </p>
          </div>
          
          {activePlayers.length > 0 ? (
            <div className="grid gap-2">
              {activePlayers.map(player => {
                const playerBet = playerBets.find(bet => bet.playerId === player.id) || {
                  playerId: player.id,
                  totalContractBet: 0,
                  userContractBet: 0
                };
                
                return (
                  <PlayerBetting
                    key={player.id}
                    playerId={player.id}
                    playerName={player.playerName}
                    totalContractBet={playerBet.totalContractBet}
                    userContractBet={playerBet.userContractBet}
                    onPlaceBet={onPlaceBet}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-theme-secondary text-shadow-cyan">No active players to bet on</p>
            </div>
          )}
        </>
      )}
      
      <div className="text-theme-secondary text-shadow-cyan text-xs mt-4">
        <p>* Bets are locked once the round starts</p>
        <p>* Winnings are distributed proportionally based on bet amount</p>
      </div>
    </div>
  );
}; 