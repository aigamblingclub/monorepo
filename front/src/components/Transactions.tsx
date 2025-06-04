import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useNearWallet } from '@/hooks/useNearWallet';
import { TransactionInput } from './TransactionInput';
import {
  NEXT_PUBLIC_CONTRACT_ID,
  NEXT_PUBLIC_USDC_CONTRACT_ID,
} from '@/utils/env';

interface TransactionsProps {
  startSpinner: () => void;
  startBalanceRefresh: () => NodeJS.Timeout;
  stopTransactionState: (intervalId?: NodeJS.Timeout) => void;
}

export function Transactions({
  startSpinner,
  startBalanceRefresh,
  stopTransactionState,
}: TransactionsProps) {
  const { accountId } = useAuth();
  const { callMethod } = useNearWallet();
  // Values are stored in atomic units (from TransactionInput)
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [isLoadingDeposit, setIsLoadingDeposit] = useState(false);
  const [isLoadingWithdraw, setIsLoadingWithdraw] = useState(false);
  const [errorDeposit, setErrorDeposit] = useState<string | null>(null);
  const [errorWithdraw, setErrorWithdraw] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (depositAmount <= 0) {
      setErrorDeposit('Please enter a valid amount');
      return;
    }

    let refreshInterval: NodeJS.Timeout | undefined;

    try {
      setIsLoadingDeposit(true);
      setErrorDeposit(null);
      startSpinner();

      // depositAmount is already in atomic units from TransactionInput
      await callMethod({
        methodName: 'ft_transfer_call',
        args: {
          receiver_id: NEXT_PUBLIC_CONTRACT_ID,
          amount: depositAmount.toString(),
          msg: 'Deposit to AI Gambling Club',
        },
        deposit: '1',
        receiverId: NEXT_PUBLIC_USDC_CONTRACT_ID,
      });

      refreshInterval = startBalanceRefresh();
      setDepositAmount(0);
    } catch (err) {
      setErrorDeposit(err instanceof Error ? err.message : 'Failed to deposit');
    } finally {
      setIsLoadingDeposit(false);
      stopTransactionState(refreshInterval);
    }
  };

  const handleWithdraw = async () => {
    if (withdrawAmount <= 0) {
      setErrorWithdraw('Please enter a valid amount');
      return;
    }

    let refreshInterval: NodeJS.Timeout | undefined;

    try {
      setIsLoadingWithdraw(true);
      setErrorWithdraw(null);
      startSpinner();

      // withdrawAmount is already in atomic units from TransactionInput
      await callMethod({
        methodName: 'withdrawUsdc',
        args: {
          amount: withdrawAmount.toString(),
        },
        deposit: '0',
        receiverId: NEXT_PUBLIC_CONTRACT_ID,
      });

      refreshInterval = startBalanceRefresh();
      setWithdrawAmount(0);
    } catch (err) {
      setErrorWithdraw(
        err instanceof Error ? err.message : 'Failed to withdraw'
      );
    } finally {
      setIsLoadingWithdraw(false);
      stopTransactionState(refreshInterval);
    }
  };

  return (
    <div className='mb-4'>
      <TransactionInput
        id='deposit'
        value={depositAmount}  // Atomic units
        onChange={setDepositAmount}  // Will receive atomic units from TransactionInput
        onAction={handleDeposit}
        isLoading={isLoadingDeposit}
        isDisabled={isLoadingDeposit || !accountId}
        error={errorDeposit}
        actionLabel='Deposit'
      />
      <TransactionInput
        id='withdraw'
        value={withdrawAmount}  // Atomic units
        onChange={setWithdrawAmount}  // Will receive atomic units from TransactionInput
        onAction={handleWithdraw}
        isLoading={isLoadingWithdraw}
        isDisabled={isLoadingWithdraw || !accountId}
        error={errorWithdraw}
        actionLabel='Withdraw'
      />
    </div>
  );
}
