/**
 * NEAR Protocol Authentication Hook
 * 
 * This custom React hook provides authentication functionality for NEAR Protocol integration.
 * It manages the complete authentication flow including wallet connection, message signing,
 * backend verification, and session management with API key storage.
 * 
 * @module useNearAuth
 * @requires useNearWallet - For NEAR wallet operations
 * @requires AuthState - Type definitions for authentication state
 */

"use client";

import { useState, useEffect } from 'react';
import { useNearWallet } from './useNearWallet';
import { AuthState } from '@/types/auth';
import { isDev } from '@/utils/env';

/**
 * Custom hook for NEAR Protocol authentication with backend integration
 * 
 * Manages the complete authentication lifecycle:
 * 1. NEAR wallet connection
 * 2. Challenge/response authentication with backend
 * 3. Message signing with wallet
 * 4. Signature verification
 * 5. API key management and storage
 * 6. Session state management
 * 
 * @returns {Object} Authentication state and control functions
 * @returns {boolean} isAuthenticated - Whether user is currently authenticated
 * @returns {boolean} isLoading - Whether authentication operation is in progress
 * @returns {string|null} error - Current error message, if any
 * @returns {Object|null} user - Authenticated user data from backend
 * @returns {string|null} apiKey - API key for backend requests
 * @returns {Function} login - Function to initiate login process
 * @returns {Function} logout - Function to logout and clear session
 * @returns {string|null} accountId - NEAR account ID of connected wallet
 */
export function useNearAuth() {
  /**
   * Authentication state management
   * Tracks all aspects of the authentication process and user session
   */
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: false,
    error: null,
    user: null,
    apiKey: null,
  });

  const { signIn, signOut: nearSignOut, accountId, isConnected, selector } = useNearWallet();

  /**
   * Auto-authentication effect
   * Automatically initiates backend authentication when wallet connects
   * and user is not already authenticated
   */
  useEffect(() => {
    if (isConnected && accountId && !authState.isAuthenticated) {
      authenticateWithBackend();
    }
  }, [isConnected, accountId]);

  /**
   * Authenticates user with backend using NEAR wallet signature
   * 
   * Implements the complete challenge-response authentication flow:
   * 1. Requests challenge from backend API
   * 2. Signs challenge message with NEAR wallet
   * 3. Sends signature to backend for verification
   * 4. Stores API key and updates authentication state
   * 
   * @async
   * @returns {Promise<boolean>} True if authentication successful, false otherwise
   * @throws {Error} When wallet selector not initialized
   * @throws {Error} When no accounts found in wallet
   * @throws {Error} When challenge request fails
   * @throws {Error} When signature verification fails
   */
  const authenticateWithBackend = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!selector) {
        throw new Error('Wallet selector not initialized');
      }

      if (!accountId) {
        throw new Error('Wallet Connect Error');
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

      let verifyResponse; 
      try {
        // 3. Verify signature with Next.js API
        verifyResponse = await fetch(`/api/auth/near`, {
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
      } catch (error) {
        if(isDev) {
          console.error('[ERROR][AUTH][BACKEND] Failed to verify signature', error);
        }
        throw error;
      }

      if (!verifyResponse.ok) {
        if(isDev) {
          console.error('[ERROR][AUTH][BACKEND] Failed to verify signature', verifyResponse);
        }
        throw new Error('Failed to verify signature');
      }

      const { user, apiKey } = await verifyResponse.json();

      // Store API key in localStorage for persistence
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

  /**
   * Initiates user login process
   * 
   * If wallet is not connected, triggers wallet connection flow.
   * If wallet is already connected, proceeds directly to backend authentication.
   * 
   * @async
   * @returns {Promise<boolean>} True if login process initiated successfully
   */
  const login = async () => {
    if (!isConnected) {
      await signIn();
      return true;
    }
    return authenticateWithBackend();
  };

  /**
   * Logs out user and clears all session data
   * 
   * Performs complete cleanup:
   * 1. Removes API key from localStorage
   * 2. Signs out from NEAR wallet
   * 3. Resets authentication state
   * 
   * @async
   * @throws {Error} When logout process fails
   */
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