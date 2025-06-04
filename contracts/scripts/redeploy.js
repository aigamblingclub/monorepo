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
    defaultUsdcContract:
      process.env.TESTNET_USDC_CONTRACT || 'usdc.fakes.testnet',
    explorerUrl: 'https://explorer.testnet.near.org/accounts',
  },
  mainnet: {
    networkId: 'mainnet',
    nodeUrl: process.env.MAINNET_NODE_URL || 'https://rpc.mainnet.near.org',
    defaultUsdcContract:
      process.env.MAINNET_USDC_CONTRACT ||
      'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near',
    explorerUrl: 'https://explorer.near.org/accounts',
  },
};

// Function to check account state and balance
async function checkAccountState(accountId, networkId) {
  try {
    const result = execSync(
      `near state ${accountId} --networkId ${networkId}`,
      { encoding: 'utf8' }
    );
    const stateData = JSON.parse(result);
    return {
      exists: true,
      balance: parseFloat(stateData.amount) / 10 ** 24, // Convert yoctoNEAR to NEAR
    };
  } catch (error) {
    if (error.message.includes('does not exist')) {
      return { exists: false, balance: 0 };
    }
    throw error;
  }
}

// Function to verify account access
async function verifyAccountAccess(accountId, networkId) {
  try {
    // Try to view access key list - this will fail if we don't have access
    execSync(`near keys ${accountId} --networkId ${networkId}`, {
      stdio: 'pipe',
    });
    return true;
  } catch (error) {
    return false;
  }
}

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
    console.error(
      'Usage: redeploy.js <network> <account_id> [admin_account] [usdc_token_contract] [beneficiary_account] [backend_public_key]'
    );
    console.error('  network: Network to deploy to (testnet or mainnet)');
    console.error('  account_id: The account ID to deploy the contract to');
    console.error(
      '  admin_account: The account ID of the admin (default: same as account_id)'
    );
    console.error(
      '  usdc_token_contract: The account ID of the USDC token contract'
    );
    console.error(
      '  beneficiary_account: The account that will receive the funds when deleting the contract'
    );
    console.error(
      '  backend_public_key: The Ed25519 public key for signature verification (defaults to BACKEND_PUBLIC_KEY from .env)'
    );
    process.exit(1);
  }

  // Get network configuration
  const networkConfig = NETWORK_CONFIGS[networkArg];

  // Validate required arguments
  if (!accountId || !beneficiaryAccount || !backendPublicKey) {
    console.error(
      'Missing required arguments. Please provide account_id, beneficiary_account, and ensure BACKEND_PUBLIC_KEY is set in .env or provided as argument.'
    );
    process.exit(1);
  }

  // Set default admin account if not provided
  const finalAdminAccount = adminAccount || accountId;

  // Set default USDC contract based on network if not provided
  const finalUsdcContract =
    usdcTokenContract || networkConfig.defaultUsdcContract;

  // Show warning for mainnet deployment
  if (networkArg === 'mainnet') {
    console.info('⚠️  WARNING: You are about to deploy to NEAR MAINNET ⚠️');
    console.info(
      'This is a production environment. Please confirm your action.'
    );
    const confirmation = await new Promise(resolve => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('Are you sure you want to proceed? (yes/no): ', answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });

    if (!confirmation) {
      console.info('Deployment cancelled.');
      process.exit(0);
    }
  }

  console.info(`Redeploying AI Gambling Club contract to ${networkArg}...`);
  console.info(`Account ID: ${accountId}`);
  console.info(`Admin Account: ${finalAdminAccount}`);
  console.info(`USDC Token Contract: ${finalUsdcContract}`);
  console.info(`Beneficiary Account: ${beneficiaryAccount}`);
  console.info(`Backend Public Key: ${backendPublicKey}`);
  console.info(`Network: ${networkArg}`);

  try {
    // Login to NEAR account
    console.info(`\nPlease login to your NEAR account (${accountId})...`);
    execSync(`near login`, { stdio: 'inherit' });

    // Safety checks before proceeding
    console.info('\nPerforming safety checks...');

    // 1. Check target account balance
    const targetAccount = await checkAccountState(accountId, networkArg);
    if (targetAccount.exists) {
      console.info(
        `Target account ${accountId} exists with ${targetAccount.balance} NEAR`
      );
      if (targetAccount.balance > 10) {
        console.info(
          `⚠️  WARNING: Account has more than 10 NEAR (${targetAccount.balance} NEAR)`
        );
        const proceed = await new Promise(resolve => {
          const rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          rl.question(
            'Do you want to proceed with deletion? (yes/no): ',
            answer => {
              rl.close();
              resolve(answer.toLowerCase() === 'yes');
            }
          );
        });
        if (!proceed) {
          console.info('Operation cancelled.');
          process.exit(0);
        }
      }
    }

    // 2. Check beneficiary account balance and access
    const beneficiaryState = await checkAccountState(
      beneficiaryAccount,
      networkArg
    );
    if (!beneficiaryState.exists) {
      console.error(
        `Error: Beneficiary account ${beneficiaryAccount} does not exist`
      );
      process.exit(1);
    }

    if (beneficiaryState.balance < 10) {
      console.error(
        `Error: Beneficiary account ${beneficiaryAccount} has insufficient funds (${beneficiaryState.balance} NEAR). Needs at least 10 NEAR.`
      );
      process.exit(1);
    }

    // 3. Verify we have access to beneficiary account
    const hasBeneficiaryAccess = await verifyAccountAccess(
      beneficiaryAccount,
      networkArg
    );
    if (!hasBeneficiaryAccess) {
      console.error(
        `Error: No access to beneficiary account ${beneficiaryAccount}. Please login to this account first.`
      );
      process.exit(1);
    }

    console.info('✅ All safety checks passed');

    // Delete the existing contract account
    if (targetAccount.exists) {
      console.info(`\nDeleting existing contract account...`);
      execSync(
        `near delete-account ${accountId} ${beneficiaryAccount} --networkId ${networkArg}`,
        { stdio: 'inherit' }
      );
      console.info(`Successfully deleted account ${accountId}`);
    }

    // Create the account again
    console.info(`\nCreating new account...`);
    execSync(
      `near create-account ${accountId} --masterAccount ${beneficiaryAccount} --initialBalance 10 --networkId ${networkArg}`,
      { stdio: 'inherit' }
    );

    // Deploy the contract
    console.info(`\nDeploying contract...`);
    execSync(
      `near deploy ${accountId} ${contractFile} --networkId ${networkArg}`,
      { stdio: 'inherit' }
    );

    // Initialize the contract
    console.info(`\nInitializing contract...`);
    execSync(
      `near call ${accountId} init '{"admin_account": "${finalAdminAccount}", "usdc_token_contract": "${finalUsdcContract}", "backend_public_key": "${backendPublicKey}"}' --accountId ${accountId} --networkId ${networkArg}`,
      { stdio: 'inherit' }
    );

    console.info(`\nContract redeployed successfully!`);
    console.info(`Contract: ${accountId}`);
    console.info(`Admin: ${finalAdminAccount}`);
    console.info(`USDC Token Contract: ${finalUsdcContract}`);
    console.info(`Backend Public Key: ${backendPublicKey}`);
    console.info(`Explorer URL: ${networkConfig.explorerUrl}/${accountId}`);
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
