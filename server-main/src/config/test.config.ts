import { PrismaClient } from '../prisma/generated';
import { join } from 'path';

// Create a new PrismaClient instance for tests
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${join(__dirname, '../../tests/prisma/test.sqlite')}`,
    },
  },
});

export { prisma }; 