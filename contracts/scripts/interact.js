#!/usr/bin/env node

import { connect, keyStores, utils } from 'near-api-js';
import readline from 'readline';
import path from 'path';
import { homedir } from 'os';

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
    // Configure the connection
    const keyStore = new keyStores.UnencryptedFileSystemKeyStore(
      path.join(homedir, `.near-credentials/${network}`)
    );
    
    const nearConfig = {
      ...CONFIG[network],
      keyStore,
    };
    
    // Connect to NEAR
    const near = await connect(nearConfig);
    
    // Get list of accounts from keystore
    const accountIds = await keyStore.getAccounts(network);
    
    if (accountIds.length === 0) {
      console.error(`No accounts found for ${network}. Please login first with 'near login'.`);
      process.exit(1);
    }
    
    // If multiple accounts, ask which one to use
    let accountId;
    if (accountIds.length === 1) {
      accountId = accountIds[0];
    } else {
      console.log('Available accounts:');
      accountIds.forEach((id, index) => {
        console.log(`${index + 1}. ${id}`);
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Select account number to use: ', resolve);
      });
      
      const index = parseInt(answer) - 1;
      if (isNaN(index) || index < 0 || index >= accountIds.length) {
        console.error('Invalid selection');
        process.exit(1);
      }
      
      accountId = accountIds[index];
    }
    
    console.log(`Using account: ${accountId}`);
    
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
        attachedDeposit: utils.format.parseNearAmount(attachDeposit)
      });
    }
    
    console.log('Result:', result);
    
  } catch (error) {
    console.error('Error calling contract:', error.message);
  } finally {
    rl.close();
  }
}

callContract();
