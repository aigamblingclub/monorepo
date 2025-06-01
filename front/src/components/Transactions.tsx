import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useNearWallet } from '@/hooks/useNearWallet';
import { TransactionInput } from './TransactionInput';
import { NEXT_PUBLIC_CONTRACT_ID } from "@/utils/env";

export function Transactions() {
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
    try {
      setIsLoadingDeposit(true);
      setErrorDeposit(null);

      const transferAmount = (Number(depositAmount) * 1_000_000).toString();
      await callMethod({
        methodName: "ft_transfer_call",
        args: {
          receiver_id: NEXT_PUBLIC_CONTRACT_ID,
          amount: transferAmount,
          msg: "Deposit to AI Gambling Club",
        },
        deposit: "1",
        receiverId: process.env.NEXT_PUBLIC_CONTRACT_USDC!,
      });
      setDepositAmount('');
    } catch (err) {
      setErrorDeposit(err instanceof Error ? err.message : 'Failed to deposit');
    } finally {
      setIsLoadingDeposit(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      setErrorWithdraw('Please enter a valid amount');
      return;
    }
    try {
      setIsLoadingWithdraw(true);
      setErrorWithdraw(null);

      // TODO: withdraw usdc from the contract
      // const transferAmount = (Number(withdrawAmount) * 1_000_000).toString();
      // await callMethod({
      //   methodName: "withdrawUsdc",
      //   args: {
      //     amount: transferAmount,
      //   },
      //   deposit: "0",
      //   receiverId: NEXT_PUBLIC_CONTRACT_ID,
      // });

      // TODO TEST
      // Call the internal withdraw API route
      const response = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: withdrawAmount,
          nearImplicitAddress: accountId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to withdraw");
      }

      const { signature, gameResult } = await response.json();

      // Call the contract method to execute the withdrawal
      await callMethod({
        methodName: "withdrawUsdc",
        args: {
          signature,
          gameResult,
        },
        deposit: "0",
        receiverId: NEXT_PUBLIC_CONTRACT_ID,
      });

      setWithdrawAmount("");
    } catch (err) {
      setErrorWithdraw(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setIsLoadingWithdraw(false);
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