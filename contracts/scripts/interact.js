#!/usr/bin/env node

import { connect, keyStores, utils } from 'near-api-js';
import readline from 'readline';
import path from 'path';
import { homedir } from 'os';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration
const CONFIG = {
  testnet: {
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
    walletUrl: 'https://wallet.testnet.near.org',
    helperUrl: 'https://helper.testnet.near.org',
    explorerUrl: 'https://explorer.testnet.near.org',
  },
  mainnet: {
    networkId: 'mainnet',
    nodeUrl: 'https://rpc.mainnet.near.org',
    walletUrl: 'https://wallet.near.org',
    helperUrl: 'https://helper.mainnet.near.org',
    explorerUrl: 'https://explorer.near.org',
  }
};

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Parse command line arguments
const args = process.argv.slice(2);
const network = args[0] === 'mainnet' ? 'mainnet' : 'testnet';
const contractId = args[1];
const method = args[2];
const argsJson = args[3] || '{}';

// Validate arguments
if (!contractId || !method) {
  console.error('Usage: interact.js [network] [contract_id] [method] [args_json]');
  console.error('  network: "testnet" or "mainnet" (default: testnet)');
  console.error('  contract_id: The account ID of the contract');
  console.error('  method: The method to call on the contract');
  console.error('  args_json: JSON string of arguments to pass to the method (default: {})');
  process.exit(1);
}

// Connect to NEAR and call the contract
async function callContract() {
  try {
    // Load environment variables
    const { NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY } = process.env;
    
    if (!NEAR_ACCOUNT_ID || !NEAR_PRIVATE_KEY) {
      console.error('Missing NEAR_ACCOUNT_ID or NEAR_PRIVATE_KEY in .env file');
      console.error('Please add these variables to your .env file or use the credential store');
      process.exit(1);
    }

    // Use in-memory keystore with private key from .env
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = utils.KeyPair.fromString(NEAR_PRIVATE_KEY);
    await keyStore.setKey(network, NEAR_ACCOUNT_ID, keyPair);
    
    const nearConfig = {
      ...CONFIG[network],
      keyStore,
    };
    
    // Connect to NEAR
    const near = await connect(nearConfig);
    
    // Use the account from env
    const accountId = NEAR_ACCOUNT_ID;
    console.log(`Using account from .env: ${accountId}`);
    
    // Load the account
    const account = await near.account(accountId);
    
    // Determine if this is a view or call method
    const isView = method.startsWith('get') || method.startsWith('is') || method.startsWith('view');
    
    // Parse arguments
    const methodArgs = JSON.parse(argsJson);
    
    console.log(`Calling ${isView ? 'view' : 'call'} method '${method}' on contract '${contractId}' with args:`, methodArgs);
    
    let result;
    if (isView) {
      // Call view method
      result = await account.viewFunction({
        contractId,
        methodName: method,
        args: methodArgs
      });
    } else {
      // Ask for attached deposit if it's a call method
      const attachDeposit = await new Promise(resolve => {
        rl.question('Enter amount of NEAR to attach (in yoctoNEAR, or press Enter for 0): ', answer => {
          resolve(answer.trim() === '' ? '0' : answer);
        });
      });
      
      // Call change method
      result = await account.functionCall({
        contractId,
        methodName: method,
        args: methodArgs,
        gas: "300000000000000", // 300 TGas
        attachedDeposit: attachDeposit === '0' ? '0' : utils.format.parseNearAmount(attachDeposit)
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('Error calling contract:', error.message);
  } finally {
    rl.close();
  }
}

callContract();
