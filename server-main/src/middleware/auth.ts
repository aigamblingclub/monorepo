import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@/prisma';

const prisma = new PrismaClient();

export const validateApiKeyServer = async (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.API_KEY_SERVER && req.headers['API-KEY'] !== process.env.API_KEY_SERVER) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    id: number;
    userId: number;
  };
  user?: {
    id: number;
  };
}

export const validateApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }

  try {
    const validApiKey = await prisma.apiKey.findFirst({
      where: {
        keyValue: apiKey,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!validApiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update API key usage
    await prisma.apiKey.update({
      where: { id: validApiKey.id },
      data: {
        lastUsedAt: new Date(),
        totalUses: { increment: 1 },
      },
    });

    // Attach API key and user info to request
    req.apiKey = validApiKey;
    req.user = { id: validApiKey.userId };

    // Preserve the body
    const body = req.body;
    req.body = body;

    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
};
