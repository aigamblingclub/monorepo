'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterUser {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  isAuthenticated: boolean;
}

interface FarcasterAuthProps {
  onUserChange?: (user: FarcasterUser | null) => void;
}

export default function FarcasterAuth({ onUserChange }: FarcasterAuthProps) {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing authentication on mount
  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const token = sdk.quickAuth.token;
      if (token) {
        // Verify token and get user info
        // Note: In production, you'd validate this token on your server
        console.log('🔐 Found existing auth token');
        // For now, we'll set a basic authenticated state
        const authUser: FarcasterUser = {
          isAuthenticated: true,
          // These would come from token validation
          fid: undefined,
          username: 'Farcaster User',
        };
        setUser(authUser);
        onUserChange?.(authUser);
      }
    } catch (error) {
      console.error('Failed to check existing auth:', error);
    }
  };

  const connectFarcaster = async () => {
    if (!sdk) {
      setError('Farcaster SDK not available. Please open in Farcaster app.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get authentication token using Quick Auth
      const token = await sdk.quickAuth.getToken();
      
      if (token) {
        console.log('🎉 Successfully authenticated with Farcaster');
        
        // In production, you would:
        // 1. Send this token to your server
        // 2. Validate it with Farcaster's Auth Server
        // 3. Get user info and return it
        
        const authUser: FarcasterUser = {
          isAuthenticated: true,
          // These would come from token validation on your server
          fid: undefined,
          username: 'Farcaster User',
          displayName: 'Connected User',
        };

        setUser(authUser);
        onUserChange?.(authUser);
      }
    } catch (error: any) {
      console.error('Authentication failed:', error);
      setError(error.message || 'Failed to authenticate with Farcaster');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setUser(null);
    onUserChange?.(null);
    // In production, you'd also clear tokens and notify your server
  };

  if (user?.isAuthenticated) {
    return (
      <div className="bg-purple-900/30 border border-purple-400 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">FC</span>
            </div>
            <div>
              <p className="text-purple-100 font-medium">
                {user.displayName || user.username || 'Farcaster User'}
              </p>
              <p className="text-purple-300 text-sm">Connected to Farcaster</p>
            </div>
          </div>
          <button
            onClick={disconnect}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-900/30 border border-blue-400 rounded-lg p-4 mb-4">
      <div className="text-center">
        <h3 className="text-blue-100 font-semibold mb-2">Connect with Farcaster</h3>
        <p className="text-blue-300 text-sm mb-4">
          Connect your Farcaster account to access exclusive features
        </p>
        
        {error && (
          <div className="bg-red-900/50 border border-red-400 rounded p-2 mb-4">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
        
        <button
          onClick={connectFarcaster}
          disabled={isConnecting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isConnecting ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              Connecting...
            </span>
          ) : (
            '🔗 Connect Farcaster'
          )}
        </button>
        
        <p className="text-blue-400 text-xs mt-2">
          This uses Farcaster's Quick Auth for secure authentication
        </p>
      </div>
    </div>
  );
} 