import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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
