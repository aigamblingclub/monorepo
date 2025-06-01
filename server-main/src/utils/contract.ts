import { ethers } from 'ethers';
import { PrismaClient } from '@/prisma';
import { getOnChainNonce, getOnChainUsdcBalance } from '@/utils/near';
import { AGC_CONTRACT_ID } from './env';

const prisma = new PrismaClient();

export interface GameResult {
  accountId: string;
  amount: string;
  nonce: number;
}

export interface ContractValidationResult {
  isValid: boolean;
  error?: string;
  userId?: number;
  currentNonce?: number;
  virtualBalance?: number;
}

/**
 * Initialize ethers wallet with backend private key
 */
export function initializeBackendWallet(): ethers.Wallet {
  const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;
  if (!backendPrivateKey) {
    throw new Error('BACKEND_PRIVATE_KEY not set in environment');
  }
  return new ethers.Wallet(backendPrivateKey);
}

/**
 * Sign a game result message using ethers wallet
 */
export async function signGameResult(gameResult: GameResult): Promise<string> {
  const wallet = initializeBackendWallet();
  const message = JSON.stringify(gameResult);
  return await wallet.signMessage(message);
}

/**
 * Query user by NEAR implicit address
 */
export async function getUserByNearAddress(nearImplicitAddress: string) {
  return await prisma.user.findUnique({
    where: { nearImplicitAddress },
    select: { id: true, nearImplicitAddress: true, nearNamedAddress: true }
  });
}

/**
 * Check if user has a pending unlock that hasn't expired yet
 */
export async function checkPendingUnlock(userId: number): Promise<{ hasPendingUnlock: boolean; error?: string }> {
  const userBalance = await prisma.userBalance.findFirst({
    where: { 
      userId,
      pendingUnlock: true,
      pendingUnlockDeadline: {
        gt: new Date() // Check if deadline is in the future
      }
    }
  });

  if (userBalance) {
    return { 
      hasPendingUnlock: true, 
      error: 'User has a pending unlock that has not expired yet' 
    };
  }

  return { hasPendingUnlock: false };
}

/**
 * Get user's last bet and check if they're in an active game
 */
export async function checkUserGameStatus(userId: number): Promise<{ canWithdraw: boolean; error?: string }> {
  const lastBet = await prisma.userBet.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      table: {
        select: { tableStatus: true, tableId: true }
      }
    }
  });

  if (!lastBet) {
    // User has never placed a bet, can withdraw
    return { canWithdraw: true };
  }

  if (lastBet.table.tableStatus !== 'GAME_OVER') {
    return { 
      canWithdraw: false, 
      error: `User is currently in an active game (Table: ${lastBet.table.tableId}, Status: ${lastBet.table.tableStatus})` 
    };
  }

  return { canWithdraw: true };
}

/**
 * Get user's current nonce from User table
 */
export async function getUserNonce(nearImplicitAddress: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { nearImplicitAddress },
    select: { nonce: true }
  });

  return user?.nonce || 0;
}

/**
 * Update user's nonce in User table
 */
export async function updateUserNonce(nearImplicitAddress: string, newNonce: number): Promise<void> {
  await prisma.user.update({
    where: { nearImplicitAddress },
    data: { nonce: newNonce }
  });
}

/**
 * Get user's virtual balance
 */
export async function getUserVirtualBalance(userId: number): Promise<number> {
  const userBalance = await prisma.userBalance.findFirst({
    where: { userId },
    select: { virtualBalance: true }
  });

  return userBalance?.virtualBalance || 0;
}

/**
 * Update user's balances in UserBalance table
 */
export async function updateUserBalances(userId: number, onchainBalance: number, virtualBalance: number): Promise<void> {
  // First try to find existing user balance
  const existingBalance = await prisma.userBalance.findFirst({
    where: { userId }
  });

  if (existingBalance) {
    await prisma.userBalance.update({
      where: { id: existingBalance.id },
      data: { 
        onchainBalance, 
        virtualBalance,
        updatedAt: new Date()
      }
    });
  } else {
    await prisma.userBalance.create({
      data: {
        userId,
        onchainBalance,
        virtualBalance
      }
    });
  }
}

/**
 * Validate unlock request with all business logic
 */
export async function validateUnlockRequest(
  nearImplicitAddress: string,
): Promise<ContractValidationResult> {
  try {
    // 1. Query User table
    const user = await getUserByNearAddress(nearImplicitAddress);
    if (!user) {
      return { isValid: false, error: 'User not found' };
    }

    // 2. Check if user has a pending unlock and if the deadline has passed
    const pendingUnlockCheck = await checkPendingUnlock(user.id);
    if (pendingUnlockCheck.hasPendingUnlock) {
      return { 
        isValid: false, 
        error: pendingUnlockCheck.error 
      };
    }
    
    // 3. Check if user is in an active game
    const gameStatus = await checkUserGameStatus(user.id);
    if (!gameStatus.canWithdraw) {
      return { isValid: false, error: gameStatus.error };
    }
    
    // 4. Check nonce synchronization
    const onChainNonce = await getOnChainNonce(AGC_CONTRACT_ID, nearImplicitAddress);
    const dbNonce = await getUserNonce(nearImplicitAddress);
    if (onChainNonce > dbNonce) {      
      const onChainBalance = await getOnChainUsdcBalance(AGC_CONTRACT_ID, nearImplicitAddress);
      
      // Update both nonce and balances in database
      await updateUserNonce(nearImplicitAddress, onChainNonce);
      await updateUserBalances(user.id, onChainBalance, onChainBalance);
      
      console.log(`Synced data for ${nearImplicitAddress}:`);
      console.log(`  Nonce: ${dbNonce} -> ${onChainNonce}`);
      console.log(`  Balance: synced to ${onChainBalance}`);
    }

    // 5. Get virtual balance
    const virtualBalance = await getUserVirtualBalance(user.id);

    return {
      isValid: true,
      userId: user.id,
      currentNonce: Math.max(dbNonce, onChainNonce),
      virtualBalance
    };

  } catch (error) {
    console.error('Validation error:', error);
    return { isValid: false, error: 'Internal validation error' };
  }
} 