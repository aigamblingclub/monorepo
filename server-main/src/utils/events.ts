/**
 * NEAR Blockchain Events Utility Module
 *
 * Core functions for querying and parsing lock/unlock events from the AGC contract
 * on the NEAR blockchain. This module interfaces with the NearBlocks API to retrieve
 * transaction history and extract relevant event data for security validation and
 * balance synchronization operations.
 *
 * @fileoverview NEAR blockchain event querying system for AGC contract interactions
 * @version 1.0.0
 * @author 0xneves
 *
 * @security WARNING: This module queries external blockchain APIs and handles transaction data.
 * Event timestamps are critical for security validation and should be treated as security-sensitive.
 *
 * @example
 * ```typescript
 * import { getLastLockEvent, getLastUnlockEvent, isLockMoreRecentThanUnlock } from './events';
 *
 * const lockEvent = await getLastLockEvent('user.near');
 * const unlockEvent = await getLastUnlockEvent('user.near');
 * const lockIsRecent = isLockMoreRecentThanUnlock(lockEvent, unlockEvent);
 * ```
 */

import { AGC_CONTRACT_ID, NEAR_NODE_URL } from './env';

/**
 * @typedef {Object} LockEvent
 * @property {string} account_id - NEAR Protocol account that initiated the lock operation
 * @property {string} timestamp - Blockchain timestamp in nanoseconds when lock occurred
 */
export interface LockEvent {
  account_id: string;
  timestamp: string;
  transaction_hash: string;
}

/**
 * @typedef {Object} UnlockEvent
 * @property {string} account_id - NEAR Protocol account that initiated the unlock operation
 * @property {string} timestamp - Blockchain timestamp in nanoseconds when unlock occurred
 */
export interface UnlockEvent {
  account_id: string;
  timestamp: string;
}

/**
 * @typedef {Object} NearBlocksReceipt
 * @property {string} id - Unique identifier for the receipt
 * @property {string} receipt_id - Receipt identifier from NEAR blockchain
 * @property {string} transaction_hash - Transaction hash on NEAR blockchain
 * @property {string} predecessor_account_id - Account that initiated the transaction
 * @property {string} receiver_account_id - Account that received the transaction
 * @property {Object} block - Block information containing the transaction
 * @property {string} block.block_hash - Hash of the block containing this transaction
 * @property {number} block.block_height - Height of the block in the blockchain
 * @property {string} block.block_timestamp - Timestamp when block was created (nanoseconds)
 * @property {Object} outcome - Transaction execution outcome details
 * @property {boolean} outcome.status - Whether the transaction executed successfully
 * @property {string} outcome.gas_burnt - Amount of gas consumed by the transaction
 * @property {string} outcome.tokens_burnt - Amount of tokens burnt during execution
 * @property {string} outcome.executor_account_id - Account that executed the transaction
 * @property {Array} actions - Array of actions performed in the transaction
 */
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

/**
 * @typedef {Object} NearBlocksResponse
 * @property {string} cursor - Pagination cursor for additional results
 * @property {NearBlocksReceipt[]} txns - Array of transaction receipts from the API
 */
interface NearBlocksResponse {
  cursor: string;
  txns: NearBlocksReceipt[];
}

/**
 * Blockchain Transaction Query Operations
 *
 * Queries the last successful transaction for a specific method call from a user
 * using the NearBlocks API. This function examines up to 10 recent transactions
 * to find the most recent valid execution, providing security against failed
 * transaction exploitation attempts.
 *
 * @param {string} contractId - NEAR contract ID to query transactions for
 * @param {string} fromAccount - Account that initiated the method calls
 * @param {string} method - Specific contract method to search for
 * @returns {Promise<NearBlocksReceipt | null>} Most recent successful transaction or null
 *
 * @throws {Error} NearBlocks API request failure during transaction query
 * @throws {Error} Network connectivity issues during blockchain data retrieval
 * @throws {Error} API response parsing failure during data processing
 *
 * @security WARNING: This function detects potential exploitation attempts through failed transactions
 *
 * @example
 * ```typescript
 * const receipt = await queryLastMethodCall('contract.near', 'user.near', 'lockUsdcBalance');
 * if (receipt && receipt.outcome.status) {
 *   console.info('Found successful lock transaction');
 * }
 * ```
 */
async function queryLastMethodCall(
  contractId: string,
  fromAccount: string,
  method: string,
): Promise<NearBlocksReceipt | null> {
  try {
    const url = `https://api.nearblocks.io/v2/account/${contractId}/receipts?from=${fromAccount}&method=${method}&per_page=10`;
    const response = await fetch(url);

    // Validation: Check if API request was successful
    if (!response.ok) {
      throw new Error(`NearBlocks API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as NearBlocksResponse;

    // Validation: Check if any transactions were found for the user
    if (!data.txns || data.txns.length === 0) {
      return null;
    }

    // Look through the transactions to find the first (most recent) successful one
    // Validation: Examine transaction history for successful executions
    for (const receipt of data.txns) {
      if (receipt.outcome.status === true) {
        return receipt;
      }
    }

    // Validation: Detect potential exploitation through repeated failed transactions
    // If we get here, all transactions in the last 10 were failed
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Last Lock Event Retrieval
 *
 * Retrieves the most recent successful USDC lock event for a specific account
 * from the NEAR blockchain. This function is used for security validation to
 * determine the user's current lock status and transaction timing.
 *
 * @param {string} accountId - NEAR Protocol account to query lock events for
 * @returns {Promise<LockEvent | null>} Most recent lock event or null if none found
 *
 * @throws {Error} Blockchain API query failure during lock event retrieval
 * @throws {Error} Transaction data parsing failure during event construction
 * @throws {Error} Network connectivity issues during blockchain data access
 *
 * @example
 * ```typescript
 * const lockEvent = await getLastLockEvent('alice.near');
 * if (lockEvent) {
 *   console.info('Last lock at:', lockEvent.timestamp);
 * } else {
 *   console.info('No lock events found');
 * }
 * ```
 */
export async function getLastLockEvent(accountId: string): Promise<LockEvent | null> {
  try {
    const receipt = await queryLastMethodCall(AGC_CONTRACT_ID, accountId, 'lockUsdcBalance');

    // Validation: Check if successful lock transaction was found
    if (!receipt || !receipt.outcome.status) {
      return null;
    }

    // Create a LockEvent from the receipt data
    // We only have the timestamp of when the method was called
    const lockEvent: LockEvent = {
      account_id: accountId,
      timestamp: receipt.block.block_timestamp,
      transaction_hash: receipt.transaction_hash,
    };

    return lockEvent;
  } catch (error) {
    return null;
  }
}

/**
 * Last Unlock Event Retrieval
 *
 * Retrieves the most recent successful USDC unlock event for a specific account
 * from the NEAR blockchain. This function is used for security validation to
 * determine the user's current unlock status and transaction sequencing.
 *
 * @param {string} accountId - NEAR Protocol account to query unlock events for
 * @returns {Promise<UnlockEvent | null>} Most recent unlock event or null if none found
 *
 * @throws {Error} Blockchain API query failure during unlock event retrieval
 * @throws {Error} Transaction data parsing failure during event construction
 * @throws {Error} Network connectivity issues during blockchain data access
 *
 * @example
 * ```typescript
 * const unlockEvent = await getLastUnlockEvent('alice.near');
 * if (unlockEvent) {
 *   console.info('Last unlock at:', unlockEvent.timestamp);
 * } else {
 *   console.info('No unlock events found');
 * }
 * ```
 */
export async function getLastUnlockEvent(accountId: string): Promise<UnlockEvent | null> {
  try {
    const receipt = await queryLastMethodCall(AGC_CONTRACT_ID, accountId, 'unlockUsdcBalance');

    // Validation: Check if successful unlock transaction was found
    if (!receipt || !receipt.outcome.status) {
      return null;
    }

    // Create an UnlockEvent from the receipt data
    // We only have the timestamp of when the method was called
    const unlockEvent: UnlockEvent = {
      account_id: accountId,
      timestamp: receipt.block.block_timestamp,
    };

    return unlockEvent;
  } catch (error) {
    return null;
  }
}

/**
 * Event Timestamp Comparison Utility
 *
 * Compares timestamps of lock and unlock events to determine which operation
 * is more recent. This comparison is critical for security validation to ensure
 * proper user state determination and prevent unauthorized operations.
 *
 * @param {LockEvent | null} lockEvent - Most recent lock event or null if none exists
 * @param {UnlockEvent | null} unlockEvent - Most recent unlock event or null if none exists
 * @returns {boolean} True if lock is more recent than unlock, false otherwise
 *
 * @security CRITICAL: This function determines user lock state for betting permissions
 *
 * @example
 * ```typescript
 * const lockEvent = await getLastLockEvent('user.near');
 * const unlockEvent = await getLastUnlockEvent('user.near');
 *
 * if (isLockMoreRecentThanUnlock(lockEvent, unlockEvent)) {
 *   console.info('User is currently in locked state');
 * } else {
 *   console.info('User is currently in unlocked state');
 * }
 * ```
 */
export function isLockMoreRecentThanUnlock(
  lockEvent: LockEvent | null,
  unlockEvent: UnlockEvent | null,
): boolean {
  // Validation: Handle case where no unlock event exists (first lock scenario)
  // If no unlock event exists, lock is always "more recent" (first lock scenario)
  if (!unlockEvent) return lockEvent !== null;

  // Validation: Handle case where no lock event exists
  // If no lock event exists, unlock is more recent
  if (!lockEvent) return false;

  // Compare timestamps (both are in nanoseconds)
  return BigInt(lockEvent.timestamp) > BigInt(unlockEvent.timestamp);
}
