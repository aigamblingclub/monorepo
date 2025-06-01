/**
 * Server Environment Configuration Utility
 * 
 * This module validates and exports environment variables required for the server-side application.
 * It ensures all necessary environment variables are set and provides typed exports
 * for consistent usage throughout the backend services.
 * 
 * @module env
 * @throws {Error} When required environment variables are missing
 */

/**
 * Application environment mode validation
 * @throws {Error} When NODE_ENV is not set
 */
if(!process.env.NODE_ENV) {
    throw new Error('NODE_ENV is not set');
}

/**
 * The current environment mode (development, production, test, etc.)
 * @type {string}
 */
export const NODE_ENV = process.env.NODE_ENV;

/**
 * Boolean flag indicating if the application is running in production mode
 * @type {boolean}
 */
export const isProd = NODE_ENV === 'production';

/**
 * Boolean flag indicating if the application is running in development mode
 * @type {boolean}
 */
export const isDev = !isProd;

/**
 * Server port configuration validation
 * @throws {Error} When PORT is not set
 */
if(!process.env.PORT) {
    throw new Error('PORT is not set');
}

/**
 * The port number on which the server runs
 * @type {string}
 */
export const PORT = process.env.PORT;

/**
 * Frontend URL configuration with environment-specific validation
 * - In production: requires FRONTEND_URL
 * - In development: requires FRONTEND_URL_LOCAL
 * @throws {Error} When required frontend URL environment variable is not set
 */
if(isProd && !process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL is not set');
} else if (isDev && !process.env.FRONTEND_URL_LOCAL) {
    throw new Error('FRONTEND_URL_LOCAL is not set');
}

/**
 * The frontend application URL for CORS configuration and redirects
 * - Uses FRONTEND_URL in production
 * - Uses FRONTEND_URL_LOCAL in development
 * @type {string}
 */
export const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_URL_LOCAL;

/**
 * Poker server URL configuration with environment-specific validation
 * - In production: requires SERVER_POKER
 * - In development: requires SERVER_POKER_LOCAL
 * @throws {Error} When required poker server URL environment variable is not set
 */
if(isProd && !process.env.SERVER_POKER) {
    throw new Error('SERVER_POKER is not set');
} else if (isDev && !process.env.SERVER_POKER_LOCAL) {
    throw new Error('SERVER_POKER_LOCAL is not set');
}

/**
 * The poker game server URL for game-related API communications
 * - Uses SERVER_POKER in production
 * - Uses SERVER_POKER_LOCAL in development
 * @type {string}
 */
export const SERVER_POKER = process.env.SERVER_POKER || process.env.SERVER_POKER_LOCAL;

/**
 * Backend private key validation
 * @throws {Error} When BACKEND_PRIVATE_KEY is not set
 */
if(!process.env.BACKEND_PRIVATE_KEY) {
    throw new Error('BACKEND_PRIVATE_KEY is not set');
}

/**
 * Private key used for backend authentication and signing operations
 * Keep this secure and never expose in client-side code
 * @type {string}
 */
export const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;

/**
 * Backend public key validation
 * @throws {Error} When BACKEND_PUBLIC_KEY is not set
 */
if(!process.env.BACKEND_PUBLIC_KEY) {
    throw new Error('BACKEND_PUBLIC_KEY is not set');
}

/**
 * Public key corresponding to the backend private key
 * Used for signature verification and public key operations
 * @type {string}
 */
export const BACKEND_PUBLIC_KEY = process.env.BACKEND_PUBLIC_KEY;

/**
 * API key validation for server authentication
 * @throws {Error} When API_KEY_SERVER is not set
 */
if(!process.env.API_KEY_SERVER) {
    throw new Error('API_KEY_SERVER is not set');
}

/**
 * Server-side API key for internal service authentication
 * Used to authenticate requests between backend services
 * @type {string}
 */
export const API_KEY_SERVER = process.env.API_KEY_SERVER;

/**
 * Database connection string validation
 * @throws {Error} When DATABASE_URL is not set
 */
if(!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

/**
 * Database connection URL (typically PostgreSQL)
 * Used for all database operations and connections
 * @type {string}
 * @example "postgresql://user:password@localhost:5432/database_name"
 */
export const DATABASE_URL = process.env.DATABASE_URL;

/**
 * NEAR blockchain node URL validation
 * @throws {Error} When NEAR_NODE_URL is not set
 */
if(!process.env.NEAR_NODE_URL) {
    throw new Error('NEAR_NODE_URL is not set');
}

/**
 * NEAR Protocol RPC node URL for blockchain interactions
 * Used for all NEAR blockchain API calls and transactions
 * @type {string}
 * @example "https://rpc.mainnet.near.org"
 */
export const NEAR_NODE_URL = process.env.NEAR_NODE_URL;

/**
 * USDC contract ID validation
 * @throws {Error} When USDC_CONTRACT_ID is not set
 */
if(!process.env.USDC_CONTRACT_ID) {
    throw new Error('USDC_CONTRACT_ID is not set');
}

/**
 * The NEAR Protocol contract ID for USDC token operations
 * Used for server-side USDC balance checks and transaction processing
 * @type {string}
 * @example "usdc.tether-token.near"
 */
export const USDC_CONTRACT_ID = process.env.USDC_CONTRACT_ID;