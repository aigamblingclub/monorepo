#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const buildDir = join(__dirname, '..', 'build');
const contractFile = join(buildDir, 'ai-gambling-club.wasm');

// Network configurations
const NETWORK_CONFIGS = {
  testnet: {
    networkId: 'testnet',
    nodeUrl: process.env.TESTNET_NODE_URL || 'https://rpc.testnet.near.org',
    defaultUsdcContract: process.env.TESTNET_USDC_CONTRACT || 'usdc.fakes.testnet',
    explorerUrl: 'https://explorer.testnet.near.org/accounts'
  },
  mainnet: {
    networkId: 'mainnet',
    nodeUrl: process.env.MAINNET_NODE_URL || 'https://rpc.mainnet.near.org',
    defaultUsdcContract: process.env.MAINNET_USDC_CONTRACT || 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near',
    explorerUrl: 'https://explorer.near.org/accounts'
  }
};

async function main() {
  // Check if contract file exists
  if (!fs.existsSync(contractFile)) {
    console.error(`Contract file not found: ${contractFile}`);
    console.error('Please run "npm run build" first to build the contract.');
    process.exit(1);
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const networkArg = args[0]?.toLowerCase();
  const accountId = args[1];
  const adminAccount = args[2];
  const usdcTokenContract = args[3];
  const beneficiaryAccount = args[4];
  const backendPublicKey = args[5] || process.env.BACKEND_PUBLIC_KEY;

  // Validate network argument
  if (!networkArg || !['testnet', 'mainnet'].includes(networkArg)) {
    console.error('Usage: redeploy.js <network> <account_id> [admin_account] [usdc_token_contract] [beneficiary_account] [backend_public_key]');
    console.error('  network: Network to deploy to (testnet or mainnet)');
    console.error('  account_id: The account ID to deploy the contract to');
    console.error('  admin_account: The account ID of the admin (default: same as account_id)');
    console.error('  usdc_token_contract: The account ID of the USDC token contract');
    console.error('  beneficiary_account: The account that will receive the funds when deleting the contract');
    console.error('  backend_public_key: The Ed25519 public key for signature verification (defaults to BACKEND_PUBLIC_KEY from .env)');
    process.exit(1);
  }

  // Get network configuration
  const networkConfig = NETWORK_CONFIGS[networkArg];

  // Validate required arguments
  if (!accountId || !beneficiaryAccount || !backendPublicKey) {
    console.error('Missing required arguments. Please provide account_id, beneficiary_account, and ensure BACKEND_PUBLIC_KEY is set in .env or provided as argument.');
    process.exit(1);
  }

  // Set default admin account if not provided
  const finalAdminAccount = adminAccount || accountId;
  
  // Set default USDC contract based on network if not provided
  const finalUsdcContract = usdcTokenContract || networkConfig.defaultUsdcContract;

  // Show warning for mainnet deployment
  if (networkArg === 'mainnet') {
    console.log('⚠️  WARNING: You are about to deploy to NEAR MAINNET ⚠️');
    console.log('This is a production environment. Please confirm your action.');
    const confirmation = await new Promise(resolve => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Are you sure you want to proceed? (yes/no): ', answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });

    if (!confirmation) {
      console.log('Deployment cancelled.');
      process.exit(0);
    }
  }

  console.log(`Redeploying AI Gambling Club contract to ${networkArg}...`);
  console.log(`Account ID: ${accountId}`);
  console.log(`Admin Account: ${finalAdminAccount}`);
  console.log(`USDC Token Contract: ${finalUsdcContract}`);
  console.log(`Beneficiary Account: ${beneficiaryAccount}`);
  console.log(`Backend Public Key: ${backendPublicKey}`);
  console.log(`Network: ${networkArg}`);

  try {
    // Login to NEAR account
    console.log(`\nPlease login to your NEAR account (${accountId})...`);
    execSync(`near login`, { stdio: 'inherit' });

    // Delete the existing contract account
    console.log(`\nDeleting existing contract account...`);
    try {
      execSync(
        `near delete-account ${accountId} ${beneficiaryAccount} --networkId ${networkArg}`,
        { stdio: 'inherit' }
      );
      console.log(`Successfully deleted account ${accountId}`);
    } catch (error) {
      console.log(`Failed to delete account, it might not exist yet. Proceeding with deployment...`);
    }

    // Create the account again
    console.log(`\nCreating new account...`);
    execSync(
      `near create-account ${accountId} --masterAccount ${beneficiaryAccount} --initialBalance 10 --networkId ${networkArg}`,
      { stdio: 'inherit' }
    );

    // Deploy the contract
    console.log(`\nDeploying contract...`);
    execSync(`near deploy ${accountId} ${contractFile} --networkId ${networkArg}`, { stdio: 'inherit' });

    // Initialize the contract
    console.log(`\nInitializing contract...`);
    execSync(
      `near call ${accountId} init '{"admin_account": "${finalAdminAccount}", "usdc_token_contract": "${finalUsdcContract}", "backend_public_key": "${backendPublicKey}"}' --accountId ${accountId} --networkId ${networkArg}`,
      { stdio: 'inherit' }
    );

    console.log(`\nContract redeployed successfully!`);
    console.log(`Contract: ${accountId}`);
    console.log(`Admin: ${finalAdminAccount}`);
    console.log(`USDC Token Contract: ${finalUsdcContract}`);
    console.log(`Backend Public Key: ${backendPublicKey}`);
    console.log(`Explorer URL: ${networkConfig.explorerUrl}/${accountId}`);
  } catch (error) {
    console.error('Error redeploying contract:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Redeployment failed:', error);
  process.exit(1);
}); 