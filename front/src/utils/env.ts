/**
 * Environment Configuration Utility
 *
 * This module validates and exports environment variables required for the application.
 * It ensures all necessary environment variables are set and provides typed exports
 * for consistent usage throughout the application.
 *
 * @module env
 * @throws {Error} When required environment variables are missing
 */

/**
 * Application environment mode
 * @throws {Error} When NEXT_PUBLIC_NODE_ENV is not set
 */
if (!process.env.NEXT_PUBLIC_NODE_ENV) {
  throw new Error('NODE_ENV is not set');
}

/**
 * The current environment mode (development, production, test, etc.)
 * @type {string}
 */
export const NODE_ENV = process.env.NEXT_PUBLIC_NODE_ENV;

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
 * Application port configuration
 * @throws {Error} When NEXT_PUBLIC_PORT is not set
 */
if (!process.env.NEXT_PUBLIC_PORT) {
  throw new Error('PORT is not set');
}

/**
 * The port number on which the application runs
 * @type {string}
 */
export const PORT = process.env.NEXT_PUBLIC_PORT;

/**
 * Server URL configuration with environment-specific validation
 * - In production: requires NEXT_PUBLIC_SERVER_MAIN
 * - In development: requires NEXT_PUBLIC_SERVER_MAIN_LOCAL
 * @throws {Error} When required server URL environment variable is not set
 */
if (isProd && !process.env.NEXT_PUBLIC_SERVER_MAIN) {
  throw new Error('NEXT_PUBLIC_SERVER_MAIN is not set');
} else if (isDev && !process.env.NEXT_PUBLIC_SERVER_MAIN_LOCAL) {
  throw new Error('NEXT_PUBLIC_SERVER_MAIN_LOCAL is not set');
}

/**
 * The main server URL for API calls
 * - Uses NEXT_PUBLIC_SERVER_MAIN in production
 * - Uses NEXT_PUBLIC_SERVER_MAIN_LOCAL in development
 * @type {string}
 */
export const NEXT_PUBLIC_SERVER_MAIN =
  process.env.NEXT_PUBLIC_SERVER_MAIN ||
  process.env.NEXT_PUBLIC_SERVER_MAIN_LOCAL;

/**
 * USDC contract configuration validation
 * @throws {Error} When NEXT_PUBLIC_USDC_CONTRACT_ID is not set
 */
if (!process.env.NEXT_PUBLIC_USDC_CONTRACT_ID) {
  throw new Error('NEXT_PUBLIC_USDC_CONTRACT_ID is not set');
}

/**
 * The NEAR Protocol contract ID for USDC token operations
 * Used for fetching USDC balances and performing USDC-related transactions
 * @type {string}
 * @example "usdc.tether-token.near"
 */
export const NEXT_PUBLIC_USDC_CONTRACT_ID =
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ID;

/**
 * Main AGC contract configuration validation
 * @throws {Error} When NEXT_PUBLIC_CONTRACT_ID is not set
 */
if (!process.env.NEXT_PUBLIC_CONTRACT_ID) {
  throw new Error('NEXT_PUBLIC_CONTRACT_ID is not set');
}

/**
 * The NEAR Protocol contract ID for the main AGC (AI Gambling Club) contract
 * Used for game operations, balance checks, and AGC-specific transactions
 * @type {string}
 * @example "agc.your-contract.near"
 */
export const NEXT_PUBLIC_CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID;
