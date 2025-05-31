import { Router } from 'express';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import { PrismaClient, Prisma } from '../prisma/generated';

const prisma = new PrismaClient();
const router = Router();

interface CreateBetRequest {
  tableId: string;
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
 *               - tableId
 *               - playerId
 *               - amount
 *             properties:
 *               tableId:
 *                 type: string
 *                 description: ID of the table
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
    console.log('🔍 req.body:', req.body);
    const { playerId, amount }: CreateBetRequest = req.body;
    const userId = req.user?.id;
    console.log('🔍 userId:', userId);
    console.log('🔍 playerId:', playerId);
    console.log('🔍 amount:', amount);
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
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bet amount must be greater than 0',
      });
    }

    // current table
    const currentTable = await prisma.table.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log('🔍 currentTable:', currentTable);
    if (!currentTable) {
      throw new Error('Table not found');
    }

    // Not do bets when the game was started, only when the game is waiting
    if (currentTable.tableStatus !== 'WAITING') {
      throw new Error('Table is not waiting, please wait for the next game');
    }

    // current table
    const currentPlayerTable = await prisma.player_Table.findFirst({
      where: { playerId: playerId, tableId: currentTable.tableId },
    });
    console.log('🔍 currentPlayerTable:', currentPlayerTable);
    if (!currentPlayerTable) {
      return res.status(400).json({
        success: false,
        error: 'Player is not in the table, please try again later',
      });
    }

    // Start a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get user's current balance
      const userBalance = await tx.userBalance.findFirst({
        where: { userId },
      });

      if (!userBalance) {
        throw new Error('User balance not found');
      }

      // Check if user has sufficient virtual balance
      if (userBalance.virtualBalance < amount) {
        throw new Error('Insufficient virtual balance');
      }

      // Get the current active round for the table
      // const currentRound = await tx.round.findFirst({
      //   where: {
      //     tableId,
      //     table: {
      //       tableStatus: 'PLAYING'
      //     }
      //   },
      //   orderBy: {
      //     roundNumber: 'desc'
      //   }
      // });

      // if (!currentRound) {
      //   throw new Error('No active round found for this table');
      // }

      // Create the bet
      const bet = await tx.userBet.create({
        data: {
          userId,
          tableId: currentTable.tableId,
          playerId,
          // roundId
          amount,
        },
      });

      // Update user's virtual balance
      await tx.userBalance.update({
        where: { id: userBalance.id },
        data: {
          virtualBalance: userBalance.virtualBalance - amount,
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

    return res.json(response);
  } catch (error) {
    console.error('Create bet error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
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
        error: 'User not authenticated'
      });
    }

    if (!tableId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: tableId'
      });
    }

    // Get user's bets for the table
    const userBets = await prisma.userBet.findMany({
      where: {
        tableId: tableId as string,
        userId
      }
    });

    return res.json({
      success: true,
      bets: userBets
    });
  } catch (error) {
    console.error('Get bet error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

router.get('/all', validateApiKey, async (req: ExtendedAuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }
    
    // Get the last table
    const table = await prisma.table.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Validate required fields
    if (!table) {
      return res.status(400).json({
        success: false,
        error: 'No table found'
      });
    }

    // Get all bets for the table with aggregations
    const [allBets, totalBetsResult, betsByPlayerResult] = await Promise.all([
      // Get all bets for the table
      prisma.userBet.findMany({
        where: {
          tableId: table.tableId
        }
      }),
      // Get total bets for the table
      prisma.userBet.aggregate({
        where: {
          tableId: table.tableId
        },
        _sum: {
          amount: true
        }
      }),
      // Get total bets by player
      prisma.userBet.groupBy({
        by: ['playerId'],
        where: {
          tableId: table.tableId
        },
        _sum: {
          amount: true
        }
      })
    ]);

    // Get user's bets by player
    const userBetsByPlayer = await prisma.userBet.groupBy({
      by: ['playerId'],
      where: {
        tableId: table.tableId,
        userId
      },
      _sum: {
        amount: true
      }
    });

    // Convert user bets to a map for easier lookup
    const userBetsMap = userBetsByPlayer.reduce((acc, bet) => {
      acc[bet.playerId] = bet._sum.amount || 0;
      return acc;
    }, {} as Record<string, number>);

    // Convert bets by player to the required format
    const totalBetsByPlayer = betsByPlayerResult.reduce((acc, bet) => {
      acc[bet.playerId] = bet._sum.amount || 0;
      return acc;
    }, {} as Record<string, number>);

    // Format response according to BetResponse interface
    const playerBets: BetResponse[] = betsByPlayerResult.map(bet => ({
      playerId: bet.playerId,
      totalBet: bet._sum.amount || 0,
      totalUserBet: userBetsMap[bet.playerId] || 0
    }));

    const response: AllBetsResponse = {
      success: true,
      playerBets,
      totalBetsByPlayer,
      totalBets: totalBetsResult._sum.amount || 0
    };

    return res.json(response);
  } catch (error) {
    console.error('Get all bets error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router; 