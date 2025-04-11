import { PrismaClient } from '@/prisma';
import { beforeAll, afterAll } from '@jest/globals';

const prisma = new PrismaClient();

// Clean up the database before all tests
beforeAll(async () => {
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
});

// Clean up the database after all tests
afterAll(async () => {
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});
