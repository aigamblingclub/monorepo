import { Request, Response, NextFunction } from 'express';
import hpp from 'hpp';
import xss from 'xss-clean';

// HTTP Parameter Pollution protection
export const hppProtection = hpp();

// XSS Protection
export const xssProtection = xss();

// Request Sanitization
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Apply both HPP and XSS protection
  hppProtection(req, res, () => {
    xssProtection(req, res, next);
  });
};
