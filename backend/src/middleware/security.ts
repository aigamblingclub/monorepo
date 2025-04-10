import hpp from 'hpp';
import xss from 'xss-clean';

// HTTP Parameter Pollution protection
export const hppProtection = hpp();

// XSS Protection
export const xssProtection = xss();

// Request Sanitization
export const sanitizeRequest = [xss(), hpp()];
