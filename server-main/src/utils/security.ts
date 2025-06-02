/**
 * Security Validation Utility Module
 *
 * Core security operations for validating user betting permissions based on lock/unlock status.
 * This module handles the critical security flow that determines whether users can place bets
 * by analyzing their blockchain transaction history, balance synchronization, and time-based
 * validation rules.
 *
 * @fileoverview Security validation system for AGC betting platform
 * @version 1.0.0
 * @author 0xneves
 *
 * @security WARNING: This module handles critical betting permissions and balance synchronization.
 * All functions in this module should be treated as security-critical operations.
 *
 * @example
 * ```typescript
 * import { validateUserCanBet } from './security';
 *
 * const result = await validateUserCanBet('user.near');
 * if (result.success && result.canBet) {
 *   // Allow user to place bets
 * }
 * ```
 */

import { getUserByNearAddress } from './contract';
import {
  getLastLockEvent,
  getLastUnlockEvent,
  isLockMoreRecentThanUnlock,
  LockEvent,
  UnlockEvent,
} from './events';
import { PrismaClient, Prisma } from '@/prisma';
import { getOnChainUsdcBalance, isAccountLocked } from './near';
import { AGC_CONTRACT_ID } from './env';

/**
 * @type {PrismaClient}
 * Database client instance for all security-related database operations.
 * Used for user balance management, betting permissions, and unlock deadline tracking.
 */
const prisma = new PrismaClient();

/**
 * @typedef {Object} SecurityValidationResult
 * @property {boolean} success - Whether the validation process completed successfully
 * @property {boolean} canBet - Whether the user is permitted to place bets
 * @property {string[]} errors - Array of error messages if validation failed
 * @property {Object} [debugInfo] - Optional debugging information for troubleshooting
 * @property {string} [debugInfo.lastLockTimestamp] - Timestamp of most recent lock transaction
 * @property {string} [debugInfo.lastUnlockTimestamp] - Timestamp of most recent unlock transaction
 * @property {boolean} [debugInfo.lockIsMoreRecent] - Whether lock is more recent than unlock
 * @property {string} [debugInfo.currentTimestamp] - Current system timestamp in nanoseconds
 * @property {string} [debugInfo.pendingUnlockDeadline] - Pending unlock deadline timestamp
 */
interface SecurityValidationResult {
  success: boolean;
  canBet: boolean;
  errors: string[];
  debugInfo?: {
    lastLockTimestamp?: string;
    lastUnlockTimestamp?: string;
    lockIsMoreRecent?: boolean;
    currentTimestamp?: string;
    pendingUnlockDeadline?: string;
  };
}

/**
 * Main Security Validation Function
 *
 * Determines if a user can place bets based on their lock/unlock transaction history,
 * balance synchronization status, and time-based validation rules. This is the core
 * security function that prevents unauthorized betting operations.
 *
 * @param {string} nearNamedAddress - NEAR Protocol named address of the user
 * @param {boolean} verbose - Enable verbose logging for debugging purposes
 * @returns {Promise<SecurityValidationResult>} Validation result with betting permission status
 *
 * @throws {Error} User lookup failure in database
 * @throws {Error} Lock/unlock event query failure from blockchain
 * @throws {Error} Balance synchronization failure during lock resolution
 * @throws {Error} Database transaction failure during status updates
 *
 * @security CRITICAL: This function controls betting permissions and handles balance synchronization
 *
 * @example
 * ```typescript
 * const result = await validateUserCanBet('alice.near');
 * if (result.success && result.canBet) {
 *   console.log('User can place bets');
 * } else {
 *   console.error('Betting not allowed:', result.errors);
 * }
 * ```
 */
export async function validateUserCanBet(
  nearNamedAddress: string,
  verbose: boolean = false,
): Promise<SecurityValidationResult> {
  const errors: string[] = [];
  let canBet = false;

  if (verbose) console.log(`[Security] Starting validation for user: ${nearNamedAddress}`);

  try {
    // Validation: Verify user exists in database
    if (verbose) console.log(`[Security] Step 1: Looking up user in database`);
    const user = await getUserByNearAddress(nearNamedAddress);
    if (!user) {
      if (verbose) console.log(`[Security] User not found in database`);
      return { success: false, canBet: false, errors: ['User not found'] };
    }
    if (verbose) console.log(`[Security] User found with ID: ${user.id}`);

    // Step 1: Get current timestamp in nanoseconds
    const currentTimestamp = BigInt(Date.now() * 1_000_000);
    if (verbose) console.log(`[Security] Current timestamp: ${currentTimestamp.toString()}`);

    // Step 2: Get user's current betting status and pending unlock deadline (in parallel)
    if (verbose) console.log(`[Security] Step 2: Getting user betting status and unlock deadline`);
    let userCanBet: boolean;
    let pendingUnlockDeadline: string | null;

    try {
      [userCanBet, pendingUnlockDeadline] = await Promise.all([
        getUserCanBet(user.id),
        getPendingUnlockDeadline(user.id),
      ]);
      if (verbose) console.log(`[Security] User can bet: ${userCanBet}, Pending unlock deadline: ${pendingUnlockDeadline || 'none'}`);
    } catch (error) {
      errors.push(`Failed to get user status: ${(error as Error).message}`);
      if (verbose) console.log(`[Security] Failed to get user status: ${(error as Error).message}`);
      return { success: false, canBet: false, errors };
    }

    // Step 3: PRIORITY CHECK - Validate pending unlock deadline (time-sensitive)
    // Validation: Check if pending unlock deadline has expired
    if (pendingUnlockDeadline) {
      if (verbose) console.log(`[Security] Step 3: Checking pending unlock deadline expiry`);
      const deadlineTimestamp = BigInt(pendingUnlockDeadline);
      if (currentTimestamp < deadlineTimestamp) {
        if (verbose) console.log(`[Security] Unlock deadline still valid, disabling betting, currentTimestamp: ${currentTimestamp.toString()}, deadlineTimestamp: ${deadlineTimestamp.toString()}`);
        errors.push(`Unlock deadline still valid`);
        return { success: false, canBet: false, errors };
      } else {
        if (verbose) console.log(`[Security] Unlock deadline not valid anymore`);
      }
    }

    // Step 4: Query both lock and unlock events in parallel
    if (verbose) console.log(`[Security] Step 4: Querying lock/unlock events`);
    let lastLockEvent: LockEvent | null;
    let lastUnlockEvent: UnlockEvent | null;

    try {
      [lastLockEvent, lastUnlockEvent] = await Promise.all([
        getLastLockEvent(user.nearNamedAddress),
        getLastUnlockEvent(user.nearNamedAddress),
      ]);
      if (verbose) console.log(`[Security] Last lock event: ${lastLockEvent?.timestamp || 'none'}, Last unlock event: ${lastUnlockEvent?.timestamp || 'none'}`);
    } catch (error) {
      errors.push(`Failed to query lock/unlock events: ${(error as Error).message}`);
      if (verbose) console.log(`[Security] Failed to query events: ${(error as Error).message}`);
      return { success: false, canBet: false, errors };
    }

    // Step 5: Check if user has any transaction history
    // Validation: Handle new users with no blockchain transaction history
    if (!lastLockEvent && !lastUnlockEvent) {
      if (verbose) console.log(`[Security] Step 5: New user with no transaction history, allowing betting`);
      // New user with no history - allow betting
      canBet = true;
      // First create the balance record for the user
      await updateBalanceOnDB(user.id, user.nearNamedAddress);
      // Then set the userCanBet status to true
      await setUserCanBet(user.id, true);
      if (verbose) console.log(`[Security] New user setup completed, betting enabled`);
      return {
        success: true,
        canBet: true,
        errors: [],
        debugInfo: {
          currentTimestamp: currentTimestamp.toString(),
          pendingUnlockDeadline: pendingUnlockDeadline || 'none',
        },
      };
    }

    // Step 6: Determine which event is more recent
    const lockIsMoreRecent = isLockMoreRecentThanUnlock(lastLockEvent, lastUnlockEvent);
    if (verbose) console.log(`[Security] Step 6: Lock is more recent than unlock: ${lockIsMoreRecent}`);

    // Step 7: Main validation logic
    if (verbose) console.log(`[Security] Step 7: Main validation logic - userCanBet: ${userCanBet}`);
    // Validation: User has betting permission enabled
    if (userCanBet === true) {
      // Validation: Lock transaction is more recent than unlock
      if (lockIsMoreRecent) {
        // User can bet and lock is more recent - do nothing, allow betting
        if (verbose) console.log(`[Security] User can bet and lock is recent - allowing betting`);
        canBet = true;
      } else {
        // User can bet but unlock is more recent - this shouldn't happen in normal flow
        if (verbose) console.log(`[Security] User can bet but unlock is more recent - disabling betting`);
        canBet = false;
      }
    } else {
      // userCanBet === false
      // Validation: Lock transaction is more recent than unlock (balance sync needed)
      if (lockIsMoreRecent) {
        if (verbose) console.log(`[Security] User cannot bet but lock is recent - starting balance sync`);
        // User cannot bet but lock is more recent - need to sync balances and cleanup

        try {
          // Enter balance synchronization loop with atomic transactions
          let balanceSyncAttempts = 0;
          const maxSyncAttempts = 5;
          let syncSuccessful = false;

          // Validation: Balance synchronization retry loop with maximum attempts
          while (!syncSuccessful && balanceSyncAttempts < maxSyncAttempts) {
            balanceSyncAttempts++;
            if (verbose) console.log(`[Security] Balance sync attempt ${balanceSyncAttempts}/${maxSyncAttempts}`);

            try {
              // Use Prisma transaction for atomic balance updates
              await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                // Update both balances to match contract within transaction
                await updateBalanceOnDB(user.id, user.nearNamedAddress, tx);

                // Check if balances are synced and if account is still locked (in parallel)
                const [balancesAreSynced, accountIsStillLocked] = await Promise.all([
                  checkBalancesAreSynced(user.id, user.nearNamedAddress, tx),
                  isAccountLocked(user.nearNamedAddress),
                ]);

                // Validation: Database balances match contract balances
                if (!balancesAreSynced) {
                  throw new Error(
                    `Balances are not synchronized after update attempt ${balanceSyncAttempts}`,
                  );
                }

                // Validation: Contract account is no longer locked
                if (!accountIsStillLocked) {
                  throw new Error(
                    `Account is still locked on contract after sync attempt ${balanceSyncAttempts}`,
                  );
                }

                // If we reach here, both conditions are met - transaction will commit
              });

              // If transaction completed successfully, we're done
              syncSuccessful = true;
              if (verbose) console.log(`[Security] Balance sync successful on attempt ${balanceSyncAttempts}`);
              break;
            } catch (syncError) {
              if (verbose) console.log(`[Security] Balance sync attempt ${balanceSyncAttempts} failed: ${(syncError as Error).message}`);
              // Validation: Maximum synchronization attempts reached
              if (balanceSyncAttempts >= maxSyncAttempts) {
                errors.push(
                  `Balance synchronization failed after ${maxSyncAttempts} attempts with automatic rollbacks: ${(syncError as Error).message}`,
                );
                return { success: false, canBet: false, errors };
              }

              // Wait before next attempt
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          // Validation: Balance synchronization completed successfully
          if (syncSuccessful) {
            // Successful synchronization - cleanup and allow betting (in parallel)
            if (verbose) console.log(`[Security] Balance sync completed, cleaning up and enabling betting`);

            await  setUserCanBet(user.id, true);
            canBet = true;
          } else {
            // This shouldn't happen due to the loop logic, but safety check
            errors.push(
              `Balance synchronization failed to complete after ${maxSyncAttempts} attempts`,
            );
            await setUserCanBet(user.id, false);
            return { success: false, canBet: false, errors };
          }
        } catch (error) {
          errors.push(`Balance synchronization process failed: ${(error as Error).message}`);
          if (verbose) console.log(`[Security] Balance sync process failed: ${(error as Error).message}`);
          return { success: false, canBet: false, errors };
        }
      } else {
        // User cannot bet and unlock is more recent - keep userCanBet as false
        if (verbose) console.log(`[Security] User cannot bet and unlock is more recent - keeping betting disabled`);
        canBet = false;
        await setUserCanBet(user.id, false);
      }
    }

    if (verbose) console.log(`[Security] Validation completed - Final result: canBet=${canBet}`);

    return {
      success: true,
      canBet,
      errors,
      debugInfo: {
        lastLockTimestamp: lastLockEvent?.timestamp || 'none',
        lastUnlockTimestamp: lastUnlockEvent?.timestamp || 'none',
        lockIsMoreRecent,
        currentTimestamp: currentTimestamp.toString(),
        pendingUnlockDeadline: pendingUnlockDeadline || 'none',
      },
    };
  } catch (error) {
    errors.push(`Validation process failed: ${(error as Error).message}`);
    return { success: false, canBet: false, errors };
  }
}

/**
 * User Betting Permission Status Retrieval
 *
 * Retrieves the current betting permission status for a user from the database.
 * This function is used to check if a user is currently allowed to place bets
 * based on their stored permission state.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<boolean>} User's current betting permission status
 *
 * @throws {Error} Database query failure when fetching user balance record
 * @throws {Error} Database connection issues during permission lookup
 *
 * @example
 * ```typescript
 * const canBet = await getUserCanBet(123);
 * console.log('User betting permission:', canBet);
 * ```
 */
export async function getUserCanBet(userId: number): Promise<boolean> {
  try {
    const userBalance = await prisma.userBalance.findUnique({
      where: {
        userId: userId,
      },
      select: {
        userCanBet: true,
      },
    });

    // If no UserBalance record exists, default to false for safety
    return userBalance?.userCanBet ?? false;
  } catch (error) {
    throw new Error(`Failed to fetch userCanBet status: ${(error as Error).message}`);
  }
}

/**
 * User Betting Permission Status Update
 *
 * Sets the betting permission status for a user in the database. This function
 * creates or updates the user's balance record with the specified betting permission.
 * Used during security validation to enable/disable betting based on lock status.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @param {boolean} canBet - New betting permission status to set
 * @returns {Promise<void>} Resolves when permission status is updated
 *
 * @throws {Error} Database upsert operation failure during permission update
 * @throws {Error} Database connection issues during status modification
 *
 * @security CRITICAL: This function controls user betting permissions
 *
 * @example
 * ```typescript
 * await setUserCanBet(123, true);  // Enable betting
 * await setUserCanBet(123, false); // Disable betting
 * ```
 */
export async function setUserCanBet(userId: number, canBet: boolean): Promise<void> {
  try {
    await prisma.userBalance.upsert({
      where: {
        userId: userId,
      },
      update: {
        userCanBet: canBet,
      },
      create: {
        userId: userId,
        onchainBalance: 0,
        virtualBalance: 0,
        userCanBet: canBet,
      },
    });
  } catch (error) {
    throw new Error(`Failed to set userCanBet status: ${(error as Error).message}`);
  }
}

/**
 * Pending Unlock Deadline Retrieval
 *
 * Retrieves the pending unlock deadline timestamp for a user from the database.
 * This deadline represents when a user's unlock operation will timeout and their
 * betting permissions will be automatically revoked for security.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<string | null>} Deadline timestamp in nanoseconds, or null if no deadline set
 *
 * @throws {Error} Database query failure when fetching user balance record
 * @throws {Error} Timestamp conversion failure during deadline processing
 *
 * @example
 * ```typescript
 * const deadline = await getPendingUnlockDeadline(123);
 * if (deadline) {
 *   console.log('Unlock deadline:', deadline);
 * }
 * ```
 */
export async function getPendingUnlockDeadline(userId: number): Promise<string | null> {
  try {
    const userBalance = await prisma.userBalance.findUnique({
      where: {
        userId: userId,
      },
      select: {
        pendingUnlockDeadline: true,
      },
    });

    // Convert DateTime to nanosecond timestamp string if it exists
    // Validation: Check if pending unlock deadline exists in database
    if (userBalance?.pendingUnlockDeadline) {
      // Convert to nanoseconds (Date.getTime() returns milliseconds)
      const timestampNanos = BigInt(userBalance.pendingUnlockDeadline.getTime() * 1_000_000);
      return timestampNanos.toString();
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to fetch pendingUnlockDeadline: ${(error as Error).message}`);
  }
}

/**
 * Pending Unlock Deadline Configuration
 *
 * Sets a pending unlock deadline for a user, creating a time-based security constraint
 * that will automatically revoke betting permissions if the unlock operation is not
 * completed within the specified timeframe.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @param {string} deadlineNanoseconds - Deadline timestamp in nanoseconds as string
 * @returns {Promise<void>} Resolves when deadline is configured
 *
 * @throws {Error} Timestamp conversion failure during deadline parsing
 * @throws {Error} Database upsert operation failure during deadline update
 *
 * @security WARNING: This function sets time-based security constraints for unlock operations
 *
 * @example
 * ```typescript
 * const futureDeadline = (Date.now() + 300000) * 1_000_000; // 5 minutes from now
 * await setPendingUnlockDeadline(123, futureDeadline.toString());
 * ```
 */
export async function setPendingUnlockDeadline(
  userId: number,
  deadlineNanoseconds: string,
): Promise<void> {
  try {
    // Convert nanoseconds to JavaScript Date (divide by 1,000,000 to get milliseconds)
    const deadlineMs = parseInt(deadlineNanoseconds, 10) / 1_000_000;
    const deadlineDate = new Date(deadlineMs);

    await prisma.userBalance.upsert({
      where: {
        userId: userId,
      },
      update: {
        pendingUnlock: true,
        pendingUnlockDeadline: deadlineDate,
        updatedAt: new Date(),
      },
      create: {
        userId: userId,
        onchainBalance: 0,
        virtualBalance: 0,
        pendingUnlock: true,
        pendingUnlockDeadline: deadlineDate,
      },
    });
  } catch (error) {
    throw new Error(`Failed to set pendingUnlockDeadline: ${(error as Error).message}`);
  }
}

/**
 * Pending Unlock Deadline Cleanup
 *
 * Clears the pending unlock deadline and unlock status for a user, typically
 * called after successful unlock completion or when resetting user state.
 * This operation removes time-based security constraints.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<void>} Resolves when deadline is cleared
 *
 * @throws {Error} Database update operation failure during deadline cleanup
 * @throws {Error} Database connection issues during status modification
 *
 * @example
 * ```typescript
 * await clearPendingUnlockDeadline(123);
 * console.log('Unlock deadline cleared for user');
 * ```
 */
export async function clearPendingUnlockDeadline(userId: number): Promise<void> {
  try {
    await prisma.userBalance.update({
      where: {
        userId: userId,
      },
      data: {
        pendingUnlock: false,
        pendingUnlockDeadline: null,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    throw new Error(`Failed to clear pendingUnlockDeadline: ${(error as Error).message}`);
  }
}

/**
 * Database Balance Synchronization
 *
 * Updates user's balances (both onchain and virtual) in the database to match
 * the current balance stored in the smart contract. This function ensures
 * consistency between contract state and database records.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @param {string} nearNamedAddress - NEAR Protocol named address for balance lookup
 * @param {Prisma.TransactionClient} [tx] - Optional database transaction client for atomic operations
 * @returns {Promise<void>} Resolves when balances are synchronized
 *
 * @throws {Error} Contract balance query failure during synchronization
 * @throws {Error} Database upsert operation failure during balance update
 *
 * @security CRITICAL: This function synchronizes financial balances between contract and database
 *
 * @example
 * ```typescript
 * await updateBalanceOnDB(123, 'user.near');
 * console.log('User balances synchronized with contract');
 * ```
 */
async function updateBalanceOnDB(
  userId: number,
  nearNamedAddress: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  try {
    // Get balance from contract
    const contractBalance = await getOnChainUsdcBalance(AGC_CONTRACT_ID, nearNamedAddress);

    // Update both balances in single upsert
    const prismaClient = tx || prisma;
    await prismaClient.userBalance.upsert({
      where: { userId: userId },
      update: {
        onchainBalance: contractBalance,
        virtualBalance: contractBalance,
      },
      create: {
        userId: userId,
        onchainBalance: contractBalance,
        virtualBalance: contractBalance,
        userCanBet: false,
      },
    });
  } catch (error) {
    throw new Error(`Failed to update balances: ${(error as Error).message}`);
  }
}

/**
 * Balance Synchronization Validation
 *
 * Verifies that user's database balances (both onchain and virtual) match
 * the current balance stored in the smart contract. Used to ensure data
 * consistency before completing security validation operations.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @param {string} nearNamedAddress - NEAR Protocol named address for balance verification
 * @param {Prisma.TransactionClient} [tx] - Optional database transaction client for atomic operations
 * @returns {Promise<boolean>} True if balances are synchronized, false otherwise
 *
 * @throws {Error} Contract balance query failure during verification
 * @throws {Error} Database query failure when fetching stored balances
 *
 * @example
 * ```typescript
 * const isSync = await checkBalancesAreSynced(123, 'user.near');
 * if (isSync) {
 *   console.log('Balances are synchronized');
 * }
 * ```
 */
async function checkBalancesAreSynced(
  userId: number,
  nearNamedAddress: string,
  tx?: Prisma.TransactionClient,
): Promise<boolean> {
  try {
    // Get balance from contract
    const contractBalance = await getOnChainUsdcBalance(AGC_CONTRACT_ID, nearNamedAddress);

    // Get balances from database
    const prismaClient = tx || prisma;
    const userBalance = await prismaClient.userBalance.findUnique({
      where: { userId },
      select: {
        onchainBalance: true,
        virtualBalance: true,
      },
    });

    // Validation: Check if user balance record exists in database
    if (!userBalance) {
      // No database record means not synced
      return false;
    }

    // Check if both database balances match the contract balance
    const onchainSynced = userBalance.onchainBalance === contractBalance;
    const virtualSynced = userBalance.virtualBalance === contractBalance;

    return onchainSynced && virtualSynced;
  } catch (error) {
    throw new Error(`Failed to check balance synchronization: ${(error as Error).message}`);
  }
}
