'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface WalletInfo {
  address?: string;
  isConnected: boolean;
  balance?: string;
  network?: string;
}

interface FarcasterWalletProps {
  onWalletChange?: (wallet: WalletInfo | null) => void;
}

export default function FarcasterWallet({ onWalletChange }: FarcasterWalletProps) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    try {
      // Check if wallet is already connected using ethProvider
      const accounts = await sdk.wallet.ethProvider.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        const walletInfo: WalletInfo = {
          address: accounts[0],
          isConnected: true,
          network: 'Ethereum',
        };
        setWallet(walletInfo);
        onWalletChange?.(walletInfo);
      }
    } catch (error) {
      console.error('Failed to check wallet connection:', error);
    }
  };

  const connectWallet = async () => {
    if (!sdk) {
      setError('Farcaster SDK not available. Please open in Farcaster app.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request wallet connection using ethProvider
      const accounts = await sdk.wallet.ethProvider.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        console.log('🎉 Wallet connected:', accounts[0]);
        
        const walletInfo: WalletInfo = {
          address: accounts[0],
          isConnected: true,
          network: 'Ethereum',
        };

        setWallet(walletInfo);
        onWalletChange?.(walletInfo);
      }
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    onWalletChange?.(null);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (wallet?.isConnected) {
    return (
      <div className="bg-green-900/30 border border-green-400 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">₿</span>
            </div>
            <div>
              <p className="text-green-100 font-medium">
                {wallet.address && formatAddress(wallet.address)}
              </p>
              <p className="text-green-300 text-sm">
                {wallet.network} Wallet Connected
              </p>
            </div>
          </div>
          <button
            onClick={disconnectWallet}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orange-900/30 border border-orange-400 rounded-lg p-4 mb-4">
      <div className="text-center">
        <h3 className="text-orange-100 font-semibold mb-2">Connect Wallet</h3>
        <p className="text-orange-300 text-sm mb-4">
          Connect your Ethereum wallet to participate in games
        </p>
        
        {error && (
          <div className="bg-red-900/50 border border-red-400 rounded p-2 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
        
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="w-full bg-orange-600 text-white py-2 px-4 rounded font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isConnecting ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Connecting...
            </span>
          ) : (
            '💳 Connect Wallet'
          )}
        </button>
        
        <p className="text-orange-400 text-xs mt-2">
          Uses Farcaster's embedded wallet or external wallet
        </p>
      </div>
    </div>
  );
} 