import express from 'express';
import dotenv from 'dotenv';
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

// Routes
app.use('/api/auth', authRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to AI Gaming Club API' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
