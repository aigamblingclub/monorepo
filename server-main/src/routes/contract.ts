import { Router } from 'express';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import { 
  validateUnlockRequest, 
  signGameResult, 
  GameResult 
} from '@/utils/contract';
import { getOnChainNonce } from '@/utils/near';
import { AGC_CONTRACT_ID } from '@/utils/env';

const router = Router();

interface SignMessageRequest {
  nearImplicitAddress: string;
}

interface SignMessageResponse {
  success: boolean;
  signature?: string;
  gameResult?: GameResult;
  error?: string;
}

/**
 * @swagger
 * /api/contract/sign-message:
 *   post:
 *     summary: Sign a message to unlock USDC balance for the AI Gambling Club contract
 *     tags: [Contract]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nearImplicitAddress
 *               - unlockUsdcBalance
 *             properties:
 *               nearImplicitAddress:
 *                 type: string
 *                 description: NEAR wallet implicit address
 *               unlockUsdcBalance:
 *                 type: number
 *                 description: Amount to unlock in USDC (with 6 decimals)
 *     responses:
 *       200:
 *         description: Message signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 signature:
 *                   type: string
 *                 gameResult:
 *                   type: object
 *                   properties:
 *                     accountId:
 *                       type: string
 *                     amount:
 *                       type: string
 *                     nonce:
 *                       type: number
 *       400:
 *         description: Invalid request or insufficient balance
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is in an active game
 *       500:
 *         description: Internal server error
 */
router.post('/sign-message', validateApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const { nearImplicitAddress }: SignMessageRequest = req.body;

    // Validate required fields
    if (!nearImplicitAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: nearImplicitAddress' 
      });
    }

    // Validate unlock request with all business logic
    const validation = await validateUnlockRequest(
      nearImplicitAddress, 
    );

    if (!validation.isValid) {
      const statusCode = validation.error?.includes('active game') ? 403 : 400;
      return res.status(statusCode).json({ 
        success: false, 
        error: validation.error 
      });
    }

    if (!validation.virtualBalanceChange) {
      return res.status(400).json({ 
        success: false, 
        error: 'Virtual balance is not available' 
      });
    }

    if (!validation.currentNonce) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current nonce is not available' 
      });
    }

    // Create game result structure
    const gameResult: GameResult = {
      accountId: nearImplicitAddress,
      amount: validation.virtualBalanceChange.toString(),
      nonce: validation.currentNonce,
      deadline: (Date.now() * 1_000_000 + 60_000_000_000).toString() // 1 minute from now in nanoseconds
    };

    // TODO: change pendingUnlockDeadline to 1 minute from now in nanoseconds

    // Sign the message
    const signature = await signGameResult(gameResult);

    const response: SignMessageResponse = {
      success: true,
      signature,
      gameResult
    };

    return res.json(response);

  } catch (error) {
    console.error('Sign message error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;
