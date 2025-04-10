import hpp from 'hpp';
import xss from 'xss-clean';

// Request Sanitization
export const sanitizeRequest = [xss(), hpp()];
