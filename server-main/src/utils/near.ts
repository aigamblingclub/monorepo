import { providers } from 'near-api-js';
import { AGC_CONTRACT_ID, NEAR_NODE_URL } from './env';

/**
 * Call a contract view method
 * @param contractId Contract ID
 * @param methodName Method name
 * @param args Method arguments
 * @returns Method result
 */
export async function callViewMethod(contractId: string, methodName: string, args: any = {}): Promise<any> {
  const nodeUrl = NEAR_NODE_URL;
  
  const connectionConfig = {
    url: nodeUrl
  };
  const provider = new providers.JsonRpcProvider(connectionConfig);

  try {
    const result = await provider.query({
      request_type: 'call_function',
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      finality: 'optimistic',
    }) as any;
    
    return JSON.parse(Buffer.from(result.result).toString());
  } catch (error) {
    console.error(`Error calling view method ${methodName}:`, error);
    throw error;
  }
}

/**
 * Get user's nonce from the AI Gambling Club contract
 * @param accountId User's NEAR account ID
 * @returns User's current nonce
 */
export async function getOnChainNonce(accountId: string): Promise<number> {
  try {
    const nonce = await callViewMethod(AGC_CONTRACT_ID, 'getNonce', { account_id: accountId });
    return nonce;
  } catch (error) {
    console.error(`Error getting on-chain nonce for ${accountId}:`, error);
    // Return 0 if there's an error (user might not exist on-chain yet)
    return 0;
  }
}

/**
 * Get user's USDC balance from the AI Gambling Club contract or USDC contract
 * @param contractId Contract ID
 * @param accountId User's NEAR account ID
 * @returns User's USDC balance
 */
export async function getOnChainUsdcBalance(contractId: string, accountId: string): Promise<number> {
  try {
    const balance = await callViewMethod(contractId, 'getUsdcBalance', { account_id: accountId });
    return parseInt(balance);
  } catch (error) {
    console.error(`Error getting on-chain USDC balance for ${accountId}:`, error);
    // Return 0 if there's an error (user might not exist on-chain yet)
    return 0;
  }
}

/**
 * Check if user's account is locked on the AI Gambling Club contract
 * @param accountId User's NEAR account ID
 * @returns Whether the account is locked
 */
export async function isAccountLocked(accountId: string): Promise<boolean> {
  try {
    const isLocked = await callViewMethod(AGC_CONTRACT_ID, 'isUsdcLocked', { account_id: accountId });
    return isLocked;
  } catch (error) {
    console.error(`Error checking if account is locked for ${accountId}:`, error);
    // Return false if there's an error (assume not locked)
    return false;
  }
} 