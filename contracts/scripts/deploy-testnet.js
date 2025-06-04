#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isContractInitialized } from '../test/utils/near-utils.js';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const buildDir = join(__dirname, '..', 'build');
const contractFile = join(buildDir, 'ai-gambling-club.wasm');

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
  const usdcTokenContract = args[2] || 'usdc.fakes.testnet'; // Default USDC contract on testnet
  const backendPublicKey = args[3]; // Backend public key for signature verification

  // Validate arguments
  if (!accountId || !backendPublicKey) {
    console.error(
      'Usage: deploy-testnet.js [account_id] [admin_account] [usdc_token_contract] [backend_public_key]'
    );
    console.error('  account_id: The account ID to deploy the contract to');
    console.error(
      '  admin_account: The account ID of the admin (default: same as account_id)'
    );
    console.error(
      '  usdc_token_contract: The account ID of the USDC token contract (default: usdc.fakes.testnet)'
    );
    console.error(
      '  backend_public_key: The Ed25519 public key for signature verification (base64 encoded)'
    );
    process.exit(1);
  }

  // Set default admin account if not provided
  const finalAdminAccount = adminAccount || accountId;

  console.info(`Deploying AI Gambling Club contract to testnet...`);
  console.info(`Account ID: ${accountId}`);
  console.info(`Admin Account: ${finalAdminAccount}`);
  console.info(`USDC Token Contract: ${usdcTokenContract}`);
  console.info(`Backend Public Key: ${backendPublicKey}`);

  try {
    // Login to NEAR account
    console.info(`\nPlease login to your NEAR account (${accountId})...`);
    execSync(`near login`, { stdio: 'inherit' });

    // Deploy the contract
    console.info(`\nDeploying contract...`);
    execSync(`near deploy ${accountId} ${contractFile} --networkId testnet`, {
      stdio: 'inherit',
    });

    // Check if the contract is already initialized
    console.info(`\nChecking if contract is already initialized...`);
    const { isInitialized, adminAccount } =
      await isContractInitialized(accountId);

    if (isInitialized) {
      console.info(`Contract is already initialized, skipping initialization.`);
    } else {
      // Initialize the contract
      console.info(`\nInitializing contract...`);
      execSync(
        `near call ${accountId} init '{"admin_account": "${finalAdminAccount}", "usdc_token_contract": "${usdcTokenContract}", "backend_public_key": "${backendPublicKey}"}' --accountId ${accountId} --networkId testnet`,
        { stdio: 'inherit' }
      );
    }

    console.info(`\nContract deployed successfully!`);
    console.info(`Contract: ${accountId}`);
    console.info(`Admin: ${adminAccount ? adminAccount : finalAdminAccount}`);
    console.info(`USDC Token Contract: ${usdcTokenContract}`);
    console.info(`Backend Public Key: ${backendPublicKey}`);
    console.info(
      `Explorer URL: https://explorer.testnet.near.org/accounts/${accountId}`
    );
  } catch (error) {
    console.error('Error deploying contract:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
