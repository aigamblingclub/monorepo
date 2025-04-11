import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@/prisma/generated/index';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    id: number;
    userId: number;
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

    // Attach API key info to request
    req.apiKey = validApiKey;
    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
