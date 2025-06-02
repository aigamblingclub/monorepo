/**
 * Contract Routes Module
 * 
 * Express router handling contract-related API endpoints for USDC unlock operations.
 * This module provides secure endpoints for validating and signing unlock requests,
 * integrating security validation, business logic validation, and cryptographic signing
 * operations for the AGC betting platform.
 * 
 * @fileoverview Contract API routes for unlock request processing and message signing
 * @version 1.0.0
 * @author 0xneves
 * 
 * @security WARNING: This module handles financial operations and cryptographic signing.
 * All endpoints require API key authentication and perform critical validation checks.
 * 
 * @example
 * ```typescript
 * import contractRoutes from './routes/contract';
 * app.use('/api/contract', contractRoutes);
 * ```
 */

import { Router } from 'express';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import { 
  validateUnlockRequest, 
  signGameResult, 
  GameResult
} from '@/utils/contract';
import { setPendingUnlockDeadline, validateUserCanBet } from '@/utils/security';

/**
 * @type {Router}
 * Express router instance for contract-related endpoints.
 * Handles unlock request validation and message signing operations.
 */
const router = Router();

/**
 * @typedef {Object} SignMessageRequest
 * @property {string} nearNamedAddress - NEAR Protocol named address of the user requesting unlock
 */
interface SignMessageRequest {
  nearNamedAddress: string;
}

/**
 * @typedef {Object} SignMessageResponse
 * @property {boolean} success - Whether the signing operation completed successfully
 * @property {string} [signature] - Cryptographic signature for the unlock operation
 * @property {GameResult} [gameResult] - Game result object containing unlock details
 * @property {string} [error] - Error message if the operation failed
 */
interface SignMessageResponse {
  success: boolean;
  signature?: string;
  gameResult?: GameResult;
  error?: string;
}

/**
 * Sign Message Endpoint for USDC Unlock Operations
 * 
 * POST /api/contract/sign-message
 * 
 * Validates and signs unlock requests for users to withdraw their USDC balances.
 * This endpoint performs comprehensive security validation, business logic checks,
 * and generates cryptographic signatures for authorized unlock operations.
 * 
 * @route POST /sign-message
 * @middleware validateApiKey - Requires valid API key authentication
 * @param {AuthenticatedRequest} req - Express request with authentication context
 * @param {Object} req.body - Request body containing unlock parameters
 * @param {string} req.body.nearNamedAddress - NEAR Protocol address for unlock
 * @param {Object} res - Express response object
 * 
 * @returns {SignMessageResponse} JSON response with signature and game result or error
 * 
 * @throws {400} Missing required fields in request body
 * @throws {403} User betting permissions denied or active game participation
 * @throws {400} Invalid unlock request or missing balance/nonce data
 * @throws {500} Internal server error during validation or signing process
 * 
 * @security CRITICAL: This endpoint authorizes financial unlock operations and generates signatures
 * 
 * @example
 * ```typescript
 * // Request
 * POST /api/contract/sign-message
 * Headers: { "x-api-key": "your-api-key" }
 * Body: { "nearNamedAddress": "alice.near" }
 * 
 * // Response (Success)
 * {
 *   "success": true,
 *   "signature": "0x1234...",
 *   "gameResult": {
 *     "accountId": "alice.near",
 *     "amount": "1000000",
 *     "nonce": 5,
 *     "deadline": "1640995200000000000"
 *   }
 * }
 * ```
 */
router.post('/sign-message', validateApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const { nearNamedAddress }: SignMessageRequest = req.body;

    // Validation: Check if required fields are provided in request
    if (!nearNamedAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: nearNamedAddress' 
      });
    }

    // Security middleware for betting
    const criticalValidation = await validateUserCanBet(nearNamedAddress);

    // Validation: Check if user has betting permissions (security-critical)
    if (!criticalValidation.canBet) {
      return res.status(403).json({ 
        success: false, 
        error: criticalValidation.errors[0] 
      });
    }

    // Validate unlock request with all business logic
    const validation = await validateUnlockRequest(
      nearNamedAddress, 
    );

    // Validation: Check if unlock request passes all business logic validation
    if (!validation.isValid) {
      const statusCode = validation.error?.includes('active game') ? 403 : 400;
      return res.status(statusCode).json({ 
        success: false, 
        error: validation.error 
      });
    }

    // Validation: Check if virtual balance change data is available
    if (!validation.virtualBalanceChange && validation.virtualBalanceChange !== 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Virtual balance is not available' 
      });
    }

    // Validation: Check if current nonce data is available for transaction ordering
    if (!validation.currentNonce) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current nonce is not available' 
      });
    }

    // Create game result structure
    const gameResult: GameResult = {
      accountId: nearNamedAddress,
      amount: validation.virtualBalanceChange.toString(),
      nonce: validation.currentNonce,
      deadline: (Date.now() * 1_000_000 + 60_000_000_000).toString() // 1 minute from now in nanoseconds
    };

    // Sign the message and update pending unlock deadline in parallel
    let signature;
    // Validation: Check if user ID is available for deadline setting
    if (validation.userId) {
      // Sign the message and update pending unlock deadline in parallel
      [signature] = await Promise.all([
        signGameResult(gameResult),
        setPendingUnlockDeadline(validation.userId, gameResult.deadline)
      ]);
    }

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
