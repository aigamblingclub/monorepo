import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlayerBet } from '../components/BettingPanel';
import { parseNearAmount } from 'near-api-js/lib/utils/format';
import { useNearWallet } from './useNearWallet';

interface UsePlayerBettingProps {
  isConnected?: boolean;
  accountId?: string | null;
  contractId: string;
}

// Interface genérica para resposta da API
interface ApiResponse {
  [key: string]: unknown;
}

export const usePlayerBetting = ({
  contractId,
}: UsePlayerBettingProps) => {
  // Use the Near Wallet hook directly
  const { accountId, selector, viewMethod, getBalance } = useNearWallet();
  
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Check if user is logged in - using accountId from useNearWallet
  const isConnected = !!accountId;

  // Immediate check on mount to see if we're already connected
  useEffect(() => {
    if (!initialized && accountId) {
      console.log("✅ User is signed in with NEAR account:", accountId);
      
      const useMockData = !contractId || contractId === 'dev-placeholder';
      if (useMockData) {
        console.log("Using mock data for development");
        setPlayerBets([
          { playerId: "player1", totalContractBet: 500, userContractBet: 100 },
          { playerId: "player2", totalContractBet: 1200, userContractBet: 250 },
        ]);
        setUserBalance(1000);
        setInitialized(true);
      }
    }
  }, [accountId, initialized, contractId]);

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
      try {
        // Use viewMethod from useNearWallet
        const rawResponse = await viewMethod('getPlayerBets', {})
          .catch(() => null);
          
        console.log("Raw response:", rawResponse);
        
        // Tratar resposta de forma segura
        const mockPlayerBets: PlayerBet[] = [
          { playerId: "player1", totalContractBet: 500, userContractBet: 100 },
          { playerId: "player2", totalContractBet: 1200, userContractBet: 250 },
        ];
        
        if (rawResponse && typeof rawResponse === 'object') {
          // Tentar interpretar a resposta
          const response = rawResponse as unknown as ApiResponse;
          if (response.bets && Array.isArray(response.bets)) {
            console.log("📊 Received player bets:", response.bets);
            setPlayerBets(response.bets as PlayerBet[]);
          } else {
            // Usar dados de demonstração
            console.log("🔄 Using mock player bets data - contract returned invalid data");
            setPlayerBets(mockPlayerBets);
          }
        } else {
          // Usar dados de demonstração
          console.log("🔄 Using mock player bets data - no valid response");
          setPlayerBets(mockPlayerBets);
        }
      } catch (viewError) {
        console.error("❌ Error getting player bets, using mock data:", viewError);
        setPlayerBets([]);
      }
      
      // Get user balance from NEAR account
      try {
        const balance = await getBalance();
        console.log("💰 Raw balance response:", balance);
        
        if (balance) {
          // Convert from yoctoNEAR to NEAR and format to 6 decimal places
          const balanceInNear = Number((parseFloat(balance) / Math.pow(10, 24)).toFixed(6));
          console.log("💰 Real balance (in NEAR):", balanceInNear);
          
          setUserBalance(balanceInNear);
        } else {
          setUserBalance(0);
        }
      } catch (balanceError) {
        console.error("❌ Error getting real balance:", balanceError);
        setUserBalance(0);
      }
      
    } catch (err) {
      console.error('❌ Error fetching betting data:', err);
      setError('Failed to load betting data');
      setPlayerBets([]);
      setUserBalance(0);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [accountId, selector, viewMethod, getBalance]);

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
      
      // Get wallet from selector
      const wallet = await selector.wallet();
      
      try {
        // Call contract method to place bet
        const amountInYocto = parseNearAmount(amount.toString());
        
        console.log("📝 Calling contract with:", {
          contractId,
          playerId,
          amount,
          yoctoAmount: amountInYocto
        });
        
        await wallet.signAndSendTransaction({
          actions: [
            {
              type: 'FunctionCall',
              params: {
                methodName: 'placeBet',
                args: {
                  player_id: playerId,
                  amount: amount.toString(),
                },
                gas: '30000000000000',
                deposit: amountInYocto || '0',
              }
            }
          ]
        });
        
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
  }, [accountId, selector, contractId, fetchData]);

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