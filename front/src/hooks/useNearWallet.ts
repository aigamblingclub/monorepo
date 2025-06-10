'use client';

import {
  setupWalletSelector,
  WalletSelector,
  AccountState,
} from '@near-wallet-selector/core';
import { setupModal } from '@near-wallet-selector/modal-ui';
// import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui/lib/modal.types";
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupSender } from '@near-wallet-selector/sender';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { setupBitgetWallet } from '@near-wallet-selector/bitget-wallet';
import { setupMathWallet } from '@near-wallet-selector/math-wallet';
import { setupNightly } from '@near-wallet-selector/nightly';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupMeteorWalletApp } from '@near-wallet-selector/meteor-wallet-app';
import { setupOKXWallet } from '@near-wallet-selector/okx-wallet';
import { setupNarwallets } from '@near-wallet-selector/narwallets';
import { setupWelldoneWallet } from '@near-wallet-selector/welldone-wallet';
// import { setupNearSnap } from "@near-wallet-selector/near-snap";
import { setupLedger } from '@near-wallet-selector/ledger';
import { setupWalletConnect } from '@near-wallet-selector/wallet-connect';
import { setupCoin98Wallet } from '@near-wallet-selector/coin98-wallet';
import { setupXDEFI } from '@near-wallet-selector/xdefi';
import { setupNearMobileWallet } from '@near-wallet-selector/near-mobile-wallet';
import { setupBitteWallet } from '@near-wallet-selector/bitte-wallet';
import { useEffect, useState, useMemo } from 'react';
import { connect, keyStores, Account, Near } from 'near-api-js';
import {
  NEXT_PUBLIC_USDC_CONTRACT_ID,
  NEXT_PUBLIC_CONTRACT_ID,
  isDev,
} from '@/utils/env';

type ContractArgs = Record<string, unknown>;

interface WalletState {
  selector: WalletSelector | null;
  modal: ReturnType<typeof setupModal> | null;
  accounts: Array<AccountState>;
  accountId: string | null;
  isConnecting: boolean;
}

let nearConnection: Near | null = null;
let viewAccount: Account | null = null;

// Fallback RPC endpoints in order of preference
const RPC_ENDPOINTS = [
  'https://rpc.mainnet.near.org',
  'https://near-mainnet.infura.io/v3/',
  'https://public-rpc.blockpi.io/http/near',
  'https://near-mainnet-rpc.allthatnode.com:3030',
  'https://1rpc.io/near',
];

let currentRpcIndex = 0;

async function getViewAccount() {
  if (viewAccount) return viewAccount;

  // Try each RPC endpoint until one works
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const rpcUrl = RPC_ENDPOINTS[(currentRpcIndex + i) % RPC_ENDPOINTS.length];
    try {
      if (!nearConnection) {
        nearConnection = await connect({
          networkId: 'mainnet',
          nodeUrl: rpcUrl,
          walletUrl: 'https://wallet.mainnet.near.org',
          deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() },
        });
      }

      // Use a generic account for view calls (doesn't need to be logged in)
      viewAccount = await nearConnection.account('guest.near');

      // Update current working RPC index
      currentRpcIndex = (currentRpcIndex + i) % RPC_ENDPOINTS.length;
      return viewAccount;
    } catch (error) {
      if (isDev) {
        console.error("[getViewAccount] Error:", error);
      }
      nearConnection = null; // Reset connection to try next endpoint
      viewAccount = null;

      if (i === RPC_ENDPOINTS.length - 1) {
        throw new Error('All RPC endpoints failed');
      }
    }
  }
}

export async function callViewMethod(
  contractId: string,
  methodName: string,
  args = {}
) {
  try {
    const account = await getViewAccount();
    if (!account) {
      throw new Error('Failed to get view account');
    }
    const result = await account.viewFunction({ contractId, methodName, args });
    return result;
  } catch (error) {
    if (isDev) {
      console.error("[callViewMethod] Error:", error);
    }
    throw new Error('Failed to get view account');
  }
}

export function useNearWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    selector: null,
    modal: null,
    accounts: [],
    accountId: null,
    isConnecting: false,
  });

  useEffect(() => {
    const initWallet = async () => {
      const selector = await setupWalletSelector({
        network: 'mainnet',
        modules: [
          setupMyNearWallet(),
          setupSender(),
          setupHereWallet(),
          setupBitgetWallet(),
          setupMathWallet(),
          setupNightly(),
          setupMeteorWallet(),
          setupMeteorWalletApp({
            contractId: NEXT_PUBLIC_CONTRACT_ID,
          }),
          setupOKXWallet(),
          setupNarwallets(),
          setupWelldoneWallet(),
          // setupNearSnap(), // BUG: https://github.com/near/wallet-selector/issues/1262
          setupLedger(),
          setupCoin98Wallet(),
          setupXDEFI(),
          setupWalletConnect({
            projectId: NEXT_PUBLIC_CONTRACT_ID,
            metadata: {
              name: 'AI Gambling Club',
              description: 'AI Gambling Club - NEAR Protocol AI Gambling Platform',
              url: 'https://aigambling.club',
              icons: ['https://aigambling.club/logo.png'],
            },
          }),
          setupNearMobileWallet(),
          setupBitteWallet(),
          // setupEthereumWallets(), // Some problems to setup
        ],
      });

      const modal = setupModal(selector, {
        contractId: NEXT_PUBLIC_CONTRACT_ID,
      });

      // Subscribe to changes
      const subscription = selector.store.observable.subscribe(async state => {
        const accounts = state.accounts;
        const accountId = accounts.length > 0 ? accounts[0].accountId : null;

        setWalletState(prev => ({
          ...prev,
          accounts,
          accountId,
          isConnecting: false,
        }));
      });

      setWalletState(prev => ({
        ...prev,
        selector,
        modal,
        accounts: selector.store.getState().accounts,
        accountId: selector.store.getState().accounts[0]?.accountId ?? null,
      }));

      return () => subscription.unsubscribe();
    };

    initWallet();
  }, []);

  const signIn = async () => {
    const { modal } = walletState;
    if (!modal) throw new Error('Modal not initialized');

    setWalletState(prev => ({ ...prev, isConnecting: true }));

    try {
      modal.show();
    } catch (err) {
      if (isDev) {
        console.error("[signIn] Error:", err);
      }
      setWalletState(prev => ({ ...prev, isConnecting: false }));
    }
  };

  const signOut = async () => {
    const { selector } = walletState;
    if (!selector) return;

    const wallet = await selector.wallet();
    await wallet.signOut();
    setWalletState(prev => ({
      ...prev,
      accounts: [],
      accountId: null,
    }));
  };

  const callMethod = async ({
    methodName,
    args,
    deposit,
    receiverId,
  }: {
    methodName: string;
    args: ContractArgs;
    deposit: string;
    receiverId?: string;
  }) => {
    const { selector } = walletState;

    if (!selector) throw new Error('Wallet not initialized');
    
    // Add additional checks
    if (!walletState.accountId) {
      throw new Error('No account connected');
    }

    const wallet = await selector.wallet();
    
    // Add logging to help diagnose the issue
    
    console.log('Wallet state:', {
      accountId: walletState.accountId,
      accounts: walletState.accounts,
      wallet: wallet
    });
    

    const result = await wallet.signAndSendTransaction({
      receiverId,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName,
            args,
            gas: '300000000000000',
            deposit,
          },
        },
      ],
    });
    console.log('result', result);
    return result;
  };

  const getNearBalance = async () => {
    const { selector } = walletState;
    if (!selector) throw new Error('Wallet not initialized');

    const wallet = await selector.wallet();
    const accounts = await wallet.getAccounts();

    if (accounts && accounts.length > 0) {
      // Try each RPC endpoint until one works
      for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
        const rpcUrl =
          RPC_ENDPOINTS[(currentRpcIndex + i) % RPC_ENDPOINTS.length];
        try {
          const connection = await connect({
            networkId: 'mainnet',
            nodeUrl: rpcUrl,
            walletUrl: 'https://wallet.mainnet.near.org',
            deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() },
          });

          // Get account state for the connected wallet account
          const userAccount = await connection.account(accounts[0].accountId);
          const accountState = await userAccount.state();

          // Update current working RPC index
          currentRpcIndex = (currentRpcIndex + i) % RPC_ENDPOINTS.length;

          // Return the available balance
          return accountState.amount;
        } catch (error) {
          if (isDev) {
            console.error("[getNearBalance] Error:", error);
          }
          throw new Error('Failed to get NEAR balance');
        }
      }
    }
    return '0';
  };

  const getUsdcWalletBalance = async (accountId: string) => {
    const usdcContract = NEXT_PUBLIC_USDC_CONTRACT_ID!;
    const result = await callViewMethod(usdcContract, 'ft_balance_of', {
      account_id: accountId,
    });
    return result;
  };

  const getAgcUsdcBalance = async (accountId: string) => {
    const agcContract = NEXT_PUBLIC_CONTRACT_ID;
    const result = await callViewMethod(agcContract, 'getUsdcBalance', {
      account_id: accountId,
    });
    return result;
  };

  const getVirtualUsdcBalance = async (apiKey: string) => {
    if (!apiKey) {
      throw new Error('User must be authenticated');
    }

    const response = await fetch('/api/balance', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      if (isDev) {
        console.error("[getVirtualUsdcBalance] Error:", errorResponse);
      }
      
      // Check if this is the unlock deadline error
      if (errorResponse?.error && typeof errorResponse.error === 'string') {
        const errorMessage = errorResponse.error;
        if (errorMessage.includes('Unlock deadline still valid. Please wait')) {
          // Extract seconds from the message using regex to find content between dashes
          const match = errorMessage.match(/-(\d+)-/);
          if (match && match[1]) {
            const seconds = parseInt(match[1], 10) + 5; // Add 5 seconds
            const customError = new Error('UNLOCK_DEADLINE_ERROR');
            (customError as any).unlockSecondsLeft = seconds; // eslint-disable-line @typescript-eslint/no-explicit-any
            throw customError;
          }
        }
      }
      
      throw new Error('Failed to fetch virtual balance');
    }

    const data = await response.json();
    return data.balance;
  };

  const getIsUsdcLocked = async (accountId: string) => {
    const agcContract = NEXT_PUBLIC_CONTRACT_ID;
    const result = await callViewMethod(agcContract, 'isUsdcLocked', {
      account_id: accountId,
    });
    return result;
  };

  return useMemo(
    () => ({
      ...walletState,
      signIn,
      signOut,
      callMethod,
      getNearBalance,
      getUsdcWalletBalance,
      getAgcUsdcBalance,
      getVirtualUsdcBalance,
      getIsUsdcLocked,
      callViewMethod,
      accountId: walletState.accountId,
      isConnected: walletState.accountId !== null,
      isConnecting: walletState.isConnecting,
    }),
    [walletState, signIn, signOut, callMethod, getNearBalance]
  );
}
