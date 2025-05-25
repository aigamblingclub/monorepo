import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth routes rate limiter (more strict)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// High-frequency routes rate limiter
export const highFrequencyLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 20, // 20 requests per second
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
