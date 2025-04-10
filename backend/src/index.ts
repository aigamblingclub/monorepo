import express from 'express';
import dotenv from 'dotenv';
import { sanitizeRequest } from './middleware/security';
import { apiLimiter, authLimiter, highFrequencyLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Security Middleware
app.use(sanitizeRequest);

// Apply rate limiting
app.use('/api', apiLimiter); // Apply general API rate limiting
app.use('/api/auth', authLimiter); // Apply stricter rate limiting to auth routes
app.use('/api/game', highFrequencyLimiter); // Apply high-frequency rate limiting to game routes

// API Key Authentication for all routes except the root
app.use('/api');

// Middleware
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to AI Gaming Club API' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
