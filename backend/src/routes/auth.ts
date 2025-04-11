import { Router } from 'express';
import { PrismaClient } from '@/prisma/generated/index';
import { validateApiKey, AuthenticatedRequest } from '@/middleware/auth';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

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
    const { nearImplicitAddress, nearNamedAddress } = req.body;

    if (!nearImplicitAddress || !nearNamedAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
 * /api/auth/generate-api-key:
 *   post:
 *     summary: Generate a new API key for the authenticated user
 *     tags: [Auth]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: API key generated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/generate-api-key', validateApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.apiKey?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate a random API key
    const keyValue = crypto.randomBytes(32).toString('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        keyValue,
        userId,
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
