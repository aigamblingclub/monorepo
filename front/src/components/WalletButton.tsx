import { useAuth } from '@/providers/AuthProvider';
import '@near-wallet-selector/modal-ui/styles.css';

export function WalletButton() {
  const { isAuthenticated, isLoading, error, accountId, login, logout } =
    useAuth();

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-4'>
        <div className='animate-[spin_3s_linear_infinite] h-6 w-6 border-2'></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <button
        onClick={logout}
        className='px-4 py-2 border font-mono font-semibold text-sm border-[var(--border-width)] rounded-[var(--border-radius-element)] border-[var(--theme-primary)] transition-all duration-300 ease-in-out cursor-pointer bg-[var(--surface-secondary)] text-[var(--theme-primary)] shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)]'
      >
        {accountId?.slice(0, 10)}...
      </button>
    );
  }

  return (
    <div className='flex flex-col items-center gap-4'>
      {error && (
        <div className='p-4 text-sm text-red-600 bg-red-50 rounded-md'>
          {error}
        </div>
      )}
      <button
        onClick={login}
        className='px-4 py-2 font-mono font-semibold text-sm border border-[var(--border-width)] rounded-[var(--border-radius-element)] border-[var(--theme-primary)] transition-all duration-300 ease-in-out cursor-pointer bg-[var(--surface-secondary)] text-[var(--theme-primary)] shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)]'
      >
        Connect Wallet
      </button>
    </div>
  );
}
