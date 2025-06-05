import { prisma } from '@/config/prisma.config';


/**
 * User Bet Validation
 *
 * Verifies if a user is currently participating in an active game that would
 * prevent bet operations. Users cannot bet while actively
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
 * const status = await checkUserCanBet(123);
 * if (!status.canBet) {
 *   console.error('Cannot withdraw:', status.error);
 * }
 * ```
 */
export async function checkUserCanBet(
  userId: number,
): Promise<{ canBet: boolean; error?: string }> {
  try {
    const lastBet = await prisma.userBet.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        table: {
          select: { tableStatus: true, tableId: true },
        },
      },
    });

    // Validation: Check if user has never placed a bet
    if (!lastBet) {
      // User has never placed a bet, can bet
      return { canBet: true };
    }

    // Validation: Check if user has pending bet
    if (lastBet?.status === 'PENDING') {
      // User has pending bet, can't bet
      return { canBet: false };
    }

    return { canBet: true };
  } catch (error) {
    throw new Error('Error checking user game status');
  }
}

export async function updateUserBetStatus(betId: number) {
  const bet = await prisma.userBet.findFirst({
    where: { id: betId },
  });
  if (!bet) {
    throw new Error('Bet not found');
  }

  const table = await prisma.table.findFirst({
    where: { tableId: bet.tableId },
  });
  if (!table) {
    throw new Error('Table not found');
  }

  if (table.tableStatus !== 'GAME_OVER') {
    throw new Error('Table is not over');
  }

  const isWinner = table.tableStatus === 'GAME_OVER' && table.winners.includes(bet.playerId);
  if (isWinner) {
    await prisma.userBet.update({
      where: { id: betId },
      data: { status: 'WON' },
    });
  } else {
    await prisma.userBet.update({
      where: { id: betId },
      data: { status: 'LOST' },
    });
  }
}