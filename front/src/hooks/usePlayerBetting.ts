import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerBet } from '../components/BettingPanel';
import { useNearWallet } from './useNearWallet';
import { useAuth } from '@/providers/AuthProvider';

interface BetResponse {
  playerId: string;
  totalContractBet: number;
  userContractBet: number;
}

interface AllBetsResponse {
  playerBets: BetResponse[];
  userTotalBets: number;
  totalBetsByPlayer: Record<string, number>;
  totalBets: number;
}

export const usePlayerBetting = () => {
  const { accountId } = useNearWallet();
  const { user, apiKey } = useAuth();
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  const isConnected = !!accountId;

  useEffect(() => {
    if (user && apiKey) {
      const getBalance = async () => {
        const data = await fetch('/api/balance', {
          headers: {
            "x-api-key": apiKey || "",
          },
        });

        const balanceData = await data.json();
        setUserBalance(balanceData.balance);
      }
      getBalance();
    }
  }, [user, apiKey]);

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
      // Update state with fetched data
      setPlayerBets(data.playerBets);
      setUserBalance(data.userTotalBets);

    } catch (err) {
      console.error('❌ Error fetching betting data:', err);
      setError('Failed to load betting data');
      setPlayerBets([]);
      setUserBalance(0);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [accountId, apiKey]);

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
      fetchData();
    }
  }, [accountId, apiKey, loading, initialized, fetchData]);

  return useMemo(() => ({
    playerBets,
    userBalance,
    loading,
    error,
    placeBet,
    isConnected,
  }), [playerBets, userBalance, loading, error, placeBet, isConnected]);
}; 