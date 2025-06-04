import { Router } from 'express';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import { Prisma } from '@/prisma/generated';
import { getPendingUnlockDeadline, validateUserCanBet } from '../utils/security';
import { prisma } from '../config/prisma.config';
import { checkUserCanBet } from '@/utils/bet';
import { getUserVirtualBalanceAndSync } from '@/utils/rewards';

const router = Router();

interface CreateBetRequest {
  playerId: string;
  amount: number;
}

interface CreateBetResponse {
  success: boolean;
  bet?: {
    id: number;
    amount: number;
    createdAt: Date;
  };
  error?: string;
}

interface BetResponse {
  playerId: string;
  totalBet: number; // total bet amount of the player in the table
  totalUserBet: number; // total bet amount of the user in the table in the playerId
}

interface AllBetsResponse {
  success: boolean;
  playerBets: BetResponse[];
  totalBetsByPlayer: Record<string, number>; // total bets in the table by playerId
  totalBets: number; // total bet of the table
  error?: string;
}

// Extend AuthenticatedRequest to include user
interface ExtendedAuthenticatedRequest extends AuthenticatedRequest {
  user?: {
    id: number;
  };
}

/**
 * @swagger
 * /api/bet/create:
 *   post:
 *     summary: Create a new bet on a player in a specific table
 *     tags: [Bet]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - playerId
 *               - amount
 *             properties:
 *               playerId:
 *                 type: string
 *                 description: ID of the player to bet on
 *               amount:
 *                 type: number
 *                 description: Amount to bet
 *     responses:
 *       200:
 *         description: Bet created successfully
 *       400:
 *         description: Invalid request or insufficient balance
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', validateApiKey, async (req: ExtendedAuthenticatedRequest, res) => {
  try {
    const { playerId, amount }: CreateBetRequest = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Validate required fields
    if (!playerId || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: playerId, amount',
      });
    }

    // Validate amount
    if (typeof amount !== 'number' || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bet amount must be greater than 0',
      });
    }

    // Fetch user to get the address
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if user can bet on chain
    const validationResult = await validateUserCanBet(user.nearNamedAddress, true);
    if (!validationResult.success || !validationResult.canBet) {
      return res.status(400).json({
        success: false,
        error: validationResult.errors[0] || 'User cannot bet on chain',
      });
    }

    // Get current active table
    const currentTable = await prisma.table.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (currentTable?.tableStatus !== 'WAITING') {
      return res.status(400).json({
        success: false,
        error: 'Table is not waiting, please wait for the next game',
      });
    }

    // Check if player exists at table
    const playerTable = await prisma.player_Table.findFirst({
      where: { 
        playerId,
        tableId: currentTable.tableId,
        status: 'active'
      },
    });

    if (!playerTable) {
      return res.status(400).json({
        success: false,
        error: 'Player not at table',
      });
    }

    // Start a transaction to ensure atomicity
    try {
      
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {        
        // Get user's virtual balance and check if they have enough (within transaction)
        const virtualBalance = await getUserVirtualBalanceAndSync(userId, true);

        if (amount > virtualBalance) {
          throw new Error('Insufficient virtual balance');
        }

        // Check if user can bet
        const gameStatus = await checkUserCanBet(userId);
        if (!gameStatus.canBet) {
          throw new Error(gameStatus.error || 'User is in an active game');
        }

        // Check if user has pending unlock
        const pendingUnlockDeadline = await getPendingUnlockDeadline(userId);
        if(pendingUnlockDeadline && BigInt(pendingUnlockDeadline) > BigInt(Date.now() * 1_000_000)) {
          throw new Error('Pending unlock deadline');
        }

        // Create the bet
        const bet = await tx.userBet.create({
          data: {
            userId,
            tableId: currentTable.tableId,
            playerId,
            amount,
          },
        });

        // Update user's virtual balance
        const updatedBalance = await tx.userBalance.update({
          where: { userId },
          data: {
            virtualBalance: virtualBalance - amount,
          },
        });

        
        return bet;
      });
      
      const response: CreateBetResponse = {
        success: true,
        bet: {
          id: result.id,
          amount: result.amount,
          createdAt: result.createdAt,
        },
      };

      return res.status(200).json(response);
    } catch (error) {      
      if (error instanceof Error) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

router.get('/', validateApiKey, async (req: ExtendedAuthenticatedRequest, res) => {
  try {
    const { tableId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    if (!tableId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: tableId',
      });
    }

    // Get user's bets for the table
    const userBets = await prisma.userBet.findMany({
      where: {
        tableId: tableId as string,
        userId,
      },
    });

    return res.json({
      success: true,
      bets: userBets,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

router.get('/all', validateApiKey, async (req: ExtendedAuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    // Get the last table
    const table = await prisma.table.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Validate required fields
    if (!table) {
      return res.status(400).json({
        success: false,
        error: 'No table found',
      });
    }

    // Get all bets for the table with aggregations
    const [allBets, totalBetsResult] = await Promise.all([
      // Get all bets for the table
      prisma.userBet.findMany({
        where: {
          tableId: table.tableId,
        },
      }),
      // Get total bets for the table
      prisma.userBet.aggregate({
        where: {
          tableId: table.tableId,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    // Get total bets by player (separate from Promise.all to avoid TS issues)
    const betsByPlayerResult = await prisma.userBet.groupBy({
      by: ['playerId'],
      where: {
        tableId: table.tableId,
        status: 'PENDING',
      },
      _sum: {
        amount: true,
      },
    });

    // Get user's bets by player
    const userBetsByPlayer = await prisma.userBet.groupBy({
      by: ['playerId'],
      where: {
        tableId: table.tableId,
        userId,
        status: 'PENDING',
      },
      _sum: {
        amount: true,
      },
    });

    // Convert user bets to a map for easier lookup
    const userBetsMap = userBetsByPlayer.reduce(
      (acc: Record<string, number>, bet: { playerId: string; _sum: { amount: number | null } }) => {
        acc[bet.playerId] = bet._sum.amount || 0;
        return acc;
      },
      {} as Record<string, number>
    );

    // Convert bets by player to the required format
    const playerBets: BetResponse[] = betsByPlayerResult.map((bet: { playerId: string; _sum: { amount: number | null } }) => ({
      playerId: bet.playerId,
      totalBet: bet._sum.amount || 0,
      totalUserBet: userBetsMap[bet.playerId] || 0,
    }));

    const response: AllBetsResponse = {
      success: true,
      playerBets,
      totalBetsByPlayer: betsByPlayerResult.reduce(
        (acc: Record<string, number>, bet: { playerId: string; _sum: { amount: number | null } }) => {
          acc[bet.playerId] = bet._sum.amount || 0;
          return acc;
        },
        {} as Record<string, number>
      ),
      totalBets: totalBetsResult._sum.amount || 0,
    };

    return res.json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
