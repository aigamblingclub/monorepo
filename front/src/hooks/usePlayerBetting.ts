import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerBet } from '../components/AccountManager';
import { useNearWallet } from './useNearWallet';
import { useAuth } from '@/providers/AuthProvider';
import { isDev } from '@/utils/env';
import { atomicToDecimal } from '@/utils/currency';

interface BetResponse {
  playerId: string;
  totalBet: number;      // Total bet amount in atomic units
  totalUserBet: number;  // User's bet amount in atomic units
}

interface AllBetsResponse {
  success: boolean;
  playerBets: BetResponse[];
  totalBetsByPlayer: Record<string, number>;  // Amounts in atomic units
  totalBets: number;  // Total in atomic units
  error?: string;
}

export const usePlayerBetting = () => {
  const { accountId, getUsdcWalletBalance } = useNearWallet();
  const { user, apiKey } = useAuth();
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);  // Atomic units
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  const isConnected = !!accountId;

  const getBalance = useCallback(async () => {
    if (user && apiKey) {
      const data = await fetch('/api/balance', {
        headers: {
          'x-api-key': apiKey || '',
        },
      });
      const balanceData = await data.json();
      setUserBalance(balanceData.balance);  // Already in atomic units from backend
    }
  }, [user, apiKey]);

  const getUsdcBalance = useCallback(async () => {
    if (accountId && getUsdcWalletBalance) {
      try {
        const balance = await getUsdcWalletBalance(accountId);
        const balanceNum = parseInt(balance?.toString() || '0');
        setUsdcBalance(atomicToDecimal(balanceNum));
      } catch (error) {
        if (isDev) {
          console.error("[getUsdcBalance] Error:", error);
        }
        setUsdcBalance('0.00');
      }
    } else {
      setUsdcBalance('0.00');
    }
  }, [accountId, getUsdcWalletBalance]);

  const fetchData = useCallback(async () => {
    if (!accountId || !apiKey) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/bet/all', {
        headers: {
          'x-api-key': apiKey,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch betting data');
      }

      const data: AllBetsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch betting data');
      }

      // Convert BetResponse to PlayerBet format (all values already in atomic units)
      const formattedBets: PlayerBet[] = data.playerBets.map(bet => ({
        playerId: bet.playerId,
        totalBet: bet.totalBet,
        betAmount: bet.totalUserBet,
      }));

      setPlayerBets(formattedBets);
      getBalance();
      getUsdcBalance();
    } catch (err) {
      if (isDev) {
        console.error("[fetchData] Error:", err);
      }
      setError('Failed to load betting data');
      setPlayerBets([]);
      setUserBalance(0);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [accountId, apiKey, getBalance, getUsdcBalance]);

  const placeBet = useCallback(
    async (playerId: string, amount: number) => {  // amount should be in atomic units
      if (!accountId || !apiKey) {
        setError('Not connected');
        return false;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/bet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            playerId,
            amount,  // Send atomic units to backend
          }),
        });

        if (!response.ok) {
          if (isDev) {
            console.error("[placeBet] Error:", response);
          }
          throw new Error('Failed to place bet');
        }

        await fetchData();
        return true;
      } catch (err) {
        if (isDev) {
          console.error("[placeBet] Error:", err);
        }
        setError('Failed to place bet');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [accountId, apiKey, fetchData]
  );

  useEffect(() => {
    if (accountId && apiKey && !loading && !initialized) {
      getBalance();
      getUsdcBalance();
      fetchData();
    }
  }, [accountId, apiKey, loading, initialized, getBalance, getUsdcBalance, fetchData]);

  return useMemo(
    () => ({
      playerBets,
      userBalance,    // Atomic units
      usdcBalance,    // Formatted string with 2 decimals
      loading,
      error,
      placeBet,      // Expects atomic units
      isConnected,
    }),
    [
      playerBets,
      userBalance,
      usdcBalance,
      loading,
      error,
      placeBet,
      isConnected,
    ]
  );
};
