"use client";

import { createContext, useContext, ReactNode } from "react";
import { useNearWallet } from "@/hooks/useNearWallet";

const WalletContext = createContext<ReturnType<typeof useNearWallet> | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const wallet = useNearWallet();

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
} 