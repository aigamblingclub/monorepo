interface NearWallet {
  signMessage: (params: {
    message: string;
    recipient: string;
    nonce: Buffer;
  }) => Promise<string>;
  publicKey: string;
}

interface Window {
  selector: {
    wallet: () => Promise<NearWallet>;
  };
}
