import { FRONTEND_URL } from '@/utils/env';
import { authenticate } from '../utils/near-auth';

// Constants for authentication
const AUTH_MESSAGE = 'log me in';
const AUTH_CHALLENGE = Buffer.from(Array.from(Array(32).keys()));  

describe('NEAR Authentication', () => {
  // This is a sample message that would be signed by the NEAR wallet
  const sampleMessage = {
    signature:
      'IfModLa3g3czlyPhkg/LSkTFSy7XCGreStZJTDIO1m3viEnYFLdXfpz1gYUVKYv3W2vwcV77TmGEzc9y0Nz+AA==',
    accountId: 'maguila.testnet',
    publicKey: 'ed25519:AtH7GEjv2qmBVoT8qoRhWXizXM5CC12DC6tiqY9iNoRm',
  };

  it('should authenticate a valid NEAR wallet signature', async () => {
    const result = await authenticate({
      accountId: sampleMessage.accountId,
      publicKey: sampleMessage.publicKey,
      signature: sampleMessage.signature,
      message: AUTH_MESSAGE,
      recipient: FRONTEND_URL,
      nonce: AUTH_CHALLENGE,
    });

    expect(result).toBe(true);
  });

  it('should reject an invalid signature', async () => {
    const result = await authenticate({
      accountId: sampleMessage.accountId,
      publicKey: sampleMessage.publicKey,
      signature: 'invalid_signature',
      message: AUTH_MESSAGE,
      recipient: FRONTEND_URL,
      nonce: AUTH_CHALLENGE,
    });

    expect(result).toBe(false);
  });

  it('should reject an invalid account ID', async () => {
    const result = await authenticate({
      accountId: 'invalid.account',
      publicKey: sampleMessage.publicKey,
      signature: sampleMessage.signature,
      message: AUTH_MESSAGE,
      recipient: FRONTEND_URL,
      nonce: AUTH_CHALLENGE,
    });

    expect(result).toBe(false);
  });
}); 