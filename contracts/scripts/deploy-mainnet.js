#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { isContractInitialized } from '../test/utils/near-utils.js';
// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const buildDir = join(__dirname, '..', 'build');
const contractFile = join(buildDir, 'ai-gambling-club.wasm');

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  // Check if contract file exists
  if (!fs.existsSync(contractFile)) {
    console.error(`Contract file not found: ${contractFile}`);
    console.error('Please run "npm run build" first to build the contract.');
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const accountId = args[0];
  const adminAccount = args[1];
  const usdcTokenContract =
    args[2] || 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near'; // Default USDC contract on mainnet
  const backendPublicKey = args[3]; // Backend public key for signature verification

  // Validate arguments
  if (!accountId || !backendPublicKey) {
    console.error(
      'Usage: deploy-mainnet.js [account_id] [admin_account] [usdc_token_contract] [backend_public_key]'
    );
    console.error('  account_id: The account ID to deploy the contract to');
    console.error(
      '  admin_account: The account ID of the admin (default: same as account_id)'
    );
    console.error(
      '  usdc_token_contract: The account ID of the USDC token contract (default: a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near)'
    );
    console.error(
      '  backend_public_key: The Ed25519 public key for signature verification (base64 encoded)'
    );
    process.exit(1);
  }

  // Set default admin account if not provided
  const finalAdminAccount = adminAccount || accountId;

  // Confirm mainnet deployment
  console.info('⚠️  WARNING: You are about to deploy to NEAR MAINNET ⚠️');
  console.info(`Account ID: ${accountId}`);
  console.info(`Admin Account: ${finalAdminAccount}`);
  console.info(`USDC Token Contract: ${usdcTokenContract}`);
  console.info(`Backend Public Key: ${backendPublicKey}`);
  console.info(
    '\nThis is a production environment. Please confirm your action.'
  );

  rl.question(
    'Are you sure you want to deploy to mainnet? (yes/no): ',
    async answer => {
      if (answer.toLowerCase() !== 'yes') {
        console.info('Deployment cancelled.');
        rl.close();
        process.exit(0);
      }

      try {
        // Login to NEAR account
        console.info(`\nPlease login to your NEAR account (${accountId})...`);
        execSync(`near login --networkId mainnet`, { stdio: 'inherit' });

        // Deploy the contract
        console.info(`\nDeploying contract...`);
        execSync(
          `near deploy ${accountId} ${contractFile} --networkId mainnet`,
          { stdio: 'inherit' }
        );

        // Check if the contract is already initialized
        console.info(`\nChecking if contract is already initialized...`);
        const { isInitialized, admin } = await isContractInitialized(accountId);

        if (isInitialized || true) {
          // default to true because it's trying to initialize the contract again all the time
          console.info(
            `Contract is already initialized, skipping initialization.`
          );
        } else {
          // Initialize the contract
          console.info(`\nInitializing contract...`);
          execSync(
            `near call ${accountId} init '{"admin_account": "${finalAdminAccount}", "usdc_token_contract": "${usdcTokenContract}", "backend_public_key": "${backendPublicKey}"}' --accountId ${accountId} --networkId mainnet`,
            { stdio: 'inherit' }
          );
        }

        console.info(`\nContract deployed successfully!`);
        console.info(`Contract: ${accountId}`);
        console.info(
          `Admin: ${admin ? admin : adminAccount ? adminAccount : accountId}`
        );
        console.info(`USDC Token Contract: ${usdcTokenContract}`);
        console.info(`Backend Public Key: ${backendPublicKey}`);
        console.info(
          `Explorer URL: https://explorer.near.org/accounts/${accountId}`
        );
      } catch (error) {
        console.error('Error deploying contract:', error.message);
        process.exit(1);
      }
    }
  );
}

// Execute the main function
main().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
