import { Router } from 'express';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import { 
  validateWithdrawalRequest, 
  signGameResult, 
  GameResult 
} from '@/utils/contract';
import { getOnChainNonce } from '@/utils/near';

const router = Router();

interface SignMessageRequest {
  nearImplicitAddress: string;
  withdrawAmount: number;
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
 *     summary: Sign a withdrawal message for the AI Gambling Club contract
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
 *               - withdrawAmount
 *             properties:
 *               nearImplicitAddress:
 *                 type: string
 *                 description: NEAR wallet implicit address
 *               withdrawAmount:
 *                 type: number
 *                 description: Amount to withdraw in USDC (with 6 decimals)
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
    const { nearImplicitAddress, withdrawAmount }: SignMessageRequest = req.body;

    // Validate required fields
    if (!nearImplicitAddress || withdrawAmount === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: nearImplicitAddress, withdrawAmount' 
      });
    }

    // Validate withdraw amount
    if (withdrawAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Withdraw amount must be greater than 0' 
      });
    }

    // Get on-chain nonce from the AI Gambling Club contract
    const contractAddress = process.env.AGC_CONTRACT_ID;
    if (!contractAddress) {
      return res.status(500).json({ 
        success: false, 
        error: 'AGC_CONTRACT_ID not configured' 
      });
    }
    
    const onChainNonce = await getOnChainNonce(contractAddress, nearImplicitAddress);

    // Validate withdrawal request with all business logic
    const validation = await validateWithdrawalRequest(
      nearImplicitAddress, 
      withdrawAmount, 
      onChainNonce
    );

    if (!validation.isValid) {
      const statusCode = validation.error?.includes('active game') ? 403 : 400;
      return res.status(statusCode).json({ 
        success: false, 
        error: validation.error 
      });
    }

    // Create game result structure
    const gameResult: GameResult = {
      accountId: nearImplicitAddress,
      amount: `-${withdrawAmount}`, // Negative for withdrawal
      nonce: validation.currentNonce || 0
    };

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
