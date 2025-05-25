import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';
import { securityMiddleware } from './middleware/security';
import { apiLimiter, authLimiter, highFrequencyLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Security Middleware
app.use(securityMiddleware);

// Apply rate limiting
app.use('/api', apiLimiter); // Apply general API rate limiting
app.use('/api/auth', authLimiter); // Apply stricter rate limiting to auth routes
app.use('/api/game', highFrequencyLimiter); // Apply high-frequency rate limiting to game routes

// Middleware
app.use(express.json());

// IP Check Middleware for /api-docs
app.use('/api-docs', (req, res, next) => {
  if (req.ip === '::1') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
});

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to AI Gaming Club API' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`API Documentation available at http://localhost:${port}/api-docs`);
});
