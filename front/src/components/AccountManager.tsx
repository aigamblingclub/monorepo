/**
 * Account Manager Component
 * 
 * This component handles the two distinct account states:
 * - Unlocked: Balance management (deposit/withdraw) with lock option
 * - Locked: Betting interface with unlock option
 * 
 * Uses terminal aesthetic matching the WalletMenu.
 * 
 * @module AccountManager
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useNearWallet } from '@/hooks/useNearWallet';
import { formatUsdcDisplay } from '@/utils/usdcBalance';
import { Transactions } from './Transactions';
import { PlayerBetting } from './PlayerBetting';
import { PlayerState } from '../types/poker';

export interface PlayerBet {
  playerId: string;
  totalBet: number;
  betAmount: number;
}

interface AccountManagerProps {
  isLoggedIn: boolean;
  players?: PlayerState[];
  playerBets?: PlayerBet[];
  onPlaceBet?: (playerId: string, amount: number) => void;
  tableStatus?: string;
}

export function AccountManager({ 
  isLoggedIn,
  players = [],
  playerBets = [],
  onPlaceBet = () => {},
  tableStatus = "WAITING"
}: AccountManagerProps) {
  const { accountId } = useAuth();
  const { getUsdcWalletBalance, getAgcUsdcBalance } = useNearWallet();
  const [userBalanceOnChain, setUserBalanceOnChain] = useState(0);
  const [depositedUsdcBalance, setDepositedUsdcBalance] = useState(0);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isAccountLocked, setIsAccountLocked] = useState(false); // TODO: Get from contract
  const [isTransactionPending, setIsTransactionPending] = useState(false);

  // Force login to true if we have a balance - handles edge cases
  const actuallyLoggedIn = isLoggedIn || depositedUsdcBalance > 0;

  // Check if betting is allowed based on table status
  // Betting is only allowed when game hasn't started (WAITING) or between games
  const gameInProgress = tableStatus === "PLAYING" || tableStatus === "ROUND_OVER";
  const bettingAllowed = !gameInProgress;

  // All players are available for betting (when game hasn't started)
  // When game is in progress, no betting is allowed regardless of player status
  const availableForBetting = bettingAllowed ? players : [];

  /**
   * Memoized function to fetch balances - prevents infinite re-renders
   */
  const fetchBalances = useCallback(async () => {
    if (!accountId) return;

    setIsLoadingBalances(true);
    try {
      const [walletBalance, agcBalance] = await Promise.all([
        getUsdcWalletBalance(accountId),
        getAgcUsdcBalance(accountId)
      ]);
      
      setUserBalanceOnChain(walletBalance);
      setDepositedUsdcBalance(agcBalance);
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [accountId, getUsdcWalletBalance, getAgcUsdcBalance]);

  /**
   * Fetch balances only when accountId changes
   */
  useEffect(() => {
    if (accountId) {
      fetchBalances();
    }
  }, [accountId]); // Only depend on accountId, not the functions

  /**
   * Handle transaction start - begins periodic balance refresh
   */
  const handleTransactionStart = useCallback(() => {
    setIsTransactionPending(true);
    
    // Start periodic balance refresh every 3 seconds
    const intervalId = setInterval(() => {
      if (accountId) {
        fetchBalances();
      }
    }, 3000);

    // Store interval ID for cleanup
    return intervalId;
  }, [accountId, fetchBalances]);

  /**
   * Handle transaction end - stops periodic refresh
   */
  const handleTransactionEnd = useCallback((intervalId?: NodeJS.Timeout) => {
    setIsTransactionPending(false);
    if (intervalId) {
      clearInterval(intervalId);
    }
    // Final balance refresh
    if (accountId) {
      fetchBalances();
    }
  }, [accountId, fetchBalances]);

  /**
   * Start spinner only (visual feedback)
   */
  const startSpinner = useCallback(() => {
    setIsTransactionPending(true);
  }, []);

  /**
   * Start balance refresh after successful transaction
   */
  const startBalanceRefresh = useCallback(() => {
    const intervalId = setInterval(() => {
      if (accountId) {
        fetchBalances();
      }
    }, 3000);
    return intervalId;
  }, [accountId, fetchBalances]);

  /**
   * Stop spinner and balance refresh
   */
  const stopTransactionState = useCallback((intervalId?: NodeJS.Timeout) => {
    setIsTransactionPending(false);
    if (intervalId) {
      clearInterval(intervalId);
    }
    // Final balance refresh
    if (accountId) {
      fetchBalances();
    }
  }, [accountId, fetchBalances]);

  /**
   * Breathing Spinner Component for terminal aesthetics
   */
  const BreathingSpinner = () => {
    if (!isTransactionPending) return null;

    return (
      <div className="absolute top-4 right-4">
        <div 
          className="w-3 h-3 border border-white bg-black animate-spin"
          style={{ 
            animationDuration: '2s',
            animationTimingFunction: 'linear'
          }}
        />
      </div>
    );
  };

  /**
   * TODO: Check account lock status from contract
   */
  useEffect(() => {
    if (accountId) {
      // TODO: Call contract to check if account is locked
      // setIsAccountLocked(await contract.isAccountLocked(accountId));
    }
  }, [accountId]);

  /**
   * Handles locking the account
   */
  const handleLockAccount = async () => {
    try {
      // TODO: Call contract method to lock account
      // await contract.lockAccount();
      setIsAccountLocked(true);
      console.log('Account locked for betting');
    } catch (error) {
      console.error('Error locking account:', error);
    }
  };

  /**
   * Handles unlocking the account
   */
  const handleUnlockAccount = async () => {
    try {
      // TODO: Call contract method to unlock account
      // await contract.unlockAccount();
      setIsAccountLocked(false);
      console.log('Account unlocked for balance management');
    } catch (error) {
      console.error('Error unlocking account:', error);
    }
  };

  // Connection warning for unauthenticated users
  if (!actuallyLoggedIn) {
    return (
      <div className="bg-black border-2 border-white p-4">
        <div className="border-b border-white pb-3 mb-4">
          <h3 className="text-white font-mono font-bold text-lg">
            Account Manager
          </h3>
        </div>
        <div className="p-3 bg-black border border-yellow-500">
          <p className="text-yellow-400 font-mono text-sm text-center">
            Connect your NEAR wallet to manage your account
          </p>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE: Balance Management
  if (!isAccountLocked) {
    return (
      <div className="bg-black border-2 border-white p-4 relative w-80 flex-shrink-0">
        <BreathingSpinner />
        
        {/* Header */}
        <div className="border-b border-white pb-3 mb-4">
          <h3 className="text-white font-mono font-bold text-lg">
            Account Manager
          </h3>
          <div className="flex flex-col gap-1 mt-2">
            <div className="text-white font-mono text-sm">
              Wallet Balance: {isLoadingBalances ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <span className="text-green-400">{formatUsdcDisplay(userBalanceOnChain)}</span>
              )}
            </div>
            <div className="text-white font-mono text-sm">
              Deposited USDC: {isLoadingBalances ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <span className="text-green-400">{formatUsdcDisplay(depositedUsdcBalance)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Balance Operations */}
        <div className="mb-4">
          <div className="border-b border-white pb-2 mb-3">
            <h4 className="text-white font-mono font-semibold text-md">Operations</h4>
          </div>
          <Transactions 
            startSpinner={startSpinner}
            startBalanceRefresh={startBalanceRefresh}
            stopTransactionState={stopTransactionState}
          />
        </div>

        {/* Lock Account Button */}
        <div className="border-t border-white pt-4">
          <button
            onClick={handleLockAccount}
            className="w-full bg-black border border-green-500 rounded px-4 py-3 font-mono text-sm text-green-400 hover:bg-green-500 hover:text-white transition-all duration-200 flex items-center justify-center gap-3 group"
          >
            {/* Lock Icon */}
            <div className="relative">
              <div className="w-4 h-3 border-2 border-current rounded-sm border-b-0"></div>
              <div className="w-5 h-3 border-2 border-current rounded-sm -mt-1"></div>
              <div className="absolute top-1 left-1.5 w-1 h-1 bg-current rounded-full"></div>
            </div>
            <span>lock --enable-betting</span>
          </button>
        </div>

        {/* Footer Information */}
        <div className="border-t border-white pt-3 mt-4">
          <div className="text-gray-400 font-mono text-xs space-y-1">
            <p>* Lock account to enable betting mode</p>
            <p>* No deposits/withdrawals while betting</p>
          </div>
        </div>
      </div>
    );
  }

  // LOCKED STATE: Betting Interface
  return (
    <div className="bg-black border-2 border-white p-4 relative w-80 flex-shrink-0">
      {/* Header */}
      <div className="border-b border-white pb-3 mb-4">
        <h3 className="text-white font-mono font-bold text-lg">
          Betting Interface
        </h3>
        <div className="text-white font-mono text-sm mt-2">
          Deposited USDC: <span className="text-green-400">{formatUsdcDisplay(depositedUsdcBalance)}</span>
        </div>
      </div>

      {/* Game Status Warning */}
      {!bettingAllowed && (
        <div className="mb-4 p-3 bg-black border border-orange-500 rounded">
          <p className="text-orange-400 font-mono text-sm text-center">
            Game in progress - betting closed
          </p>
        </div>
      )}

      {/* Available Players for Betting */}
      {bettingAllowed && availableForBetting.length > 0 ? (
        <div className="space-y-3 mb-4">
          <div className="border-b border-white pb-2 mb-3">
            <h4 className="text-white font-mono font-semibold text-md">Next Game Players</h4>
          </div>
          {availableForBetting.map((player: PlayerState) => {
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
      ) : bettingAllowed ? (
        <div className="mb-4 p-3 bg-black border border-white rounded text-center">
          <p className="text-white font-mono text-sm">
            No players available for next game
          </p>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-black border border-white rounded text-center">
          <p className="text-white font-mono text-sm">
            Betting will open before next game starts
          </p>
        </div>
      )}

      {/* Unlock Account Button */}
      <div className="border-t border-white pt-4">
        <button
          onClick={handleUnlockAccount}
          className="w-full bg-black border border-blue-500 rounded px-4 py-3 font-mono text-sm text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-200 flex items-center justify-center gap-3 group"
        >
          {/* Unlock Icon */}
          <div className="relative">
            <div className="w-4 h-3 border-2 border-current rounded-sm border-b-0 border-t-0"></div>
            <div className="w-5 h-3 border-2 border-current rounded-sm -mt-1"></div>
            <div className="absolute top-1 left-1.5 w-1 h-1 bg-current rounded-full"></div>
          </div>
          <span>unlock --enable-management</span>
        </button>
      </div>

      {/* Footer Information */}
      <div className="border-t border-white pt-3 mt-4">
        <div className="text-gray-400 font-mono text-xs space-y-1">
          <p>* Betting only allowed before game starts</p>
          <p>* Winnings distributed after game ends</p>
          <p>* Unlock to manage balance again</p>
        </div>
      </div>
    </div>
  );
} 