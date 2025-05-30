import { Router } from 'express';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import { PrismaClient } from '@/prisma';
import { getUserBalance } from '@/utils/balance';

const prisma = new PrismaClient();
const router = Router();

// Extend AuthenticatedRequest to include user
interface ExtendedAuthenticatedRequest extends AuthenticatedRequest {
  user?: {
    id: number;
  };
}

interface GetBalanceResponse {
  success: boolean;
  balance?: number;
  error?: string;
}

/**
 * @swagger
 * /api/balance/virtual:
 *   get:
 *     summary: Get user's virtual balance (on-chain USDC + virtual balance)
 *     tags: [Balance]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Virtual balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 onchainBalance:
 *                   type: number
 *                 virtualBalance:
 *                   type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', validateApiKey, async (req: ExtendedAuthenticatedRequest, res) => {
  try {
    console.log("🔍 req.user:", req.user);
    const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

     const { virtualBalance } = await getUserBalance(userId);
      console.log("🔍 virtualBalance:", virtualBalance);
      const response: GetBalanceResponse = {
        success: true,
        balance: virtualBalance
      };

      return res.json(response);

    } catch (error) {
      console.error('Get virtual balance error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
});

export default router; 