/**
 * Security Validation Utility
 * 
 * Core function to validate if a user can place bets based on lock/unlock status
 */

import { getUserByNearAddress } from './contract';
import { getLastLockEvent, getLastUnlockEvent, isLockMoreRecentThanUnlock, LockEvent, UnlockEvent } from './events';
import { PrismaClient, Prisma } from '@/prisma';

const prisma = new PrismaClient();

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
 * Main security validation function
 * Determines if a user can place bets based on their lock/unlock transaction history
 */
export async function validateUserCanBet(nearNamedAddress: string): Promise<SecurityValidationResult> {
  const errors: string[] = [];
  let canBet = false;
  
  try {
      
    const user = await getUserByNearAddress(nearNamedAddress);
    if (!user) {
        return { success: false, canBet: false, errors: ['User not found'] };
    }
    console.log(`Starting security validation for user: ${user.nearNamedAddress}`);
    
    // Step 1: Get current timestamp in nanoseconds
    const currentTimestamp = BigInt(Date.now() * 1_000_000);
    
    // Step 2: Get user's current betting status and pending unlock deadline
    let userCanBet: boolean;
    let pendingUnlockDeadline: string | null;
    
    try {
      userCanBet = await getUserCanBet(user.id);
      pendingUnlockDeadline = await getPendingUnlockDeadline(user.id);
    } catch (error) {
      errors.push(`Failed to get user status: ${(error as Error).message}`);
      return { success: false, canBet: false, errors };
    }
    
    // Step 3: PRIORITY CHECK - Validate pending unlock deadline (time-sensitive)
    if (pendingUnlockDeadline) {
      const deadlineTimestamp = BigInt(pendingUnlockDeadline);
      if (currentTimestamp > deadlineTimestamp) {
        console.log(`DEADLINE EXPIRED: Current time (${currentTimestamp}) > deadline (${deadlineTimestamp}) - setting userCanBet to false`);
        try {
          await setUserCanBet(user.id, false);
          userCanBet = false;
        } catch (error) {
          errors.push(`Failed to update userCanBet status after deadline expiry: ${(error as Error).message}`);
          return { success: false, canBet: false, errors };
        }
      }
    }
    
    // Step 4: Query both lock and unlock events in parallel
    let lastLockEvent: LockEvent | null;
    let lastUnlockEvent: UnlockEvent | null;
    
    try {
      [lastLockEvent, lastUnlockEvent] = await Promise.all([
        getLastLockEvent(user.nearNamedAddress),
        getLastUnlockEvent(user.nearNamedAddress)
      ]);
    } catch (error) {
      errors.push(`Failed to query lock/unlock events: ${(error as Error).message}`);
      return { success: false, canBet: false, errors };
    }
    
    // Step 5: Check if user has any transaction history
    if (!lastLockEvent && !lastUnlockEvent) {
      // New user with no history - allow betting
      canBet = true;
      console.log(`User ${user.id} has no transaction history - allowing betting`);
      return { 
        success: true, 
        canBet: true, 
        errors: [],
        debugInfo: {
          currentTimestamp: currentTimestamp.toString(),
          pendingUnlockDeadline: pendingUnlockDeadline || 'none'
        }
      };
    }
    
    // Step 6: Determine which event is more recent
    const lockIsMoreRecent = isLockMoreRecentThanUnlock(lastLockEvent, lastUnlockEvent);
    
    console.log(`Lock is more recent: ${lockIsMoreRecent}`);
    console.log(`Current userCanBet status: ${userCanBet}`);
    console.log(`Pending unlock deadline: ${pendingUnlockDeadline}`);
    
    // Step 7: Main validation logic
    if (userCanBet === true) {
      if (lockIsMoreRecent) {
        // User can bet and lock is more recent - do nothing, allow betting
        console.log(`User can bet and lock is more recent - allowing betting`);
        canBet = true;
      } else {
        // User can bet but unlock is more recent - this shouldn't happen in normal flow
        console.log(`User can bet but unlock is more recent - allowing betting (normal post-unlock state)`);
        canBet = false;
      }
    } else { // userCanBet === false
      if (lockIsMoreRecent) {
        // User cannot bet but lock is more recent - need to sync balances and cleanup
        console.log(`User cannot bet but lock is more recent - starting balance synchronization`);
        
        try {
          // Enter balance synchronization loop with atomic transactions
          let balanceSyncAttempts = 0;
          const maxSyncAttempts = 5;
          let syncSuccessful = false;
          
          while (!syncSuccessful && balanceSyncAttempts < maxSyncAttempts) {
            balanceSyncAttempts++;
            console.log(`Balance sync attempt ${balanceSyncAttempts}/${maxSyncAttempts}`);
            
            try {
              // Use Prisma transaction for atomic balance updates
              await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                console.log(`Starting atomic balance sync transaction (attempt ${balanceSyncAttempts})`);
                
                // Update both balances to match contract within transaction
                await updateOnChainBalanceFromContract(user.id, tx);
                await updateVirtualBalanceFromContract(user.id, tx);
                
                // Check if balances are now the same (within transaction)
                const balancesAreSynced = await checkBalancesAreSynced(user.id, tx);
                
                // Check if account is still locked on contract
                const accountIsStillLocked = await checkAccountIsLocked(user.id);
                
                console.log(`Sync attempt ${balanceSyncAttempts}: balancesAreSynced=${balancesAreSynced}, accountIsStillLocked=${accountIsStillLocked}`);
                
                if (!balancesAreSynced) {
                  throw new Error(`Balances are not synchronized after update attempt ${balanceSyncAttempts}`);
                }
                
                if (accountIsStillLocked) {
                  throw new Error(`Account is still locked on contract after sync attempt ${balanceSyncAttempts}`);
                }
                
                // If we reach here, both conditions are met - transaction will commit
                console.log(`Balance synchronization transaction ${balanceSyncAttempts} successful - committing`);
              });
              
              // If transaction completed successfully, we're done
              syncSuccessful = true;
              break;
              
            } catch (syncError) {
              console.error(`Balance sync transaction attempt ${balanceSyncAttempts} failed (automatic rollback):`, syncError);
              
              if (balanceSyncAttempts >= maxSyncAttempts) {
                errors.push(`Balance synchronization failed after ${maxSyncAttempts} attempts with automatic rollbacks: ${(syncError as Error).message}`);
                return { success: false, canBet: false, errors };
              }
              
              // Wait before next attempt
              console.log(`Waiting 1 second before retry attempt ${balanceSyncAttempts + 1}...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (syncSuccessful) {
            // Successful synchronization - cleanup and allow betting
            console.log(`Balance synchronization successful - cleaning up and allowing betting`);
            
            await clearPendingUnlockDeadline(user.id);
            await setUserCanBet(user.id, true);
            canBet = true;
          } else {
            // This shouldn't happen due to the loop logic, but safety check
            errors.push(`Balance synchronization failed to complete after ${maxSyncAttempts} attempts`);
            return { success: false, canBet: false, errors };
          }
          
        } catch (error) {
          errors.push(`Balance synchronization process failed: ${(error as Error).message}`);
          return { success: false, canBet: false, errors };
        }
        
      } else {
        // User cannot bet and unlock is more recent - keep userCanBet as false
        console.log(`User cannot bet and unlock is more recent - denying betting`);
        canBet = false;
      }
    }
    
    // Step 8: Final result
    console.log(`Security validation complete for ${nearNamedAddress}: canBet=${canBet}`);
    
    return {
      success: true,
      canBet,
      errors,
      debugInfo: {
        lastLockTimestamp: lastLockEvent?.timestamp || 'none',
        lastUnlockTimestamp: lastUnlockEvent?.timestamp || 'none',
        lockIsMoreRecent,
        currentTimestamp: currentTimestamp.toString(),
        pendingUnlockDeadline: pendingUnlockDeadline || 'none'
      }
    };
    
  } catch (error) {
    console.error(`Security validation failed for ${nearNamedAddress}:`, error);
    errors.push(`Validation process failed: ${(error as Error).message}`);
    return { success: false, canBet: false, errors };
  }
}

/**
 * Get user's current betting permission status from database
 */
export async function getUserCanBet(userId: number): Promise<boolean> {
  try {
    const userBalance = await prisma.userBalance.findUnique({
      where: {
        userId: userId
      },
      select: {
        userCanBet: true
      }
    });

    // If no UserBalance record exists, default to false for safety
    return userBalance?.userCanBet ?? false;
  } catch (error) {
    console.error(`Error fetching userCanBet for user ${userId}:`, error);
    throw new Error(`Failed to fetch userCanBet status: ${(error as Error).message}`);
  }
}

/**
 * Set user's betting permission status in database
 */
export async function setUserCanBet(userId: number, canBet: boolean): Promise<void> {
  try {
    await prisma.userBalance.upsert({
      where: {
        userId: userId
      },
      update: {
        userCanBet: canBet
      },
      create: {
        userId: userId,
        onchainBalance: 0,
        virtualBalance: 0,
        userCanBet: canBet
      }
    });
  } catch (error) {
    console.error(`Error setting userCanBet for user ${userId} to ${canBet}:`, error);
    throw new Error(`Failed to set userCanBet status: ${(error as Error).message}`);
  }
}

/**
 * Get user's pending unlock deadline from database
 */
export async function getPendingUnlockDeadline(userId: number): Promise<string | null> {
  try {
    const userBalance = await prisma.userBalance.findUnique({
      where: {
        userId: userId
      },
      select: {
        pendingUnlockDeadline: true
      }
    });

    // Convert DateTime to nanosecond timestamp string if it exists
    if (userBalance?.pendingUnlockDeadline) {
      // Convert to nanoseconds (Date.getTime() returns milliseconds)
      const timestampNanos = BigInt(userBalance.pendingUnlockDeadline.getTime() * 1_000_000);
      return timestampNanos.toString();
    }

    return null;
  } catch (error) {
    console.error(`Error fetching pendingUnlockDeadline for user ${userId}:`, error);
    throw new Error(`Failed to fetch pendingUnlockDeadline: ${(error as Error).message}`);
  }
}

/**
 * Set pending unlock deadline for a user
 */
export async function setPendingUnlockDeadline(userId: number, deadlineNanoseconds: string): Promise<void> {
  try {
    // Convert nanoseconds to JavaScript Date (divide by 1,000,000 to get milliseconds)
    const deadlineMs = parseInt(deadlineNanoseconds, 10) / 1_000_000;
    const deadlineDate = new Date(deadlineMs);

    await prisma.userBalance.upsert({
      where: {
        userId: userId
      },
      update: {
        pendingUnlock: true,
        pendingUnlockDeadline: deadlineDate,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        onchainBalance: 0,
        virtualBalance: 0,
        pendingUnlock: true,
        pendingUnlockDeadline: deadlineDate
      }
    });
  } catch (error) {
    console.error(`Error setting pendingUnlockDeadline for user ${userId}:`, error);
    throw new Error(`Failed to set pendingUnlockDeadline: ${(error as Error).message}`);
  }
}

/**
 * Clear user's pending unlock deadline from database
 */
export async function clearPendingUnlockDeadline(userId: number): Promise<void> {
  try {
    await prisma.userBalance.update({
      where: {
        userId: userId
      },
      data: {
        pendingUnlock: false,
        pendingUnlockDeadline: null,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error(`Error clearing pendingUnlockDeadline for user ${userId}:`, error);
    throw new Error(`Failed to clear pendingUnlockDeadline: ${(error as Error).message}`);
  }
}

/**
 * Update user's on-chain balance to match contract balance
 */
async function updateOnChainBalanceFromContract(userId: number, tx?: Prisma.TransactionClient): Promise<void> {
  // TODO: Implement contract query and database update
  throw new Error('updateOnChainBalanceFromContract not implemented');
}

/**
 * Update user's virtual balance to match contract balance
 */
async function updateVirtualBalanceFromContract(userId: number, tx?: Prisma.TransactionClient): Promise<void> {
  // TODO: Implement contract query and database update
  throw new Error('updateVirtualBalanceFromContract not implemented');
}

/**
 * Check if user's on-chain and virtual balances are synchronized
 */
async function checkBalancesAreSynced(userId: number, tx?: Prisma.TransactionClient): Promise<boolean> {
  // TODO: Implement database query to compare balances
  throw new Error('checkBalancesAreSynced not implemented');
}

/**
 * Check if user's account is still locked on the contract
 */
async function checkAccountIsLocked(userId: number): Promise<boolean> {
  // TODO: Implement contract query for lock status
  throw new Error('checkAccountIsLocked not implemented');
} 