import { useNearWallet } from "@/hooks/useNearWallet";
import "@near-wallet-selector/modal-ui/styles.css";

export function WalletButton() {
  const { accountId, signIn, signOut } = useNearWallet();

  return (
    <button
      onClick={accountId ? signOut : signIn}
      className="wallet-button"
    >
      {accountId ? `${accountId.slice(0, 10)}...` : "Connect Wallet"}
    </button>
  );
} 