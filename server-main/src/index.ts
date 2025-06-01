import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';
import { securityMiddleware } from './middleware/security';
import { apiLimiter, authLimiter, highFrequencyLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';
import pokerRoutes from './routes/poker';
import betRoutes from './routes/bet';
import balanceRoutes from './routes/balance';
import { updatePokerState } from './utils/poker-state';
import { validateApiKeyServer } from './middleware/auth';
import { PORT } from './utils/env';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// Security Middleware
app.use(securityMiddleware);

// Validate API_KEY_SERVER
app.use(validateApiKeyServer);

// Apply rate limiting
app.use('/api', apiLimiter); // Apply general API rate limiting
app.use('/api/auth', authLimiter); // Apply stricter rate limiting to auth routes
app.use('/api/game', highFrequencyLimiter); // Apply high-frequency rate limiting to game routes
app.use('/api/user', highFrequencyLimiter); // Apply high-frequency rate limiting to user routes
app.use('/api/bet', highFrequencyLimiter); // Apply high-frequency rate limiting to bet routes

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
app.use('/api/game', pokerRoutes);
app.use('/api/bet', betRoutes);
app.use('/api/user/balance', balanceRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to AI Gaming Club API' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});

// Update poker state every 2 seconds
updatePokerState(2000);