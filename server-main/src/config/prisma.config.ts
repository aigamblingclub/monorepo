// Use dynamic imports to avoid type conflicts
let prisma: any;

if (process.env.NODE_ENV === 'test') {
  // Only import from the test client
  const { PrismaClient } = require('../tests/prisma/generated');
  prisma = new PrismaClient();
} else {
  // Only import from the main client (generated in our project)
  const { PrismaClient } = require('../prisma/generated');
  prisma = new PrismaClient();
}

export { prisma };