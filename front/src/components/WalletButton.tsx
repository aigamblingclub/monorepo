import { useAuth } from '@/providers/AuthProvider';
import "@near-wallet-selector/modal-ui/styles.css";

export function WalletButton() {
  const { isAuthenticated, isLoading, error, accountId, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <button
        onClick={logout}
        className="wallet-button"
      >
        {accountId?.slice(0, 10)}...
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}
      <button
        onClick={login}
        className="wallet-button"
      >
        Connect Wallet
      </button>
    </div>
  );
} 