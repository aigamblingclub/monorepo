import { Router } from 'express';
import { PrismaClient } from '@/prisma';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import crypto from 'crypto';
import { authenticate, AUTH_MESSAGE, generateChallenge } from '../utils/near-auth';
import { getUserBalance } from '@/utils/balance';
import { FRONTEND_URL } from '@/utils/env';

const router = Router();
const prisma = new PrismaClient();

// Store challenges temporarily (in production, use Redis or similar)
const challenges = new Map<string, { challenge: Buffer, timestamp: number }>();

// Clean up old challenges every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of challenges.entries()) {
        if (now - value.timestamp > 5 * 60 * 1000) { // 5 minutes
            challenges.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * @swagger
 * /api/auth/near/challenge:
 *   get:
 *     summary: Get a new challenge for NEAR wallet authentication
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: NEAR account ID
 *     responses:
 *       200:
 *         description: Challenge generated successfully
 *       400:
 *         description: Account ID is required
 */
router.get('/near/challenge', (req, res) => {
    const challenge = generateChallenge();
    const accountId = req.query.accountId as string;
    
    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    challenges.set(accountId, {
        challenge,
        timestamp: Date.now()
    });

    res.json({
        challenge: challenge.toString('base64'),
        message: AUTH_MESSAGE
    });
});

/**
 * @swagger
 * /api/auth/near/verify:
 *   post:
 *     summary: Verify NEAR wallet signature
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signature
 *               - accountId
 *               - publicKey
 *             properties:
 *               signature:
 *                 type: string
 *               accountId:
 *                 type: string
 *               publicKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signature verified successfully
 *       400:
 *         description: Missing required fields or invalid challenge
 *       401:
 *         description: Invalid signature
 *       500:
 *         description: Internal server error
 */
router.post('/near/verify', async (req, res) => {
    try {
        const { signature, accountId, publicKey } = req.body;

        if (!signature || !accountId || !publicKey) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get the stored challenge
        const storedChallenge = challenges.get(accountId);
        if (!storedChallenge) {
          return res.status(400).json({ error: 'No challenge found. Please request a new challenge.' });
        }

        // Remove the used challenge
        challenges.delete(accountId);

        const isValid = await authenticate({
            accountId,
            publicKey,
            signature,
            message: AUTH_MESSAGE,
            recipient: FRONTEND_URL!,
            nonce: storedChallenge.challenge,
        });

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Find or create user
        const user = await prisma.user.upsert({
            where: {
                nearImplicitAddress: accountId,
            },
            update: {
                lastActiveAt: new Date(),
            },
            create: {
                nearImplicitAddress: accountId,
                nearNamedAddress: accountId, // You might want to handle this differently
                lastActiveAt: new Date(),
                nonce: 0,
            },
        });

        // Generate a new API key for the user
        const keyValue = crypto.randomBytes(32).toString('hex');
        const apiKey = await prisma.apiKey.create({
            data: {
                keyValue,
                userId: user.id,
                isActive: true,
            },
        });
        let balance 
        try {
            balance = await getUserBalance(user.id);
        } catch (error) {
            console.error('Error getting user balance:', error);
            balance = { virtualBalance: 0 };
        }
        
        return res.json({
            success: true,
            balance: balance.virtualBalance,
            user,
            apiKey: { ...apiKey, keyValue },
            message: 'Authentication successful'
        });
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login or register a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nearImplicitAddress
 *               - nearNamedAddress
 *             properties:
 *               nearImplicitAddress:
 *                 type: string
 *                 description: NEAR wallet implicit address
 *               nearNamedAddress:
 *                 type: string
 *                 description: NEAR wallet named address
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
router.post('/login', async (req, res) => {
  try {
    // Commented out NEAR address validation for testing
    // const { nearImplicitAddress, nearNamedAddress } = req.body;
    // if (!nearImplicitAddress || !nearNamedAddress) {
    //   return res.status(400).json({ error: 'Missing required fields' });
    // }

    // For testing, we'll use a fixed test address
    const nearImplicitAddress = 'test.implicit.near';
    const nearNamedAddress = 'test.named.near';

    // Find or create user
    const user = await prisma.user.upsert({
      where: {
        nearImplicitAddress,
      },
      update: {
        nearNamedAddress,
        lastActiveAt: new Date(),
      },
      create: {
        nearImplicitAddress,
        nearNamedAddress,
        lastActiveAt: new Date(),
      },
    });

    // Generate a new API key for the user
    const keyValue = crypto.randomBytes(32).toString('hex');
    const apiKey = await prisma.apiKey.create({
      data: {
        keyValue,
        userId: user.id,
        isActive: true,
      },
    });

    return res.json({
      user,
      apiKey: { ...apiKey, keyValue },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/generate:
 *   post:
 *     summary: Generate a new API key
 *     tags: [Auth]
 *     description: Generates a new API key for testing purposes. In the future, this will verify wallet signatures.
 *     responses:
 *       200:
 *         description: API key generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     keyValue:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *       500:
 *         description: Internal server error
 */
router.post('/generate', async (req, res) => {
  try {
    // TODO: In the future, this will verify the wallet signature
    // For now, we'll just generate a test API key
    const keyValue = crypto.randomBytes(32).toString('hex');

    // Create a test user if needed
    const user = await prisma.user.upsert({
      where: {
        nearImplicitAddress: 'test.implicit.near',
      },
      update: {
        lastActiveAt: new Date(),
      },
      create: {
        nearImplicitAddress: 'test.implicit.near',
        nearNamedAddress: 'test.named.near',
        lastActiveAt: new Date(),
      },
    });

    const apiKey = await prisma.apiKey.create({
      data: {
        keyValue,
        userId: user.id,
        isActive: true,
      },
    });

    return res.json({ apiKey: { ...apiKey, keyValue } });
  } catch (error) {
    console.error('API key generation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/api-keys:
 *   get:
 *     summary: List all API keys for the authenticated user
 *     tags: [Auth]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of API keys retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/api-keys', validateApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.apiKey?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        keyValue: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        totalUses: true,
      },
    });

    return res.json({ apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
