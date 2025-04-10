import express from 'express';
import dotenv from 'dotenv';
import { sanitizeRequest } from './middleware/security';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Security Middleware
app.use(sanitizeRequest);

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
