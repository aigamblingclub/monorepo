import request from 'supertest';
import { PrismaClient } from '@/prisma/generated/index';
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
    it('should create a new user if not exists', async () => {
      const response = await request(app).post('/api/auth/login').send({
        nearImplicitAddress: '0x1234567890abcdef',
        nearNamedAddress: 'newuser.near',
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('nearImplicitAddress', '0x1234567890abcdef');
      expect(response.body.user).toHaveProperty('nearNamedAddress', 'newuser.near');
    });

    it('should update existing user', async () => {
      const response = await request(app).post('/api/auth/login').send({
        nearImplicitAddress: '0x1234567890abcdef',
        nearNamedAddress: 'updated.near',
      });

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('nearImplicitAddress', '0x1234567890abcdef');
      expect(response.body.user).toHaveProperty('nearNamedAddress', 'updated.near');
    });
    
    it('should return 400 if missing required fields', async () => {
      const response = await request(app).post('/api/auth/login').send({
        nearImplicitAddress: 'test.near',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });
  });

  describe('POST /api/auth/generate-api-key', () => {
    it('should generate a new API key', async () => {
      const response = await request(app)
        .post('/api/auth/generate-api-key')
        .set('x-api-key', testApiKey.keyValue);

      expect(response.status).toBe(200);
      expect(response.body.apiKey).toHaveProperty('keyValue');
      expect(response.body.apiKey).toHaveProperty('userId', testUser.id);
      expect(response.body.apiKey).toHaveProperty('isActive', true);
    });

    it('should return 401 if no API key provided', async () => {
      const response = await request(app).post('/api/auth/generate-api-key');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'API key is required');
    });

    it('should return 401 if invalid API key provided', async () => {
      const response = await request(app)
        .post('/api/auth/generate-api-key')
        .set('x-api-key', 'invalid-key');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid API key');
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
