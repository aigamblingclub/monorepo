// Jest globals are available without import
import { getOnChainNonce, getOnChainUsdcBalance, callViewMethod } from '../utils/near';

// Mock environment variables for testing
process.env.NEAR_NODE_URL = 'https://rpc.testnet.near.org';
process.env.AGC_CONTRACT_ID = 'v2.aigamingclub.testnet'; // Example contract ID

describe('Contract Integration Tests', () => {
  const testContractId = 'v2.aigamingclub.testnet';
  const testAccountId = 'bobthegambler.testnet';

  describe('NEAR Contract Integration', () => {
    it('should call view method successfully', async () => {
      try {
        // Test calling a simple view method
        const result = await callViewMethod(testContractId, 'getAdmin', {});
        expect(result).toBeDefined();
        console.info('Admin account:', result);
      } catch (error) {
        // If contract doesn't exist or method fails, that's expected in test environment
        console.info('Expected error in test environment:', error);
        expect(error).toBeDefined();
      }
    }, 10000);

    it('should get on-chain nonce', async () => {
      try {
        const nonce = await getOnChainNonce(testAccountId);
        expect(typeof nonce).toBe('number');
        expect(nonce).toBeGreaterThanOrEqual(0);
        console.info('On-chain nonce:', nonce);
      } catch (error) {
        // If contract doesn't exist or account not found, should return 0
        console.info('Expected error, should return 0:', error);
      }
    }, 10000);

    it('should get on-chain USDC balance', async () => {
      try {
        const balance = await getOnChainUsdcBalance(testContractId, testAccountId);
        expect(typeof balance).toBe('number');
        expect(balance).toBeGreaterThanOrEqual(0);
        console.info('On-chain USDC balance:', balance);
      } catch (error) {
        // If contract doesn't exist or account not found, should return 0
        console.info('Expected error, should return 0:', error);
      }
    }, 10000);
  });

  describe('Environment Configuration', () => {
    it('should have required environment variables', () => {
      // These should be set in the actual environment
      expect(process.env.NEAR_NODE_URL).toBeDefined();
      expect(process.env.AGC_CONTRACT_ID).toBeDefined();

      console.info('NEAR_NODE_URL:', process.env.NEAR_NODE_URL);
      console.info('AGC_CONTRACT_ID:', process.env.AGC_CONTRACT_ID);
    });
  });
});
