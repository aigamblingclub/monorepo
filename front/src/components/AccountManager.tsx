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

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useNearWallet } from '@/hooks/useNearWallet';
import { formatUsdcDisplay } from '@/utils/usdcBalance';
import { Transactions } from './Transactions';
import { LockOperations } from './LockOperations';
import { PlayerBetting } from './PlayerBetting';
import { PlayerState, PokerState } from '../types/poker';
import { isDev } from '@/utils/env';

export interface PlayerBet {
  playerId: string;
  totalBet: number;
  betAmount: number;
}

interface AccountManagerProps {
  players?: PlayerState[];
  playerBets?: PlayerBet[];
  onPlaceBet?: (playerId: string, amount: number) => void;
  tableStatus?: string;
  gameState: PokerState;
  loading?: boolean; // Loading state for betting
}

export function AccountManager({
  players = [],
  playerBets = [],
  onPlaceBet = () => {},
  tableStatus = 'WAITING',
  gameState,
  loading = false,
}: AccountManagerProps) {
  const { accountId, apiKey } = useAuth();
  const { getUsdcWalletBalance, getIsUsdcLocked, getVirtualUsdcBalance, getAgcUsdcBalance } =
    useNearWallet();
  const [walletUsdcBalance, setWalletUsdcBalance] = useState(0);
  const [virtualUsdcBalance, setVirtualUsdcBalance] = useState(0);
  const [agcUsdcBalance, setAgcUsdcBalance] = useState(0);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [unlockCountdown, setUnlockCountdown] = useState<number | null>(null);
  const [initialCountdownSeconds, setInitialCountdownSeconds] = useState<number | null>(null);

  // Force login to true if we have a balance - handles edge cases
  const actuallyLoggedIn = !!accountId;

  // Check if betting is allowed based on table status
  // Betting is only allowed when game hasn't started (WAITING) or between games
  const gameInProgress =
    tableStatus === 'PLAYING' || tableStatus === 'ROUND_OVER';
  const bettingAllowed = !gameInProgress;

  // All players are available for betting (when game hasn't started)
  // When game is in progress, no betting is allowed regardless of player status
  const availableForBetting = bettingAllowed ? players : [];

  const fetchRewardBalance = useCallback(async () => {
    if (!accountId) return;
    if (!apiKey) return;

    setIsLoadingBalances(true);
    if(isAccountLocked && tableStatus === 'GAME_OVER') {
      try {
        const seconds = 30;
        setUnlockCountdown(seconds);
        setInitialCountdownSeconds(seconds);
        setVirtualUsdcBalance(0); // Set to 0 during countdown
      } catch (error) {
        if (isDev) console.error("Fetch reward balance error:", error);
        setVirtualUsdcBalance(0);
      }
    }
  }, [accountId, apiKey, getVirtualUsdcBalance, isAccountLocked, tableStatus]);
  
  useEffect(() => {
    if (tableStatus === 'GAME_OVER') {
      fetchRewardBalance();
    }
  }, [accountId, apiKey, isAccountLocked, tableStatus]);

  /**
   * Memoized function to fetch balances - prevents infinite re-renders
   */
  const fetchBalances = useCallback(async () => {
    if (!accountId) return;
    if (!apiKey) return;

    setIsLoadingBalances(true);
    try {
      const [walletBalance, agcBalance] = await Promise.all([
        getUsdcWalletBalance(accountId),
        getAgcUsdcBalance(accountId),
      ]);
      if(isAccountLocked) {
        try {
          const virtualBalance = await getVirtualUsdcBalance(apiKey);
          setVirtualUsdcBalance(virtualBalance);
          // Clear countdown if balance fetch succeeds
          setUnlockCountdown(null);
          setInitialCountdownSeconds(null);
        } catch (error: any) {
          if (error.message === 'UNLOCK_DEADLINE_ERROR' && error.unlockSecondsLeft) {
            // Start countdown timer
            const seconds = error.unlockSecondsLeft;
            setUnlockCountdown(seconds);
            setInitialCountdownSeconds(seconds);
            setVirtualUsdcBalance(0); // Set to 0 during countdown
          } else {
            // Other errors
            if (isDev) {
              console.error("Virtual balance fetch error:", error);
            }
            setVirtualUsdcBalance(0);
          }
        }
      }
      setWalletUsdcBalance(walletBalance);
      setAgcUsdcBalance(agcBalance);
    } catch (error) {
      if (isDev) {
        console.error("Fetch balances error:", error);
      }
      setWalletUsdcBalance(0);
      setVirtualUsdcBalance(0);
      setAgcUsdcBalance(0);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [accountId, apiKey, getAgcUsdcBalance, getUsdcWalletBalance, getVirtualUsdcBalance, isAccountLocked]);

  /**
   * Memoized function to fetch lock status - prevents infinite re-renders
   */
  const fetchIsUsdcLocked = useCallback(async () => {
    if (!accountId) return;

    try {
      const lockStatus = await getIsUsdcLocked(accountId);
      setIsAccountLocked(lockStatus);
    } catch (error) {
      if (isDev) {
        console.error("Fetch lock status error:", error);
      }
      setIsAccountLocked(false);
    }
  }, [accountId, getIsUsdcLocked]);

  /**
   * Fetch balances when accountId changes
   */
  useEffect(() => {
    if (accountId) {
      fetchBalances();
      fetchIsUsdcLocked();
    }
  }, [accountId, apiKey, isAccountLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Countdown timer effect
   */
  useEffect(() => {
    if (unlockCountdown === null || unlockCountdown <= 0) return;

    const interval = setInterval(() => {
      setUnlockCountdown(prev => {
        if (prev === null || prev <= 1) {
          // Countdown finished, retry fetching balance
          fetchBalances();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [unlockCountdown, fetchBalances, fetchRewardBalance]);

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
   * Start lock status refresh after successful transaction
   */
  const startLockRefresh = useCallback(() => {
    const intervalId = setInterval(() => {
      if (accountId) {
        fetchIsUsdcLocked();
      }
    }, 3000);
    return intervalId;
  }, [accountId, fetchIsUsdcLocked]);

  /**
   * Stop spinner and balance refresh
   */
  const stopDepositWithdrawTransactionState = useCallback(
    (intervalId?: NodeJS.Timeout) => {
      setIsTransactionPending(false);
      if (intervalId) {
        clearInterval(intervalId);
      }
      // Final balance refresh
      if (accountId) {
        fetchBalances();
      }
    },
    [accountId, fetchBalances]
  );

  /**
   * Stop spinner and lock status refresh
   */
  const stopLockUnlockTransactionState = useCallback(
    (intervalId?: NodeJS.Timeout) => {
      setIsTransactionPending(false);
      if (intervalId) {
        clearInterval(intervalId);
      }
      // Final lock status refresh
      if (accountId) {
        fetchIsUsdcLocked();
      }
    },
    [accountId, fetchIsUsdcLocked]
  );

  /**
   * Breathing Spinner Component for terminal aesthetics
   */
  const BreathingSpinner = () => {
    if (!isTransactionPending) return null;

    return (
      <div className='absolute top-4 right-4'>
        <div
          className='w-3 h-3 border border-white bg-black animate-spin'
          style={{
            animationDuration: '2s',
            animationTimingFunction: 'linear',
          }}
        />
      </div>
    );
  };

  /**
   * Unlock Countdown Component with progress bar
   */
  const UnlockCountdown = () => {
    if (unlockCountdown === null || initialCountdownSeconds === null) return null;

    // Calculate progress (0 to 1)
    const progress = 1 - (unlockCountdown / initialCountdownSeconds);
    
    // Calculate filled squares (max 8 squares)
    const maxSquares = 32;
    const filledSquares = Math.floor(progress * maxSquares);
    
    // Create progress bar
    const progressBar = Array.from({ length: maxSquares }, (_, i) => 
      i < filledSquares ? '█' : '░'
    ).join('');

    return (
      <span className='text-yellow-400'>
        {unlockCountdown}s to unlock... {progressBar}
      </span>
    );
  };

  // Connection warning for unauthenticated users
  if (!actuallyLoggedIn) {
    return (
      <div className='bg-black border-2 border-white p-4'>
        <div className='border-b border-white pb-3 mb-4'>
          <h3 className='text-white font-mono font-bold text-lg'>
            Account Manager
          </h3>
        </div>
        <div className='p-3 bg-black border border-yellow-500'>
          <p className='text-yellow-400 font-mono text-sm text-center'>
            Connect your NEAR wallet to manage your account
          </p>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE: Balance Management
  if (!isAccountLocked) {
    return (
      <div className='bg-black border-2 border-white p-4 relative flex-shrink-0'>
        <BreathingSpinner />

        {/* Header */}
        <div className='border-b border-white pb-3 mb-4'>
          <h3 className='text-white font-mono font-bold text-lg'>
            Account Manager
          </h3>
          <div className='flex flex-col gap-1 mt-2'>
            <div className='text-white font-mono text-sm'>
              Wallet Balance:{' '}
              {isLoadingBalances ? (
                <span className='animate-pulse text-yellow-400'>Loading...</span>
              ) : (
                <span className='text-green-400'>
                  {formatUsdcDisplay(walletUsdcBalance)}
                </span>
              )}
            </div>
            <div className='text-white font-mono text-sm'>
              Deposited USDC:{' '}
              {isLoadingBalances || agcUsdcBalance === 0 ? (
                <span className='animate-pulse text-yellow-400'>Loading...</span>
              ) : (
                <span className='text-green-400'>
                  {formatUsdcDisplay(agcUsdcBalance)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Balance Operations */}
        <div className='mb-4'>
          <div className='border-b border-white pb-2 mb-3'>
            <h4 className='text-white font-mono font-semibold text-md'>
              Operations
            </h4>
          </div>
          <Transactions
            startSpinner={startSpinner}
            startBalanceRefresh={startBalanceRefresh}
            stopTransactionState={stopDepositWithdrawTransactionState}
          />
        </div>

        {/* Lock Account Button */}
        <LockOperations
          startSpinner={startSpinner}
          startLockRefresh={startLockRefresh}
          stopTransactionState={stopLockUnlockTransactionState}
          isAccountLocked={isAccountLocked}
        />

        {/* Footer Information */}
        <div className='border-t border-white pt-3 mt-4'>
          <div className='text-gray-400 font-mono text-xs space-y-1'>
            <p>* Lock account to enable betting mode</p>
            <p>* No deposits/withdrawals while betting</p>
          </div>
        </div>
      </div>
    );
  }

  // LOCKED STATE: Betting Interface
  return (
    <div className='bg-black border-2 border-white p-4 relative flex-shrink-0'>
      <BreathingSpinner />

      {/* Header */}
      <div className='border-b border-white pb-3 mb-4'>
        <h3 className='text-white font-mono font-bold text-lg'>
          Betting Interface
        </h3>
        <div className='text-white font-mono text-sm mt-2'>
          Deposited USDC:{' '}
          {unlockCountdown !== null ? (
            <UnlockCountdown />
          ) : isLoadingBalances || virtualUsdcBalance === 0 ? (
            <span className='animate-pulse text-yellow-400'>Loading...</span>
          ) : (
            <span className='text-green-400'>
              {formatUsdcDisplay(virtualUsdcBalance)}
            </span>
          )}
        </div>        
      </div>

      {/* Game Status Warning */}
      {!bettingAllowed && (
        <div className='mb-4 p-3 bg-black border border-orange-500 rounded'>
          <p className='text-orange-400 font-mono text-sm text-center'>
            Game in progress...
          </p>
          <p className='text-orange-400 font-mono text-sm text-center'>
            Betting Closed.
          </p>
        </div>
      )}

      {/* Available Players for Betting */}
      {!bettingAllowed && availableForBetting.length > 0 && (
        <div className='space-y-3 mb-4'>
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
                loading={loading}
              />
            );
          })}
        </div>
      )}

      {/* Unlock Account Button */}
      <LockOperations
        startSpinner={startSpinner}
        startLockRefresh={startLockRefresh}
        stopTransactionState={stopLockUnlockTransactionState}
        isAccountLocked={isAccountLocked}
      />

      {/* Footer Information */}
      <div className='border-t border-white pt-3 mt-4'>
        <div className='text-gray-400 font-mono text-xs space-y-1'>
          <p>* Betting only allowed before game starts</p>
          <p>* Winnings distributed after game ends</p>
          <p>* Unlock to manage balance again</p>
        </div>
      </div>
    </div>
  );
}
