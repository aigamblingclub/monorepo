"use client";

import { useState, useEffect } from 'react';
import { useNearWallet } from './useNearWallet';
import { AuthState } from '@/types/auth';

export function useNearAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    error: null,
    user: null,
    apiKey: null,
  });

  const { signIn, signOut: nearSignOut, accountId, isConnected, selector } = useNearWallet();

  // Efeito para fazer login automático quando a wallet conectar
  useEffect(() => {
    if (isConnected && accountId && !authState.isAuthenticated) {
      authenticateWithBackend();
    }
  }, [isConnected, accountId]);

  const authenticateWithBackend = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!selector) {
        throw new Error('Wallet selector not initialized');
      }

      // 1. Get challenge from Next.js API
      const challengeResponse = await fetch(
        `/api/auth/near?accountId=${accountId}`
      );
      
      if (!challengeResponse.ok) {
        throw new Error('Failed to get challenge');
      }

      const { challenge, message } = await challengeResponse.json();

      // 2. Sign message with wallet
      const wallet = await selector.wallet();
      const accounts = await wallet.getAccounts();
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const signatureObj = await wallet.signMessage({
        message,
        recipient: window.location.origin,
        nonce: Buffer.from(challenge, 'base64')
      });

      // 3. Verify signature with Next.js API
      const verifyResponse = await fetch(`/api/auth/near`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: window.location.origin, // send to server
        },
        body: JSON.stringify({
          signature: signatureObj?.signature,
          accountId,
          publicKey: signatureObj?.publicKey,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify signature');
      }

      const { user, apiKey } = await verifyResponse.json();

      // Store API key in localStorage
      localStorage.setItem('apiKey', apiKey.keyValue);

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        user,
        apiKey: apiKey.keyValue,
      });

      return true;
    } catch (error) {
      console.error('Login error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to login',
      }));
      return false;
    }
  };

  const login = async () => {
    if (!isConnected) {
      await signIn();
      return true;
    }
    return authenticateWithBackend();
  };

  const logout = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Clear local storage
      localStorage.removeItem('apiKey');
      
      // Sign out from NEAR wallet
      await nearSignOut();
      
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        user: null,
        apiKey: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to logout',
      }));
    }
  };

  return {
    ...authState,
    login,
    logout,
    accountId,
  };
} 