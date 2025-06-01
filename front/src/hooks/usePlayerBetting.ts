import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerBet } from '../components/AccountManager';
import { useNearWallet } from './useNearWallet';
import { useAuth } from '@/providers/AuthProvider';

interface BetResponse {
  playerId: string;
  totalBet: number; // total bet amount of the player in the table
  totalUserBet: number; // total bet amount of the user in the table in the playerId
}

interface AllBetsResponse {
  success: boolean;
  playerBets: BetResponse[];
  totalBetsByPlayer: Record<string, number>; // total bets in the table by playerId
  totalBets: number; // total bet of the table
  error?: string;
}

export const usePlayerBetting = () => {
  const { accountId, getUsdcWalletBalance } = useNearWallet();
  const { user, apiKey } = useAuth();
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  const isConnected = !!accountId;

  const getBalance = useCallback(async () => {
    if (user && apiKey) {
      const data = await fetch('/api/balance', {
        headers: {
          "x-api-key": apiKey || "",
        },
      });
      const balanceData = await data.json();
      setUserBalance(balanceData.balance);
    }
  }, [user, apiKey]);

  const getUsdcBalance = useCallback(async () => {
    if (accountId && getUsdcWalletBalance) {
      try {
        console.log("🔍 Fetching USDC balance for:", accountId);
        const balance = await getUsdcWalletBalance(accountId);
        console.log("🔍 USDC balance result:", balance);
        
        // USDC typically has 6 decimal places, so we need to format it properly
        const balanceStr = balance?.toString() || "0";
        const balanceNum = parseFloat(balanceStr);
        
        // If balance is a large number, assume it's in smallest units (micro USDC)
        // and convert to readable USDC (divide by 1,000,000)
        if (balanceNum > 1000000) {
          const formattedBalance = (balanceNum / 1000000).toFixed(2);
          setUsdcBalance(formattedBalance);
        } else {
          // If it's already in USDC format, just use it
          setUsdcBalance(balanceNum.toFixed(2));
        }
      } catch (error) {
        console.error("❌ Error fetching USDC balance:", error);
        setUsdcBalance("0.00");
      }
    } else {
      setUsdcBalance("0.00");
    }
  }, [accountId]);

  const fetchData = useCallback(async () => {
    if (!accountId || !apiKey) {
      console.log("⚠️ Not fully connected", { accountId, hasApiKey: !!apiKey });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("📡 Fetching betting data...");

      // Fetch all bets data
      const response = await fetch('/api/bet/all', {
        headers: {
          "x-api-key": apiKey,
        }
      });
      console.log("🔍 response fetching betting data", response);
      if (!response.ok) {
        throw new Error('Failed to fetch betting data');
      }

      const data: AllBetsResponse = await response.json();
      console.log("🔍 data fetching betting data", data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch betting data');
      }

      // Convert BetResponse to PlayerBet format
      const formattedBets: PlayerBet[] = data.playerBets.map(bet => ({
        playerId: bet.playerId,
        totalBet: bet.totalBet,
        betAmount: bet.totalUserBet
      }));

      // Update state with fetched data
      setPlayerBets(formattedBets);
      getBalance();
      getUsdcBalance();

    } catch (err) {
      console.error('❌ Error fetching betting data:', err);
      setError('Failed to load betting data');
      setPlayerBets([]);
      setUserBalance(0);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [accountId, apiKey, getBalance, getUsdcBalance]);

  const placeBet = useCallback(async (playerId: string, amount: number) => {
    if (!accountId || !apiKey) {
      console.error("❌ Cannot place bet: not connected");
      setError('Not connected');
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`💸 Placing bet of ${amount} on player ${playerId}`);
      
      const response = await fetch('/api/bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          playerId,
          amount,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to place bet');
      }

      // Refresh data after bet is placed
      await fetchData();
      
      return true;
    } catch (err) {
      console.error('❌ Error placing bet:', err);
      setError('Failed to place bet');
      return false;
    } finally {
      setLoading(false);
    }
  }, [accountId, apiKey, fetchData]);

  useEffect(() => {
    if (accountId && apiKey && !loading && !initialized) {
      getBalance();
      getUsdcBalance();
      fetchData();  
    }
  }, [accountId, apiKey, loading, initialized]);

  return useMemo(() => ({
    playerBets,
    userBalance,
    usdcBalance,
    loading,
    error,
    placeBet,
    isConnected,
  }), [playerBets, userBalance, usdcBalance, loading, error, placeBet, isConnected]);
}; 