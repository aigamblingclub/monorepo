import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useNearWallet } from '@/hooks/useNearWallet';
import { NEXT_PUBLIC_CONTRACT_ID } from "@/utils/env";

interface LockOperationsProps {
  startSpinner: () => void;
  startLockRefresh: () => NodeJS.Timeout;
  stopTransactionState: (intervalId?: NodeJS.Timeout) => void;
  isAccountLocked: boolean;
}

export function LockOperations({ 
  startSpinner, 
  startLockRefresh,
  stopTransactionState, 
  isAccountLocked 
}: LockOperationsProps) {
  const { accountId } = useAuth();
  const { callMethod } = useNearWallet();
  const [isLoadingLock, setIsLoadingLock] = useState(false);
  const [isLoadingUnlock, setIsLoadingUnlock] = useState(false);
  const [errorLock, setErrorLock] = useState<string | null>(null);
  const [errorUnlock, setErrorUnlock] = useState<string | null>(null);

  const handleLock = async () => {
    if (!accountId || isAccountLocked) return;
    
    let refreshInterval: NodeJS.Timeout | undefined;
    
    try {
      setIsLoadingLock(true);
      setErrorLock(null);
      
      // Start spinner immediately for visual feedback
      startSpinner();

      await callMethod({
        methodName: 'lockUsdcBalance',
        args: {},
        deposit: '0',
        receiverId: NEXT_PUBLIC_CONTRACT_ID,
      });

      // Only start lock status refresh after successful transaction
      refreshInterval = startLockRefresh();

      console.log('Account locked for betting');
    } catch (err) {
      setErrorLock(err instanceof Error ? err.message : 'Failed to lock account');
    } finally {
      setIsLoadingLock(false);
      // Stop spinner and pass refresh interval
      stopTransactionState(refreshInterval);
    }
  };

  const handleUnlock = async () => {
    if (!accountId || !isAccountLocked) return;
    
    let refreshInterval: NodeJS.Timeout | undefined;
    
    try {
      setIsLoadingUnlock(true);
      setErrorUnlock(null);
      
      // Start spinner immediately for visual feedback
      startSpinner();
      
      // TODO: For manual unlock, we need to call the backend to get signed message
      // TODO: Call unlockUsdcBalance with message and signature
      // For now, just simulate the unlock
      console.log('Manual unlock not implemented yet - requires backend signature');
      
      // Only start lock status refresh after successful operation
      refreshInterval = startLockRefresh();
      
    } catch (err) {
      setErrorUnlock(err instanceof Error ? err.message : 'Failed to unlock account');
    } finally {
      setIsLoadingUnlock(false);
      // Stop spinner and pass refresh interval
      stopTransactionState(refreshInterval);
    }
  };

  if (isAccountLocked) {
    return (
      <div className="border-t border-white pt-4">
        <button
          onClick={handleUnlock}
          disabled={isLoadingUnlock || !accountId}
          className="w-full bg-black border border-blue-500 rounded px-4 py-3 font-mono text-sm text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Unlock Icon */}
          <div className="relative">
            <div className="w-4 h-3 border-2 border-current rounded-sm border-b-0 border-t-0"></div>
            <div className="w-5 h-3 border-2 border-current rounded-sm -mt-1"></div>
            <div className="absolute top-1 left-1.5 w-1 h-1 bg-current rounded-full"></div>
          </div>
          <span>{isLoadingUnlock ? 'Unlocking...' : 'unlock --enable-management'}</span>
        </button>
        {errorUnlock && (
          <div className="mt-2 p-2 bg-red-900 border border-red-500 rounded">
            <p className="text-red-400 font-mono text-xs">{errorUnlock}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-white pt-4">
      <button
        onClick={handleLock}
        disabled={isLoadingLock || !accountId}
        className="w-full bg-black border border-green-500 rounded px-4 py-3 font-mono text-sm text-green-400 hover:bg-green-500 hover:text-white transition-all duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Lock Icon */}
        <div className="relative">
          <div className="w-4 h-3 border-2 border-current rounded-sm border-b-0"></div>
          <div className="w-5 h-3 border-2 border-current rounded-sm -mt-1"></div>
          <div className="absolute top-1 left-1.5 w-1 h-1 bg-current rounded-full"></div>
        </div>
        <span>{isLoadingLock ? 'Locking...' : 'lock --enable-betting'}</span>
      </button>
      {errorLock && (
        <div className="mt-2 p-2 bg-red-900 border border-red-500 rounded">
          <p className="text-red-400 font-mono text-xs">{errorLock}</p>
        </div>
      )}
    </div>
  );
} 