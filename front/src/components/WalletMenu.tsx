/**
 * Wallet Menu Component
 *
 * This component provides a hamburger-style dropdown menu for authenticated users
 * showing wallet information, balances, and logout functionality with a terminal aesthetic.
 *
 * @module WalletMenu
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useNearWallet } from '@/hooks/useNearWallet';
import { formatUsdcDisplay } from '@/utils/usdcBalance';
import '@near-wallet-selector/modal-ui/styles.css';
import { isDev } from '@/utils/env';

/**
 * Formats NEAR balance from yoctoNEAR to readable NEAR format
 * @param {string} yoctoNearBalance - Balance in yoctoNEAR (smallest unit)
 * @returns {string} Formatted NEAR balance with 4 decimal places
 */
function formatNearBalance(yoctoNearBalance: string): string {
  try {
    const balance = parseFloat(yoctoNearBalance);
    if (isNaN(balance)) return '0.0000';

    // Convert from yoctoNEAR (10^24) to NEAR
    const nearAmount = balance / Math.pow(10, 24);
    return nearAmount.toFixed(4);
  } catch (error) {
    if (isDev) {
      console.error("[formatNearBalance] Error:", error);
    }
    return '0.0000';
  }
}

/**
 * Wallet Menu Component
 *
 * Displays a dropdown menu when authenticated showing:
 * - Full NEAR account ID
 * - NEAR balance
 * - Virtual USDC balance on AGC contract
 * - Terminal-style logout option
 *
 * @returns {JSX.Element} The wallet menu component
 */
export function WalletMenu() {
  const { isAuthenticated, isLoading, error, accountId, apiKey, login, logout } =
    useAuth();
  const { getNearBalance, getUsdcWalletBalance, getAgcUsdcBalance, getIsUsdcLocked, getVirtualUsdcBalance } =
    useNearWallet();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [nearBalance, setNearBalance] = useState<string>('0');
  const [walletUsdcBalance, setWalletUsdcBalance] = useState<string>('0');
  const [agcUsdcBalance, setAgcUsdcBalance] = useState<string>('0');
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Memoized function to fetch and update wallet balances
   * Gets NEAR balance, wallet USDC balance, and AGC deposited USDC balance
   */
  const fetchBalances = useCallback(async () => {
    if (!accountId || !isAuthenticated || !apiKey) return;

    setIsLoadingBalances(true);
    try {
      // Fetch NEAR balance
      const nearBal = await getNearBalance();
      setNearBalance(nearBal);

      // Fetch USDC wallet balance
      const usdcBal = await getUsdcWalletBalance(accountId);
      setWalletUsdcBalance(usdcBal);

      let balance;
      if(await getIsUsdcLocked(accountId)) {
        balance = await getVirtualUsdcBalance(apiKey);
      } else {
       balance = await getAgcUsdcBalance(accountId);
      }
      setAgcUsdcBalance(balance);
    } catch (error) {
      if (isDev) {
        console.error("[fetchBalances] Error:", error);
      }
      setNearBalance('0');
      setWalletUsdcBalance('0');
      setAgcUsdcBalance('0');
    } finally {
      setIsLoadingBalances(false);
    }
  }, [accountId, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Effect to fetch balances when menu opens
   */
  useEffect(() => {
    if (isMenuOpen && isAuthenticated && apiKey) {
      fetchBalances();
    }
  }, [isMenuOpen, isAuthenticated, apiKey, fetchBalances]);

  /**
   * Effect to handle clicking outside menu to close it
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  /**
   * Handles logout with menu closure
   */
  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  /**
   * Toggles menu open/closed state
   */
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-4'>
        <div className='animate-[spin_3s_linear_infinite] h-6 w-6 border-2 border-[var(--theme-primary)] rounded-full border-t-transparent'></div>
      </div>
    );
  }

  // Unauthenticated state - show connect button
  if (!isAuthenticated) {
    return (
      <div className='flex flex-col items-center gap-4'>
        {error && (
          <div className='p-4 text-sm text-red-600 bg-red-50 rounded-md'>
            {error}
          </div>
        )}
        <button
          onClick={login}
          className='px-4 py-2 font-mono font-semibold text-sm border border-[var(--border-width)] rounded-[var(--border-radius-element)] border-[var(--theme-primary)] transition-all duration-300 ease-in-out cursor-pointer bg-[var(--surface-secondary)] text-[var(--theme-primary)] shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-black'
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // Authenticated state - show wallet menu
  return (
    <div className='relative' ref={menuRef}>
      {/* Wallet Button / Hamburger Trigger */}
      <button
        onClick={toggleMenu}
        className={`px-4 py-2 border font-mono font-semibold text-sm border-[var(--border-width)] rounded-[var(--border-radius-element)] border-[var(--theme-primary)] transition-all duration-300 ease-in-out cursor-pointer shadow-[0_0_var(--shadow-strength)_var(--theme-primary),inset_0_0_var(--shadow-inner-strength)_var(--theme-primary)] [text-shadow:0_0_var(--text-shadow-strength)_var(--theme-primary)] flex items-center gap-2 relative z-[10000] ${
          isMenuOpen
            ? 'bg-[var(--theme-primary)] text-black'
            : 'bg-[var(--surface-secondary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-black'
        }`}
      >
        <span>{accountId}</span>
        {/* Hamburger Icon */}
        <div className='flex flex-col gap-0.5'>
          <div
            className={`w-3 h-0.5 bg-current transition-transform duration-200 ${isMenuOpen ? 'rotate-45 translate-y-1' : ''}`}
          ></div>
          <div
            className={`w-3 h-0.5 bg-current transition-opacity duration-200 ${isMenuOpen ? 'opacity-0' : ''}`}
          ></div>
          <div
            className={`w-3 h-0.5 bg-current transition-transform duration-200 ${isMenuOpen ? '-rotate-45 -translate-y-1' : ''}`}
          ></div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className='absolute right-0 top-full mt-2 w-80 bg-black border-2 border-white rounded p-4 z-[9999]'>
          {/* Header */}
          <div className='border-b border-white pb-3 mb-4'>
            <h3 className='text-white font-mono font-bold text-lg'>
              Wallet Info
            </h3>
          </div>

          {/* Account ID */}
          <div className='mb-4'>
            <label className='block text-white font-mono text-sm mb-1'>
              Account ID:
            </label>
            <div className='bg-black border border-white rounded px-3 py-2 font-mono text-sm text-white break-all'>
              {accountId}
            </div>
          </div>

          {/* Balances Section */}
          <div className='space-y-3 mb-4'>
            {/* NEAR Balance */}
            <div>
              <label className='block text-white font-mono text-sm mb-1'>
                NEAR Balance:
              </label>
              <div className='bg-black border border-white rounded px-3 py-2 font-mono text-sm text-white'>
                {isLoadingBalances ? (
                  <span className='animate-pulse'>Loading...</span>
                ) : (
                  <span className='text-green-400'>{`${formatNearBalance(nearBalance)} NEAR`}</span>
                )}
              </div>
            </div>

            {/* Wallet USDC Balance */}
            <div>
              <label className='block text-white font-mono text-sm mb-1'>
                Wallet USDC:
              </label>
              <div className='bg-black border border-white rounded px-3 py-2 font-mono text-sm text-white'>
                {isLoadingBalances ? (
                  <span className='animate-pulse'>Loading...</span>
                ) : (
                  <span className='text-green-400'>
                    {formatUsdcDisplay(walletUsdcBalance)}
                  </span>
                )}
              </div>
            </div>

            {/* Deposited USDC Balance */}
            <div>
              <label className='block text-white font-mono text-sm mb-1'>
                Deposited USDC:
              </label>
              <div className='bg-black border border-white rounded px-3 py-2 font-mono text-sm text-white'>
                {isLoadingBalances ? (
                  <span className='animate-pulse'>Loading...</span>
                ) : (
                  <span className='text-green-400'>
                    {formatUsdcDisplay(agcUsdcBalance)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Logout Button with Terminal Style */}
          <div className='border-t border-white pt-4'>
            <button
              onClick={handleLogout}
              className='w-full bg-black border border-red-500 rounded px-4 py-3 font-mono text-sm text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 flex items-center justify-center gap-3 group'
            >
              {/* Terminal Icon */}
              <div className='relative'>
                <div className='w-5 h-4 border border-current rounded-sm'>
                  <div className='absolute top-0.5 left-0.5 w-1 h-1 bg-current rounded-full'></div>
                  <div className='absolute top-1.5 left-0.5 right-0.5 h-0.5 bg-current'></div>
                  <div className='absolute bottom-0.5 left-0.5 w-2 h-0.5 bg-current'></div>
                </div>
                <div className='absolute -top-0.5 -right-0.5 w-1.5 h-1.5 border border-current rounded-full bg-current'></div>
              </div>
              <span>logout --session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
