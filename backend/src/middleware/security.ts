import hpp from 'hpp';
import helmet from 'helmet';

// Request Sanitization and Security Headers
export const securityMiddleware = [
  helmet(), // Adds various HTTP headers for security
  hpp(), // Protects against HTTP Parameter Pollution
];
