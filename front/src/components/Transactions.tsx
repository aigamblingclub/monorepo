import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useNearWallet } from '@/hooks/useNearWallet';
import { TransactionInput } from './TransactionInput';
import { NEXT_PUBLIC_CONTRACT_ID, NEXT_PUBLIC_USDC_CONTRACT_ID } from "@/utils/env";

interface TransactionsProps {
  startSpinner: () => void;
  startBalanceRefresh: () => NodeJS.Timeout;
  stopTransactionState: (intervalId?: NodeJS.Timeout) => void;
}

export function Transactions({ startSpinner, startBalanceRefresh, stopTransactionState }: TransactionsProps) {
  const { accountId } = useAuth();
  const { callMethod } = useNearWallet();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isLoadingDeposit, setIsLoadingDeposit] = useState(false);
  const [isLoadingWithdraw, setIsLoadingWithdraw] = useState(false);
  const [errorDeposit, setErrorDeposit] = useState<string | null>(null);
  const [errorWithdraw, setErrorWithdraw] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      setErrorDeposit('Please enter a valid amount');
      return;
    }
    
    let refreshInterval: NodeJS.Timeout | undefined;
    
    try {
      setIsLoadingDeposit(true);
      setErrorDeposit(null);
      
      // Start spinner immediately for visual feedback
      startSpinner();

      const transferAmount = (Number(depositAmount) * 1_000_000).toString();
      await callMethod({
        methodName: "ft_transfer_call",
        args: {
          receiver_id: NEXT_PUBLIC_CONTRACT_ID,
          amount: transferAmount,
          msg: "Deposit to AI Gambling Club",
        },
        deposit: "1",
        receiverId: NEXT_PUBLIC_USDC_CONTRACT_ID,
      });
      
      // Only start balance refresh after successful transaction
      refreshInterval = startBalanceRefresh();
      setDepositAmount('');
    } catch (err) {
      setErrorDeposit(err instanceof Error ? err.message : 'Failed to deposit');
    } finally {
      setIsLoadingDeposit(false);
      // Stop spinner and balance refresh
      stopTransactionState(refreshInterval);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      setErrorWithdraw('Please enter a valid amount');
      return;
    }
    
    let refreshInterval: NodeJS.Timeout | undefined;
    
    try {
      setIsLoadingWithdraw(true);
      setErrorWithdraw(null);
      
      // Start spinner immediately for visual feedback
      startSpinner();

      const transferAmount = (Number(withdrawAmount) * 1_000_000).toString();
      await callMethod({
        methodName: "withdrawUsdc",
        args: {
          amount: transferAmount,
        },
        deposit: "0",
        receiverId: NEXT_PUBLIC_CONTRACT_ID,
      });

      // Only start balance refresh after successful transaction
      refreshInterval = startBalanceRefresh();
      setWithdrawAmount("");
    } catch (err) {
      setErrorWithdraw(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setIsLoadingWithdraw(false);
      // Stop spinner and balance refresh
      stopTransactionState(refreshInterval);
    }
  };

  return (
    <div className="mb-4">
      <TransactionInput
        id="deposit"
        value={depositAmount}
        onChange={(e) => setDepositAmount(e.target.value)}
        onAction={handleDeposit}
        isLoading={isLoadingDeposit}
        isDisabled={isLoadingDeposit || !accountId}
        error={errorDeposit}
        actionLabel="Deposit"
      />
      <TransactionInput
        id="withdraw"
        value={withdrawAmount}
        onChange={(e) => setWithdrawAmount(e.target.value)}
        onAction={handleWithdraw}
        isLoading={isLoadingWithdraw}
        isDisabled={isLoadingWithdraw || !accountId}
        error={errorWithdraw}
        actionLabel="Withdraw"
      />
    </div>
  );
} 