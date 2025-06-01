import React, { useEffect, useState } from "react";
import { PlayerBetting } from "./PlayerBetting";
import { PlayerState } from "../types/poker";
import { Transactions } from "./Transactions";
import { useNearWallet } from "@/hooks/useNearWallet";

export interface PlayerBet {
  playerId: string;
  totalBet: number;
  betAmount: number;
}

interface BettingPanelProps {
  players: PlayerState[];
  playerBets: PlayerBet[];
  onPlaceBet: (playerId: string, amount: number) => void;
  userBalance: number;
  usdcBalance: string | number;
  isLoggedIn: boolean;
}

export const BettingPanel: React.FC<BettingPanelProps> = ({
  players,
  playerBets,
  onPlaceBet,
  userBalance,
  usdcBalance,
  isLoggedIn,
}) => {
  const { getUsdcWalletBalance, accountId } = useNearWallet();
  const [userBalanceOnChain, setUserBalanceOnChain] = useState(0);
  // Only show betting for active players
  const activePlayers = players.filter(
    (player: PlayerState) => player.status !== "FOLDED"
  );

  // Log the login state for debugging
  useEffect(() => {
    console.log("🔐 NEAR wallet connected state in BettingPanel:", isLoggedIn);
    console.log("💰 User balance:", userBalance);
    console.log("🎮 Active players:", activePlayers.length);
    console.log("🎯 Player bets:", playerBets);
  }, [isLoggedIn, userBalance, activePlayers.length, playerBets]);

  // Force login to true if we have player bets or a balance
  // This handles edge cases where the wallet is connected but the flag isn't updated
  const actuallyLoggedIn =
    isLoggedIn || playerBets.length > 0 || userBalance > 0;

  useEffect(() => {
    if (accountId) {
      getUsdcWalletBalance(accountId).then((balance) => {
        setUserBalanceOnChain(balance);
      });
    }
  }, [accountId]);


  return (
    <div className="max-h-[calc(100vh-2rem)] overflow-y-auto shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)] border-2 border-theme-primary rounded-border-radius-element p-4 bg-surface-secondary">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-theme-accent text-shadow-pink text-xl">
          Player Betting
        </h3>
        <div className="flex flex-col">
          <div className="text-theme-primary text-shadow-green text-sm">
            {actuallyLoggedIn ? `Your Game Balance: $${userBalance}` : ""}
          </div>
          <div className="text-theme-primary text-shadow-green text-sm">
            {`Onchain Balance: $${userBalanceOnChain}`}
          </div>
        </div>
      </div>

      <>
        <div className="mb-3 p-2 border border-theme-primary rounded-border-radius-element bg-surface-tertiary">
          <p className="text-theme-primary text-shadow-green text-sm">
            NEAR Wallet:{" "}
            <span className="text-theme-highlight">
              {" "}
              {actuallyLoggedIn ? "Connected ✓" : "Not Connected ✗"}
            </span>
          </p>
        </div>

        <Transactions />

        {!actuallyLoggedIn && (
          <div className="text-xs text-center py-4">
            <p className="text-theme-highlight text-shadow-yellow mb-2">
              Connect your NEAR wallet to place bets
            </p>
          </div>
        )}

        {activePlayers.length > 0 ? (
          <div className="grid gap-2">
            {activePlayers.map((player: PlayerState) => {
              const playerBet = playerBets.find(
                (bet: PlayerBet) => bet.playerId === player.id
              ) || {
                playerId: player.id,
                totalBet: 0,
                betAmount: 0,
              };

              return (
                <PlayerBetting
                  key={player.id}
                  playerId={player.id}
                  playerName={player.playerName}
                  totalBet={playerBet.totalBet}
                  bet={playerBet}
                  onPlaceBet={onPlaceBet}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-theme-secondary text-shadow-cyan">
              No active players to bet on
            </p>
          </div>
        )}
      </>

      <div className="text-theme-secondary text-shadow-cyan text-xs mt-4">
        <p>* Bets are locked once the round starts</p>
        <p>* Winnings are distributed proportionally based on bet amount</p>
      </div>
    </div>
  );
};
