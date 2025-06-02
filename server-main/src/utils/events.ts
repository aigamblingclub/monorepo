/**
 * NEAR Events Utility
 * 
 * Functions to query and parse events from the AGC contract on NEAR
 */

import { AGC_CONTRACT_ID, NEAR_NODE_URL } from './env';

export interface LockEvent {
  account_id: string;
  timestamp: string;
}

export interface UnlockEvent {
  account_id: string;
  timestamp: string;
}

interface NearBlocksReceipt {
  id: string;
  receipt_id: string;
  transaction_hash: string;
  predecessor_account_id: string;
  receiver_account_id: string;
  block: {
    block_hash: string;
    block_height: number;
    block_timestamp: string;
  };
  outcome: {
    status: boolean;
    gas_burnt: string;
    tokens_burnt: string;
    executor_account_id: string;
  };
  actions: Array<{
    args: string;
    action: string;
    method: string;
    deposit: string;
  }>;
}

interface NearBlocksResponse {
  cursor: string;
  txns: NearBlocksReceipt[];
}

/**
 * Query the last successful transaction for a specific method call from a user
 * Checks up to 10 recent transactions to find the last valid one
 * If no valid transactions found in last 10, returns null (potential exploitation)
 */
async function queryLastMethodCall(
  contractId: string,
  fromAccount: string,
  method: string
): Promise<NearBlocksReceipt | null> {
  try {
    const url = `https://api.nearblocks.io/v2/account/${contractId}/receipts?from=${fromAccount}&method=${method}&per_page=10`;
    
    console.log(`Querying NearBlocks API: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NearBlocks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as NearBlocksResponse;
    
    if (!data.txns || data.txns.length === 0) {
      console.log(`No transactions found for ${fromAccount} calling ${method}`);
      return null;
    }
    
    // Look through the transactions to find the first (most recent) successful one
    for (const receipt of data.txns) {
      if (receipt.outcome.status === true) {
        console.log(`Found successful ${method} transaction for ${fromAccount} at timestamp: ${receipt.block.block_timestamp}`);
        return receipt;
      }
    }
    
    // If we get here, all transactions in the last 10 were failed
    console.warn(`Suspicious behavior: All last 10 ${method} transactions for ${fromAccount} were failed. Potential exploitation attempt.`);
    return null;
    
  } catch (error) {
    console.error('Error querying NearBlocks API:', error);
    return null;
  }
}

/**
 * Get the last USDC_BALANCE_LOCKED event for an account
 */
export async function getLastLockEvent(accountId: string): Promise<LockEvent | null> {
  try {
    console.log(`Querying last LOCK event for account: ${accountId}`);
    
    const receipt = await queryLastMethodCall(AGC_CONTRACT_ID, accountId, 'lockUsdcBalance');
    
    if (!receipt || !receipt.outcome.status) {
      console.log(`No successful lock transactions found for account: ${accountId}`);
      return null;
    }
    
    // Create a LockEvent from the receipt data
    // We only have the timestamp of when the method was called
    const lockEvent: LockEvent = {
      account_id: accountId,
      timestamp: receipt.block.block_timestamp
    };
    
    console.log(`Found latest lock event for ${accountId} at timestamp:`, receipt.block.block_timestamp);
    return lockEvent;
    
  } catch (error) {
    console.error('Error fetching last lock event:', error);
    return null;
  }
}

/**
 * Get the last USDC_BALANCE_UNLOCKED event for an account
 */
export async function getLastUnlockEvent(accountId: string): Promise<UnlockEvent | null> {
  try {
    console.log(`Querying last UNLOCK event for account: ${accountId}`);
    
    const receipt = await queryLastMethodCall(AGC_CONTRACT_ID, accountId, 'unlockUsdcBalance');
    
    if (!receipt || !receipt.outcome.status) {
      console.log(`No successful unlock transactions found for account: ${accountId}`);
      return null;
    }
    
    // Create an UnlockEvent from the receipt data
    // We only have the timestamp of when the method was called
    const unlockEvent: UnlockEvent = {
      account_id: accountId,
      timestamp: receipt.block.block_timestamp
    };
    
    console.log(`Found latest unlock event for ${accountId} at timestamp:`, receipt.block.block_timestamp);
    return unlockEvent;
    
  } catch (error) {
    console.error('Error fetching last unlock event:', error);
    return null;
  }
}

/**
 * Compare timestamps to determine which event is more recent
 */
export function isLockMoreRecentThanUnlock(lockEvent: LockEvent | null, unlockEvent: UnlockEvent | null): boolean {
  // If no unlock event exists, lock is always "more recent" (first lock scenario)
  if (!unlockEvent) return lockEvent !== null;
  
  // If no lock event exists, unlock is more recent
  if (!lockEvent) return false;
  
  // Compare timestamps (both are in nanoseconds)
  return BigInt(lockEvent.timestamp) > BigInt(unlockEvent.timestamp);
} 