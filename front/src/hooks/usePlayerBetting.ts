import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerBet } from '../components/BettingPanel';
import { parseNearAmount } from 'near-api-js/lib/utils/format';
import { useNearWallet } from './useNearWallet';

interface UsePlayerBettingProps {
  isConnected?: boolean;
  accountId?: string | null;
  contractId: string;
}

export const usePlayerBetting = ({
  contractId,
}: UsePlayerBettingProps) => {
  // Use the Near Wallet hook directly
  const { accountId, selector, viewMethod, getUsdcContractBalance, getNearBalance, callWriteMethod } = useNearWallet();
  
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Check if user is logged in - using accountId from useNearWallet
  const isConnected = !!accountId;

  // Fetch player bets and user balance
  const fetchData = useCallback(async () => {
    if (!accountId || !selector) {
      console.log("⚠️ Not fully connected to NEAR wallet", { accountId, hasSelector: !!selector });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log("📡 Fetching data from NEAR contract...");

      // Call contract to get player bets
      // try {
      //   // Use viewMethod from useNearWallet
      //   const rawResponse = await viewMethod('getPlayerBets', {})
      //     .catch(() => null);
          
      //   console.log("Raw response:", rawResponse);
      // } catch (viewError) {
      //   console.error("❌ Error getting player bets, using mock data:", viewError);
      //   setPlayerBets([]);
      // }
      
      // Get user balance in USDC from contract
      try {
        const nearBalance = await getNearBalance();
        console.log("💰 Near balance:", nearBalance);
        const usdcBalanceRaw = await getUsdcContractBalance();
        console.log("💵 USDC balance (raw):", usdcBalanceRaw);
        // USDC normalmente tem 6 casas decimais, mas pode vir como string
        const usdcBalance = Number(usdcBalanceRaw) / 1e6;
        setUserBalance(usdcBalance);
      } catch (balanceError) {
        console.error("❌ Error getting USDC contract balance:", balanceError);
        setUserBalance(0);
      }

      // ---
      // NEAR balance (not used)
      // try {
      //   const balance = await getBalance();
      //   console.log("💰 Raw balance response:", balance);
      //   if (balance) {
      //     // Convert from yoctoNEAR to NEAR and format to 6 decimal places
      //     const balanceInNear = Number((parseFloat(balance) / Math.pow(10, 24)).toFixed(6));
      //     setUserBalance(balanceInNear);
      //   } else {
      //     setUserBalance(0);
      //   }
      // } catch (balanceError) {
      //   console.error("❌ Error getting real balance:", balanceError);
      //   setUserBalance(0);
      // }
      // ---
      
    } catch (err) {
      console.error('❌ Error fetching betting data:', err);
      setError('Failed to load betting data');
      setPlayerBets([]);
      setUserBalance(0);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [accountId, selector, viewMethod, getUsdcContractBalance]);

  // Place a bet on a player
  const placeBet = useCallback(async (playerId: string, amount: number) => {
    if (!accountId || !selector) {
      console.error("❌ Cannot place bet: not connected to NEAR wallet");
      setError('Wallet not connected');
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`💸 Placing bet of ${amount} on player ${playerId}`);
      
      try {
        // Call contract method to place bet using the new callWriteMethod
        const amountInYocto = parseNearAmount(amount.toString());
        
        console.log("📝 Calling contract with:", {
          contractId,
          playerId,
          amount,
          yoctoAmount: amountInYocto
        });
        
        await callWriteMethod(
          contractId,
          'placeBet',
          {
            player_id: playerId,
            amount: amount.toString(),
          },
          amountInYocto || '0'
        );
        
        console.log("✅ Bet placed successfully");
      } catch (contractError) {
        console.error("❌ Contract error, updating UI with mock data for development:", contractError);
        
        // For development: update the UI as if the bet was placed
        setPlayerBets(prev => {
          const updatedBets = [...prev];
          const existingBetIndex = updatedBets.findIndex(bet => bet.playerId === playerId);
          
          if (existingBetIndex >= 0) {
            updatedBets[existingBetIndex] = {
              ...updatedBets[existingBetIndex],
              totalContractBet: updatedBets[existingBetIndex].totalContractBet + amount,
              userContractBet: updatedBets[existingBetIndex].userContractBet + amount
            };
          } else {
            updatedBets.push({
              playerId,
              totalContractBet: amount,
              userContractBet: amount
            });
          }
          
          return updatedBets;
        });
        
        // Reduce balance for UI
        setUserBalance(prev => prev - amount);
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
  }, [accountId, selector, contractId, fetchData, callWriteMethod]);

  // Load data only when necessary
  useEffect(() => {
    if (accountId && selector && !loading && !initialized) {
      fetchData();
    }
  }, [accountId, selector, loading, initialized, fetchData]);

  // Memoize the return value
  return useMemo(() => ({
    playerBets,
    userBalance,
    loading,
    error,
    placeBet,
    isConnected,
  }), [playerBets, userBalance, loading, error, placeBet, isConnected]);
}; 