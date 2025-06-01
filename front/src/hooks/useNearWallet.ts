"use client";

import {
  setupWalletSelector,
  WalletSelector,
  AccountState,
} from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
// import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui/lib/modal.types";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupBitgetWallet } from "@near-wallet-selector/bitget-wallet";
import { setupMathWallet } from "@near-wallet-selector/math-wallet";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupMeteorWalletApp } from "@near-wallet-selector/meteor-wallet-app";
import { setupOKXWallet } from "@near-wallet-selector/okx-wallet";
import { setupNarwallets } from "@near-wallet-selector/narwallets";
import { setupWelldoneWallet } from "@near-wallet-selector/welldone-wallet";
// import { setupNearSnap } from "@near-wallet-selector/near-snap";
import { setupLedger } from "@near-wallet-selector/ledger";
import { setupWalletConnect } from "@near-wallet-selector/wallet-connect";
import { setupCoin98Wallet } from "@near-wallet-selector/coin98-wallet";
import { setupXDEFI } from "@near-wallet-selector/xdefi";
import { setupNearMobileWallet } from "@near-wallet-selector/near-mobile-wallet";
import { setupBitteWallet } from "@near-wallet-selector/bitte-wallet";
import { useEffect, useState, useMemo } from "react";
import { connect, keyStores, Account, Near } from "near-api-js";
import { NEXT_PUBLIC_USDC_CONTRACT_ID } from "@/utils/env";

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

async function getViewAccount() {
  if (viewAccount) return viewAccount;
  if (!nearConnection) {
    // Use mainnet for USDC contract calls since USDC is typically on mainnet
    nearConnection = await connect({
      networkId: "mainnet",
      nodeUrl: "https://rpc.mainnet.near.org",
      walletUrl: "https://wallet.mainnet.near.org",
      deps: { keyStore: new keyStores.BrowserLocalStorageKeyStore() },
    });
  }
  // Use a generic account for view calls (doesn't need to be logged in)
  viewAccount = await nearConnection.account("guest.near");
  console.log("🔍 View account:", viewAccount);
  return viewAccount;
}

export async function callViewMethod(
  contractId: string,
  methodName: string,
  args = {}
) {
  try {
    const account = await getViewAccount();
    console.log("🔍 Account:", account);
    const result = await account.viewFunction({ contractId, methodName, args });
    console.log("🔍 Result:", result);
    return result;
  } catch (error) {
    console.error("🔍 Error:", error);
    return "0";
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
        network: "mainnet",
        modules: [
          setupMyNearWallet(),
          setupSender(),
          setupHereWallet(),
          setupBitgetWallet(),
          setupMathWallet(),
          setupNightly(),
          setupMeteorWallet(),
          setupMeteorWalletApp({
            contractId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
          }),
          setupOKXWallet(),
          setupNarwallets(),
          setupWelldoneWallet(),
          // setupNearSnap(), // BUG: https://github.com/near/wallet-selector/issues/1262
          setupLedger(),
          setupCoin98Wallet(),
          setupXDEFI(),
          setupWalletConnect({
            projectId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
            metadata: {
              name: "AI Gambling Club",
              description: "AI Gambling Club - NEAR Protocol Gambling Platform",
              url: "https://aigambling.club",
              icons: ["https://aigambling.club/logo.png"],
            },
          }),
          setupNearMobileWallet(),
          setupBitteWallet(),
          // setupEthereumWallets(), // Some problems to setup
        ],
      });

      const modal = setupModal(selector, {
        contractId: process.env.NEXT_PUBLIC_CONTRACT_ID!,
      });

      // Subscribe to changes
      const subscription = selector.store.observable.subscribe(
        async (state) => {
          const accounts = state.accounts;
          const accountId = accounts.length > 0 ? accounts[0].accountId : null;

          setWalletState((prev) => ({
            ...prev,
            accounts,
            accountId,
            isConnecting: false,
          }));
        }
      );

      setWalletState((prev) => ({
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
    if (!modal) throw new Error("Modal not initialized");

    setWalletState((prev) => ({ ...prev, isConnecting: true }));

    try {
      modal.show();
    } catch (err) {
      console.error("Failed to show wallet modal:", err);
      setWalletState((prev) => ({ ...prev, isConnecting: false }));
    }
  };

  const signOut = async () => {
    const { selector } = walletState;
    if (!selector) return;

    const wallet = await selector.wallet();
    await wallet.signOut();
    setWalletState((prev) => ({
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
    if (!selector) throw new Error("Wallet not initialized");
    const wallet = await selector.wallet();

    return wallet.signAndSendTransaction({
      receiverId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName,
            args,
            gas: "300000000000000",
            deposit,
          },
        },
      ],
    });
  };

  const getNearBalance = async () => {
    const { selector } = walletState;
    if (!selector) throw new Error("Wallet not initialized");

    const wallet = await selector.wallet();
    const accounts = await wallet.getAccounts();

    if (accounts && accounts.length > 0) {
      const response = await fetch("https://rpc.testnet.near.org", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "view_account",
            finality: "final",
            account_id: accounts[0].accountId,
          },
        }),
      });
      console.log("🔍 Response getNearBalance:", response);
      const data = await response.json();
      if (data.result && data.result.amount) {
        return data.result.amount;
      }
    }
    return "0";
  };

  const getUsdcWalletBalance = async (accountId: string) => {
    const usdcContract = NEXT_PUBLIC_USDC_CONTRACT_ID!;
    const result = await callViewMethod(usdcContract, "ft_balance_of", {
      account_id: accountId,
    });
    console.log("🔍 USDC wallet balance:", result);
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
      callViewMethod,
      accountId: walletState.accountId,
      isConnected: walletState.accountId !== null,
      isConnecting: walletState.isConnecting,
    }),
    [walletState, signIn, signOut, callMethod]
  );
}
