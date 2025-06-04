/**
 * Rewards Management Utility Module
 *
 * Core functionality for handling game rewards, including reward calculation,
 * distribution, and balance synchronization. This module manages the reward
 * lifecycle from calculation to distribution.
 *
 * @fileoverview Reward calculation and distribution system
 * @version 1.0.0
 */

import { UserBet } from '@/prisma';
import { prisma } from '@/config/prisma.config';
import { updateUserBetStatus } from './bet';
import { validateUserCanBet } from './security';

// Type definitions for better TypeScript support
type BetData = {
  id: number;
  amount: number;
  playerId: string;
  userId: number;
};

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
export function normalizeWinners(winners: string | string[]): string[] {
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
 * User Virtual Balance Retrieval and Synchronization
 *
 * Retrieves and synchronizes a user's virtual balance with any pending rewards.
 * Updates the balance if there are pending rewards to be distributed.
 *
 * @param {number} userId - Unique identifier of the user
 * @param {boolean} verbose - Whether to log detailed information
 * @returns {Promise<number>} Updated virtual balance amount
 */
export async function getUserVirtualBalanceAndSync(userId: number, verbose: boolean = false): Promise<number> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId },
    });
    if(!user) throw new Error('User not found');
    
    const response = await validateUserCanBet(user.nearNamedAddress, verbose);
    if(!response.success) {
      throw new Error(`User cannot bet: ${response.errors[0]}`);
    }

    
    const userBalance = await prisma.userBalance.findFirst({
      where: { userId },
    });

    if (!userBalance) {
      if (verbose) {
        console.info('[getUserVirtualBalanceAndSync] User balance not found');
      }
      throw new Error('Could not find user balance');
    }

    let userVirtualBalance = userBalance.virtualBalance;

    const pendingRewards = await getPendingRewards(userId, verbose);
    if (pendingRewards.hasPendingRewards && pendingRewards.bet) {
      const userBalanceUpdated = await prisma.userBalance.update({
        where: { userId },
        data: { virtualBalance: userVirtualBalance + pendingRewards.rewardAmount },
      });
      if (verbose) {
        console.info('[getUserVirtualBalanceAndSync] User balance updated', userBalanceUpdated);
      }

      // update user bet status to WON
      await updateUserBetStatus(pendingRewards.bet.id);

      userVirtualBalance = userBalanceUpdated.virtualBalance;
    }
    return userVirtualBalance;
  } catch (error) {
    if (verbose) {
      console.error('[getUserVirtualBalanceAndSync] Error:', error);
    }
    throw new Error(`[BALANCE][SYNC] ${error}`);
  }
}

/**
 * Reward Distribution Calculation
 *
 * Implements a proportional reward distribution system that calculates how much
 * a user should receive based on their winning bets. The formula distributes 
 * the total pot among winners proportionally based on their individual bet amounts.
 *
 * @param {string} tableId - Unique identifier of the table
 * @param {number} userId - Unique identifier of the user
 * @param {string[]} winners - Array of winning player IDs
 * @param {boolean} verbose - Whether to log detailed calculation steps
 * @returns {Promise<number>} Calculated reward amount for the user
 *
 * @formula RewardDistribution = (UserBetAmount / TotalWinningBetsAmount) * TotalPot
 */
export async function calculateRewardDistribution(
  tableId: string, 
  userId: number, 
  winners: string[], 
  verbose: boolean = false
): Promise<number> {
  // Get all bets for this table to calculate reward distribution
  const allTableBets = await prisma.userBet.findMany({
    where: { tableId },
    select: { 
      id: true, 
      amount: true,
      playerId: true,
      userId: true
    },
  });
  
  if (verbose) {
    console.info('🔍 [calculateRewardDistribution] allTableBets', allTableBets);
  }

  // **REWARD DISTRIBUTION FORMULA IMPLEMENTATION**
  
  // 1. Calculate total pot (sum of all bets on the table)
  const totalPot = allTableBets.reduce((sum: number, bet: BetData) => sum + bet.amount, 0);
  
  // 2. Get all bets from winning players
  const winningBets = allTableBets.filter((bet: BetData) => winners.includes(bet.playerId));
  
  // 3. Calculate total amount bet by winners
  const totalWinningBetsAmount = winningBets.reduce((sum: number, bet: BetData) => sum + bet.amount, 0);
  
  // 4. Get user's total bet amount on winning players
  const userWinningBets = winningBets.filter((bet: BetData) => bet.userId === userId);
  const userTotalBetOnWinners = userWinningBets.reduce((sum: number, bet: BetData) => sum + bet.amount, 0);
  
  // 5. Calculate proportional reward using the distribution formula
  // Formula: (UserBetAmount / TotalWinningBetsAmount) * TotalPot
  let rewardAmount = 0;
  if (totalWinningBetsAmount > 0) {
    rewardAmount = Math.floor((userTotalBetOnWinners / totalWinningBetsAmount) * totalPot);
  }

  if (verbose) {
    console.info('🔍 === REWARD DISTRIBUTION CALCULATION ===');
    console.info('🔍 tableId:', tableId);
    console.info('🔍 userId:', userId);
    console.info('🔍 winners:', winners);
    console.info('🔍 totalPot:', totalPot);
    console.info('🔍 totalWinningBetsAmount:', totalWinningBetsAmount);
    console.info('🔍 userTotalBetOnWinners:', userTotalBetOnWinners);
    console.info('🔍 rewardAmount:', rewardAmount);
    console.info('🔍 ==========================================');
  }

  return rewardAmount;
}

/**
 * Pending Rewards Calculation with Distribution Formula
 *
 * Calculates pending rewards for a user based on their winning bets and implements
 * a proportional reward distribution system. The formula distributes the total pot
 * among winners proportionally based on their individual bet amounts.
 * Also updates bet status to WON or LOST based on game results.
 *
 * @param {number} userId - Unique identifier of the user in the database
 * @param {boolean} verbose - Whether to log detailed information
 * @returns {Promise<Object>} Object with pending rewards status, bet info, and calculated reward amount
 */
export async function getPendingRewards(userId: number, verbose: boolean = false): Promise<{ 
  hasPendingRewards: boolean; 
  bet: UserBet | null; 
  rewardAmount: number 
}> {
  // Check if user has pending bets
  const userBet = await prisma.userBet.findFirst({
    where: { userId, status: 'PENDING' },
  });
  
  if (verbose) {
    console.info('🔍 [getPendingRewards] userBet', userBet);
  }
  
  if (!userBet) {
    if (verbose) {
      console.info('🔍 [getPendingRewards] No pending bets found');
    }
    return { hasPendingRewards: false, bet: null, rewardAmount: 0 };
  }

  // Get table information
  const table = await prisma.table.findFirst({
    where: { tableId: userBet.tableId },
  });
  
  if (verbose) {
    console.info('🔍 [getPendingRewards] table', table);
  }
  
  if (!table) {
    if (verbose) {
      console.info('🔍 [getPendingRewards] Table not found');
    }
    return { hasPendingRewards: false, bet: null, rewardAmount: 0 };
  }

  // Check if game is over and user is a winner
  const isGameOver = table.tableStatus === 'GAME_OVER';
  const normalizedWinners = normalizeWinners(table.winners);
  const isWinner = isGameOver && normalizedWinners.includes(userBet.playerId);

  if (verbose) {
    console.info('🔍 [getPendingRewards] tableStatus', table.tableStatus);
    console.info('🔍 [getPendingRewards] table.winners (raw)', table.winners);
    console.info('🔍 [getPendingRewards] normalizedWinners', normalizedWinners);
    console.info('🔍 [getPendingRewards] isGameOver', isGameOver);
    console.info('🔍 [getPendingRewards] isWinner', isWinner);
  }

  // If game is over but user didn't win, update bet status to LOST
  if (isGameOver && !isWinner) {
    if (verbose) {
      console.info('🔍 [getPendingRewards] Updating bet status to LOST');
    }
    
    await prisma.userBet.update({
      where: { id: userBet.id },
      data: { status: 'LOST' },
    });

    // Return updated bet object
    const updatedBet = { ...userBet, status: 'LOST' as const };
    return { hasPendingRewards: false, bet: updatedBet, rewardAmount: 0 };
  }

  // If game is not over, return early (no rewards yet)
  if (!isGameOver) {
    return { hasPendingRewards: false, bet: userBet, rewardAmount: 0 };
  }

  // At this point: isGameOver && isWinner
  // Calculate reward distribution 
  const rewardAmount = await calculateRewardDistribution(
    table.tableId, 
    userId, 
    normalizedWinners, 
    verbose
  );

  if (verbose) {
    console.info('🔍 [getPendingRewards] User is a winner, will update bet status to WON in getUserVirtualBalanceAndSync');
  }

  return { 
    hasPendingRewards: true, 
    bet: userBet, 
    rewardAmount 
  };
} 