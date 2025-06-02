import * as borsh from 'borsh';
import { PublicKey } from '@near-js/crypto';
import js_sha256 from 'js-sha256';
import { randomBytes } from 'crypto';

// Constants for authentication
export const AUTH_MESSAGE = 'log me in';

// Generate a new challenge for each authentication attempt
export function generateChallenge(): Buffer {
  return randomBytes(32);
}

interface PayloadData {
  message: string;
  nonce: Buffer;
  recipient: string;
  callbackUrl?: string;
}

class Payload {
  tag: number;
  message: string;
  nonce: Buffer;
  recipient: string;
  callbackUrl?: string;

  constructor({ message, nonce, recipient, callbackUrl }: PayloadData) {
    this.tag = 2147484061;
    this.message = message;
    this.nonce = nonce;
    this.recipient = recipient;
    if (callbackUrl) {
      this.callbackUrl = callbackUrl;
    }
  }
}

const payloadSchema = {
  struct: {
    tag: 'u32',
    message: 'string',
    nonce: { array: { type: 'u8', len: 32 } },
    recipient: 'string',
    callbackUrl: { option: 'string' },
  },
};

export interface AuthMessage {
  signature: string;
  accountId: string;
  publicKey: string;
}

interface NearRpcResponse {
  result?: {
    keys?: Array<{
      public_key: string;
      access_key: {
        permission: string;
      };
    }>;
  };
}

export async function authenticate({
  accountId,
  publicKey,
  signature,
  message,
  recipient,
  nonce,
}: {
  accountId: string;
  publicKey: string;
  signature: string;
  message: string;
  recipient: string;
  nonce: Buffer;
}): Promise<boolean> {
  // A user is correctly authenticated if:
  // - The key used to sign belongs to the user and is a Full Access Key
  // - The object signed contains the right message and domain
  const full_key_of_user = await verifyFullKeyBelongsToUser({ accountId, publicKey });
  const valid_signature = verifySignature({ publicKey, signature, message, recipient, nonce });
  return valid_signature && full_key_of_user;
}

function verifySignature({
  publicKey,
  signature,
  message,
  recipient,
  nonce,
}: {
  publicKey: string;
  signature: string;
  message: string;
  recipient: string;
  nonce: Buffer;
}): boolean {
  // Reconstruct the expected payload to be signed
  const payload = new Payload({ message, recipient, nonce });
  const serialized = borsh.serialize(payloadSchema, payload);
  const to_sign = Uint8Array.from(js_sha256.sha256.array(serialized));

  // Reconstruct the signature from the parameter given in the URL
  let real_signature = Buffer.from(signature, 'base64');

  // Use the public Key to verify that the private-counterpart signed the message
  const myPK = PublicKey.from(publicKey);
  try {
    const result = myPK.verify(to_sign, real_signature);
    return result;
  } catch (error) {
    return false;
  }
}

async function verifyFullKeyBelongsToUser({
  publicKey,
  accountId,
}: {
  publicKey: string;
  accountId: string;
}): Promise<boolean> {
  // Call the public RPC asking for all the users' keys
  let data = await fetch_all_user_keys({ accountId });

  // if there are no keys, then the user could not sign it!
  if (!data?.result?.keys) return false;
  // check all the keys to see if we find the used_key there
  for (const k of data.result.keys) {
    if (k.public_key === publicKey) {
      // Ensure the key is full access, meaning the user had to sign
      // the transaction through the wallet
      return k.access_key.permission === 'FullAccess';
    }
  }
  return false; // didn't find it
}

// Aux method
async function fetch_all_user_keys({ accountId }: { accountId: string }): Promise<NearRpcResponse> {
  const response = await fetch(
    // "https://test.rpc.fastnear.com", // testnet
    'https://rpc.mainnet.near.org', // mainnet
    {
      method: 'post',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: `{"jsonrpc":"2.0", "method":"query", "params":["access_key/${accountId}", ""], "id":1}`,
    },
  );
  const data = await response.json();
  return data as NearRpcResponse;
}
