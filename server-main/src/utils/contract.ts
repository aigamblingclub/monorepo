/**
 * Contract Operations Utility Module
 *
 * Core contract operations for handling game result signing, user validation, and unlock
 * request processing. This module manages the interaction between the database state and
 * blockchain operations, ensuring proper validation and authorization for USDC unlock operations.
 *
 * @fileoverview Contract validation and signing system for AGC unlock operations
 * @version 1.0.0
 * @author 0xneves
 *
 * @security WARNING: This module handles cryptographic signing operations and financial validations.
 * All functions should be treated as security-critical, especially signing operations.
 *
 * @example
 * ```typescript
 * import { validateUnlockRequest, signGameResult } from './contract';
 *
 * const validation = await validateUnlockRequest('user.near');
 * if (validation.isValid) {
 *   const signature = await signGameResult(gameResult);
 * }
 * ```
 */

import { ethers } from 'ethers';
import { UserBet } from '@/prisma';
import { getOnChainNonce, isAccountLocked } from '@/utils/near';
import { prisma } from '@/config/prisma.config';
import { getUserVirtualBalanceAndSync } from './rewards';
import { getPendingUnlockDeadline, isPendingUnlockValid } from './security';

/**
 * @type {PrismaClient}
 * Database client instance for all contract-related database operations.
 * Used for user management, balance tracking, and validation operations.
 * Uses centralized prisma config that automatically selects test/prod client.
 */

/**
 * @typedef {Object} GameResult
 * @property {string} accountId - NEAR Protocol account identifier for the user
 * @property {string} amount - Amount to unlock in USDC (as string for precision)
 * @property {number} nonce - Current blockchain nonce for transaction ordering
 * @property {string} deadline - Deadline timestamp in nanoseconds for operation timeout
 */
export interface GameResult {
  accountId: string;
  amount: string;
  nonce: number;
  deadline: string;
}

/**
 * @typedef {Object} ContractValidationResult
 * @property {boolean} isValid - Whether the unlock request passes all validation checks
 * @property {string} [error] - Error message if validation fails
 * @property {number} [userId] - Database user ID if validation succeeds
 * @property {number} [currentNonce] - Current blockchain nonce for the user
 * @property {number} [virtualBalanceChange] - Amount difference for unlock operation
 */
export interface ContractValidationResult {
  isValid: boolean;
  error?: string;
  userId?: number;
  currentNonce?: number;
  virtualBalanceChange?: number;
}

// Type definitions for better TypeScript support
type BetData = {
  id: number;
  amount: number;
  playerId: string;
  userId: number;
};

/**
 * Backend Wallet Initialization
 *
 * Initializes an ethers.js wallet instance using the backend private key for
 * cryptographic signing operations. This wallet is used to sign game results
 * and authorize unlock operations.
 *
 * @returns {ethers.Wallet} Initialized ethers wallet instance
 *
 * @throws {Error} Missing BACKEND_PRIVATE_KEY environment variable
 * @throws {Error} Invalid private key format during wallet creation
 *
 * @security CRITICAL: This function handles the backend private key for signing operations
 *
 * @example
 * ```typescript
 * const wallet = initializeBackendWallet();
 * const signature = await wallet.signMessage('test message');
 * ```
 */
export function initializeBackendWallet(): ethers.Wallet {
  try {
    // Validation: Check if backend private key is configured
    const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;
    if (!backendPrivateKey) {
      throw new Error('BACKEND_PRIVATE_KEY not set in environment');
    }
    return new ethers.Wallet(backendPrivateKey);
  } catch (error) {
    throw new Error('Error initializing backend wallet');
  }
}

/**
 * Game Result Message Signing
 *
 * Signs a game result message using the backend wallet for authorization.
 * This signature is used by the smart contract to verify that the unlock
 * operation is authorized by the backend system.
 *
 * @param {GameResult} gameResult - Game result object containing unlock details
 * @returns {Promise<string>} Cryptographic signature of the game result message
 *
 * @throws {Error} Wallet initialization failure during signing process
 * @throws {Error} Message signing failure due to invalid parameters
 * @throws {Error} JSON serialization failure of game result object
 *
 * @security CRITICAL: This function produces authorization signatures for unlock operations
 *
 * @example
 * ```typescript
 * const gameResult = {
 *   accountId: 'user.near',
 *   amount: '1000000',
 *   nonce: 1,
 *   deadline: '1640995200000000000'
 * };
 * const signature = await signGameResult(gameResult);
 * ```
 */
export async function signGameResult(gameResult: GameResult): Promise<string> {
  try {
    const wallet = initializeBackendWallet();
    const message = JSON.stringify(gameResult);
    return await wallet.signMessage(message);
  } catch (error) {
    throw error;
  }
}

/**
 * User Lookup by NEAR Address
 *
 * Retrieves user information from the database using their NEAR Protocol address.
 * This function is used to identify users and obtain their database identifiers
 * for further validation operations.
 *
 * @param {string} nearNamedAddress - NEAR Protocol named address of the user
 * @returns {Promise<Object | null>} User object with id and address, or null if not found
 *
 * @throws {Error} Database query failure during user lookup
 * @throws {Error} Database connection issues during address resolution
 *
 * @example
 * ```typescript
 * const user = await getUserByNearAddress('alice.near');
 * if (user) {
 *   console.info('User found:', user.id);
 * }
 * ```
 */
export async function getUserByNearAddress(nearNamedAddress: string) {
  try {
    return await prisma.user.findUnique({
      where: { nearNamedAddress },
      select: { id: true, nearNamedAddress: true },
    });
  } catch (error) {
    throw new Error('Error getting user by NEAR address');
  }
}

/**
 * Pending Unlock Status Validation
 *
 * Checks if a user has an active pending unlock operation that hasn't expired yet.
 * This prevents users from initiating multiple concurrent unlock operations and
 * ensures proper sequencing of withdrawal requests.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<Object>} Object indicating pending unlock status and error message
 *
 * @throws {Error} Database query failure when checking pending unlock status
 * @throws {Error} Database connection issues during deadline verification
 *
 * @example
 * ```typescript
 * const result = await checkPendingUnlock(123);
 * if (result.hasPendingUnlock) {
 *   console.error('Cannot unlock:', result.error);
 * }
 * ```
 */
export async function checkPendingUnlock(
  userId: number,
  verbose: boolean = false,
): Promise<{ hasPendingUnlock: boolean; error?: string }> {
  try {
    const userBalance = await prisma.userBalance.findFirst({
      where: {
        userId,
        pendingUnlock: true,
        pendingUnlockDeadline: {
          gt: new Date(), // Check if deadline is in the future
        },
      },
    });

    // Validation: Check if user has active pending unlock operation
    if (userBalance) {
      if (verbose) {
        console.info('[checkPendingUnlock] User has a pending unlock that has not expired yet');
      }
      return {
        hasPendingUnlock: true,
        error: 'User has a recent unlock operation. Please wait 1 minute before trying again.',
      };
    }

    if (verbose) {
      console.info('[checkPendingUnlock] User has no pending unlock');
    }
    return { hasPendingUnlock: false };
  } catch (error) {
    throw new Error(`[checkPendingUnlock] Error checking pending unlock: ${error}`);
  }
}

/**
 * User Game Status Validation
 *
 * Verifies if a user is currently participating in an active game that would
 * prevent withdrawal operations. Users cannot unlock funds while actively
 * participating in ongoing games to maintain game integrity.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<Object>} Object indicating withdrawal eligibility and error details
 *
 * @throws {Error} Database query failure when fetching user's last bet
 * @throws {Error} Database join operation failure during table status lookup
 *
 * @example
 * ```typescript
 * const status = await checkUserCanUnlock(123);
 * if (!status.canUnlock) {
 *   console.error('Cannot withdraw:', status.error);
 * }
 * ```
 */
export async function checkUserCanUnlock(
  userId: number,
  verbose: boolean = false,
): Promise<{ canUnlock: boolean; error?: string }> {
  try {
    const lastBet = await prisma.userBet.findFirst({
      where: { userId }, // TODO: use userBet.status isntead
      orderBy: { createdAt: 'desc' },
      include: {
        table: {
          select: { tableStatus: true, tableId: true },
        },
      },
    });

    // Validation: Check if user has never placed a bet
    if (!lastBet) {
      // User has never placed a bet, can withdraw
      if (verbose) {
        console.info('[Contract] [checkUserCanUnlock] User has never placed a bet');
      }
      return { canUnlock: true };
    }

    // Validation: Check if user's last game is still active
    if (lastBet.table.tableStatus !== 'GAME_OVER') {
      if (verbose) {
        console.info('[Contract] [checkUserCanUnlock] User is currently in an active game');
      }
      return {
        canUnlock: false,
        error: `User is currently in an active game (Table: ${lastBet.table.tableId}, Status: ${lastBet.table.tableStatus})`,
      };
    }

    if (verbose) {
      console.info('[Contract] [checkUserCanUnlock] User can withdraw');
    }
    return { canUnlock: true };
  } catch (error) {
    throw new Error('Error checking user game status');
  }
}

/**
 * User Virtual Balance Retrieval
 *
 * Retrieves the user's current virtual balance from the database. Virtual balance
 * represents the user's balance after accounting for game winnings and losses
 * that haven't been synchronized to the blockchain yet.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<number>} User's current virtual balance amount
 *
 * @throws {Error} Database query failure when fetching virtual balance
 * @throws {Error} Database connection issues during balance lookup
 *
 * @example
 * ```typescript
 * const virtualBalance = await getUserVirtualBalance(123);
 * console.info('Virtual balance:', virtualBalance);
 * ```
 */
export async function getUserVirtualBalance(userId: number): Promise<number> {
  try {
    const userBalance = await prisma.userBalance.findFirst({
      where: { userId },
      select: { virtualBalance: true },
    });

    return userBalance?.virtualBalance || 0;
  } catch (error) {
    throw new Error('Error getting user virtual balance');
  }
}

/**
 * Winners Field Normalization
 *
 * Normalizes the winners field to handle both schema formats:
 * - Production/Dev: String[] (array)
 * - Tests: String (JSON string)
 *
 * @param {string | string[]} winners - Winners field from table
 * @returns {string[]} Normalized array of winner player IDs
 */
function normalizeWinners(winners: string | string[]): string[] {
  if (Array.isArray(winners)) {
    return winners; // Production/Dev format
  }
  
  if (typeof winners === 'string') {
    try {
      return JSON.parse(winners); // Test format
    } catch {
      return []; // Fallback for invalid JSON
    }
  }
  
  return []; // Fallback for unexpected types
}

/**
 * On-Chain Balance Retrieval
 *
 * Retrieves the user's on-chain balance as stored in the database. This represents
 * the user's balance that is currently synchronized with the smart contract state
 * on the blockchain.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<number>} User's current on-chain balance amount
 *
 * @throws {Error} Database query failure when fetching on-chain balance
 * @throws {Error} Database connection issues during balance lookup
 *
 * @example
 * ```typescript
 * const onChainBalance = await getUserOnChainBalance(123);
 * console.info('On-chain balance:', onChainBalance);
 * ```
 */
export async function getUserOnChainBalance(userId: number): Promise<number> {
  try {
    const userBalance = await prisma.userBalance.findFirst({
      where: { userId },
      select: { onchainBalance: true },
    });
    return userBalance?.onchainBalance || 0;
  } catch (error) {
    throw new Error(`[getUserOnChainBalance] Error getting user on-chain balance: ${error}`);
  }
}

/**
 * Unlock Amount Calculation
 *
 * Calculates the amount difference for unlock operations by comparing virtual
 * and on-chain balances. Returns positive values for winnings that need to be
 * unlocked and negative values for losses that need to be locked.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @returns {Promise<number>} Amount difference for unlock operation (positive for wins, negative for losses)
 *
 * @throws {Error} Virtual balance retrieval failure during calculation
 * @throws {Error} On-chain balance retrieval failure during calculation
 *
 * @example
 * ```typescript
 * const amountChange = await calculateUnlockAmountChange(123);
 * if (amountChange > 0) {
 *   console.info('User has winnings to unlock:', amountChange);
 * }
 * ```
 */
export async function calculateUnlockAmountChange(userId: number, verbose: boolean = false): Promise<number> {
  try {
    const virtualBalance = await getUserVirtualBalanceAndSync(userId, true);
    if (verbose) {
      console.info('[Contract] [calculateUnlockAmountChange] Virtual balance:', virtualBalance);
    }
    const onChainBalance = await getUserOnChainBalance(userId);
    if (verbose) {
      console.info('[Contract] [calculateUnlockAmountChange] On-chain balance:', onChainBalance);
    }
    // Return the difference (positive for wins, negative for losses)
    return virtualBalance - onChainBalance;
  } catch (error) {
    throw new Error(`[calculateUnlockAmountChange] Error calculating unlock amount change: ${error}`);
  }
}

/**
 * Comprehensive Unlock Request Validation
 *
 * Performs complete validation of unlock requests including user existence,
 * pending unlock status, active game participation, nonce synchronization,
 * and balance calculations. This is the main validation function for unlock operations.
 *
 * @param {string} nearNamedAddress - NEAR Protocol named address of the user
 * @returns {Promise<ContractValidationResult>} Complete validation result with unlock details
 *
 * @throws {Error} User lookup failure during validation process
 * @throws {Error} Pending unlock check failure during validation
 * @throws {Error} Game status validation failure during process
 * @throws {Error} Blockchain nonce query failure during validation
 * @throws {Error} Balance calculation failure during validation
 *
 * @security CRITICAL: This function performs comprehensive validation for financial operations
 *
 * @example
 * ```typescript
 * const result = await validateUnlockRequest('alice.near');
 * if (result.isValid) {
 *   console.info('Unlock authorized for amount:', result.virtualBalanceChange);
 * } else {
 *   console.error('Unlock denied:', result.error);
 * }
 * ```
 */
export async function validateUnlockRequest(
  nearNamedAddress: string,
  verbose: boolean = false,
): Promise<ContractValidationResult> {
  try {
    // 1. Query User table
    // Validation: Verify user exists in database
    const user = await getUserByNearAddress(nearNamedAddress);
    if (!user) {
      if (verbose) {
        console.info('User not found');
      }
      return { isValid: false, error: 'User not found' };
    }  

    // 2. Check if user has a pending unlock and if user is in an active game in parallel
    const [pendingUnlockCheck, tableStatus, pendingUnlockDeadline, accountIsLocked] = await Promise.all([
      checkPendingUnlock(user.id, verbose), // TODO: use getPendingUnlockDeadline instead
      checkUserCanUnlock(user.id, verbose),
      getPendingUnlockDeadline(user.id),
      isAccountLocked(user.nearNamedAddress),
    ]);

    if (!accountIsLocked) {
      if (verbose) {
        console.info('[Contract][validateUnlockRequest] Account is unlocked');
      }
      return { isValid: false, error: 'Account must be locked' };
    }

    // Validation: Check if user has active pending unlock operation
    if (pendingUnlockCheck.hasPendingUnlock) {
      if (verbose) {
        console.info('[Contract][validateUnlockRequest] User has active pending unlock operation');
      }
      return {
        isValid: false,
        error: pendingUnlockCheck.error,
      };
    }

    // Validation: Check if user can withdraw based on game status
    if (!tableStatus.canUnlock) {
      if (verbose) {
        console.info('[Contract][validateUnlockRequest] User cannot withdraw');
      }
      return { isValid: false, error: tableStatus.error };
    }

    // Security middleware for validating pending unlocks
    const currentTimestamp = BigInt(Date.now() * 1_000_000);
    // Validation: Check if user has betting permissions (security-critical)
    if (pendingUnlockDeadline && isPendingUnlockValid(BigInt(pendingUnlockDeadline), currentTimestamp)) {
      return { isValid: false, error: 'User has a recent unlock operation. Please wait 1 minute before trying again.' };
    }

    // 4. Check nonce synchronization and get virtual balance in parallel
    const [onChainNonce, virtualBalanceChange] = await Promise.all([
      getOnChainNonce(user.nearNamedAddress, verbose),
      calculateUnlockAmountChange(user.id, verbose),
    ]);

    if (verbose) {
      console.info('[Contract][validateUnlockRequest] On-chain nonce:', onChainNonce);
      console.info('[Contract][validateUnlockRequest] Virtual balance change:', virtualBalanceChange);
    }

    return {
      isValid: true,
      userId: user.id,
      currentNonce: onChainNonce,
      virtualBalanceChange,
    };
  } catch (error) {
    return { isValid: false, error: 'Internal validation error' };
  }
}
