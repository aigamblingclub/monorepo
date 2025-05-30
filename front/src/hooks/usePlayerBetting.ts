import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerBet } from '../components/BettingPanel';
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
  const { accountId } = useNearWallet();
  const { user, apiKey } = useAuth();
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
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

    } catch (err) {
      console.error('❌ Error fetching betting data:', err);
      setError('Failed to load betting data');
      setPlayerBets([]);
      setUserBalance(0);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [accountId, apiKey, getBalance]);

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
      fetchData();  
    }
  }, [accountId, apiKey, loading, initialized, fetchData, getBalance]);

  return useMemo(() => ({
    playerBets,
    userBalance,
    loading,
    error,
    placeBet,
    isConnected,
  }), [playerBets, userBalance, loading, error, placeBet, isConnected]);
}; 