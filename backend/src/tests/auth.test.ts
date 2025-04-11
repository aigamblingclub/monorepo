import request from 'supertest';
import { PrismaClient } from '@/prisma';
import express from 'express';
import authRoutes from '@/routes/auth';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Routes', () => {
  let testUser: any;
  let testApiKey: any;

  beforeAll(async () => {
    // Create a test user
    testUser = await prisma.user.create({
      data: {
        nearImplicitAddress: '0x1234567890abcdef',
        nearNamedAddress: 'test.near',
      },
    });

    // Create a test API key
    testApiKey = await prisma.apiKey.create({
      data: {
        keyValue: 'test-api-key',
        userId: testUser.id,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('should create a new user with test addresses', async () => {
      const response = await request(app).post('/api/auth/login').send({});

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('nearImplicitAddress', 'test.implicit.near');
      expect(response.body.user).toHaveProperty('nearNamedAddress', 'test.named.near');
      expect(response.body.apiKey).toHaveProperty('keyValue');
    });
  });

  describe('POST /api/auth/generate', () => {
    it('should generate a new API key with test user', async () => {
      const response = await request(app).post('/api/auth/generate');

      expect(response.status).toBe(200);
      expect(response.body.apiKey).toHaveProperty('keyValue');
      expect(response.body.apiKey).toHaveProperty('isActive', true);
    });
  });

  describe('GET /api/auth/api-keys', () => {
    it('should list user API keys', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys')
        .set('x-api-key', testApiKey.keyValue);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.apiKeys)).toBe(true);
      expect(response.body.apiKeys.length).toBeGreaterThan(0);
      expect(response.body.apiKeys[0]).toHaveProperty('keyValue');
      expect(response.body.apiKeys[0]).toHaveProperty('isActive');
      expect(response.body.apiKeys[0]).toHaveProperty('totalUses');
    });

    it('should return 401 if no API key provided', async () => {
      const response = await request(app).get('/api/auth/api-keys');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'API key is required');
    });

    it('should return 401 if invalid API key provided', async () => {
      const response = await request(app).get('/api/auth/api-keys').set('x-api-key', 'invalid-key');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid API key');
    });
  });
});
