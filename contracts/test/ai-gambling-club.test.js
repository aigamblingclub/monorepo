import { expect } from 'chai';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  initNear,
  deployContract,
  callViewMethod,
  callWriteMethod,
  signMessage,
  mintUSDCTokens,
} from './utils/near-utils.js';
import { utils } from 'near-api-js';
import { ethers } from 'ethers';

import dotenv from 'dotenv';
dotenv.config();

// Get directory path
const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('AI Gambling Club Contract Tests', function () {
  // Test variables
  let Contract;
  let AccountAddress;
  let ContractAddress;
  // Add Bob's account variables
  let Bob;
  let bobAddress;

  // Backend wallet for signing
  let backendWallet;
  let backendAddress;

  const wasmPath = join(__dirname, '..', 'build', 'ai-gambling-club.wasm');
  const usdcContractId = process.env.USDC_CONTRACT_ID || 'usdc.fakes.testnet';

  // Setup - runs before all tests
  before(async function () {
    try {
      // Initialize main account connection with private key from .env
      const connection = await initNear();

      // If we don't have a connection, throw an error
      if (!connection.account) {
        throw new Error('Failed to load NEAR account private key');
      }

      Contract = connection.account;
      AccountAddress = connection.accountId;

      // Initialize Bob's account
      const bobConnection = await initNear({
        accountId: process.env.NEAR_BOB_ACCOUNT_ID,
        privateKey: process.env.NEAR_BOB_PRIVATE_KEY,
      });

      Bob = bobConnection.account;
      bobAddress = bobConnection.accountId;

      ContractAddress = process.env.CONTRACT_ID || AccountAddress;

      // Initialize backend wallet for ECDSA signing
      const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;
      if (!backendPrivateKey) {
        throw new Error('BACKEND_PRIVATE_KEY not set in environment');
      }

      backendWallet = new ethers.Wallet(backendPrivateKey);
      backendAddress = backendWallet.address;

      console.info(`Successfully connected to NEAR accounts:
      - Main account: ${AccountAddress}
      - Bob's account: ${bobAddress}
      - Backend wallet: ${backendAddress}`);

      // Make sure the contract can use the USDC contract
      await callWriteMethod(
        Contract,
        usdcContractId,
        'storage_deposit',
        { account_id: ContractAddress },
        utils.format.parseNearAmount('0.1')
      );
    } catch (error) {
      console.error('Error in before hook:', error);
      throw error;
    }
  });

  // Test 1: Deploy the contract with private key
  it('should deploy the contract', async function () {
    try {
      const usdcContractId =
        process.env.USDC_CONTRACT_ID || 'usdc.fakes.testnet';

      // Deploy the contract
      const deployResult = await deployContract(
        Contract,
        ContractAddress,
        wasmPath,
        {
          admin_account: AccountAddress,
          usdc_token_contract: usdcContractId,
          backend_public_key: backendAddress,
        },
        {
          verbose: false,
        }
      );

      // If the deployment fails but the contract is already initialized,
      // we should still consider this a success for the test
      if (
        !deployResult.success &&
        deployResult.error &&
        (deployResult.error
          .toString()
          .includes('Contract already initialized') ||
          deployResult.alreadyInitialized === true)
      ) {
        console.info(
          'Contract was already deployed and initialized at',
          Contract
        );
        this.skip(); // Skip the rest of the test
        return;
      }

      expect(deployResult.success).to.be.true;
      expect(deployResult.contractId).to.equal(ContractAddress);

      console.info(`Successfully deployed contract to ${ContractAddress}`);
    } catch (error) {
      console.error('Deployment error:', error);
      throw error;
    }
  });

  // Test 2: Call the contract to get the admin
  it('should get the admin account', async function () {
    try {
      // Call the getAdmin view method
      const admin = await callViewMethod(ContractAddress, 'getAdmin', {});

      expect(admin).includes(AccountAddress);
      console.info(`Admin account is ${admin}`);
    } catch (error) {
      console.error('Error getting admin:', error);
      throw error;
    }
  });

  // Test 3: Change the contract owner
  it('should change the contract owner', async function () {
    try {
      // Check current admin first
      const currentAdmin = await callViewMethod(
        ContractAddress,
        'getAdmin',
        {}
      );
      console.info('Current admin:', currentAdmin);

      // New admin account is the same as the current admin in this test
      const newAdmin = AccountAddress;
      console.info('New admin will be:', newAdmin);

      // Call the changeAdmin method
      await callWriteMethod(Contract, ContractAddress, 'changeAdmin', {
        new_admin: newAdmin,
      });

      // Verify the admin was changed
      const admin = await callViewMethod(ContractAddress, 'getAdmin', {});
      console.info('Admin after change:', admin);
      expect(admin).to.equal(newAdmin);

      console.info(`Successfully changed admin to ${newAdmin}`);
    } catch (error) {
      console.error('Error changing admin:', error);
      throw error;
    }
  });

  // Test 4: Update backend signer address
  it('should update the backend signer address', async function () {
    try {
      // Set a new Ethereum address
      const newBackendAddress = process.env.BACKEND_PUBLIC_KEY; // Using the same address from env

      console.info('Updating backend signer to:', newBackendAddress);

      // Call the updateBackendSigner method
      await callWriteMethod(Contract, ContractAddress, 'updateBackendSigner', {
        new_public_key: newBackendAddress,
      });

      console.info(
        `Successfully updated backend signer to ${newBackendAddress}`
      );
    } catch (error) {
      console.error('Error updating backend signer:', error);
      throw error;
    }
  });

  // Test 5: Transfer USDC to contract and check balance
  it('should transfer USDC to contract and update balance', async function () {
    try {
      // Check if the account is locked (might happen since its same state accross multiple tests)
      const isLocked = await callViewMethod(ContractAddress, 'isUsdcLocked', {
        account_id: bobAddress,
      });
      if (isLocked) {
        console.info('Account is locked, skipping usdct transfer test');
        this.skip();
        return;
      }

      // Start the transfer test
      const usdAmount = 100; // $100 USD

      // Get test USDC tokens (this will check balance and mint only if needed)
      await mintUSDCTokens(Bob, usdAmount);

      // Get initial contract balance
      const initialContractBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );

      console.info('Initial contract balance:', initialContractBalance);

      // Convert USD amount to USDC decimals
      const transferAmount = (usdAmount * 1_000_000).toString();

      // Transfer USDC to contract using ft_transfer_call
      try {
        await callWriteMethod(
          Bob,
          usdcContractId,
          'ft_transfer_call',
          {
            receiver_id: ContractAddress,
            amount: transferAmount,
            msg: '',
          },
          '1' // Attach 1 yoctoNEAR for security
        );
      } catch (error) {
        // Transaction failed
        throw new Error(`USDC transfer failed: ${error.message}`);
      }

      // Check updated contract balance
      const newContractBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );

      // Verify balance increased by transfer amount
      expect(
        BigInt(newContractBalance) - BigInt(initialContractBalance)
      ).to.equal(BigInt(transferAmount));

      console.info(`Successfully transferred ${usdAmount} USDC to contract`);
      console.info(`New contract balance: ${newContractBalance}`);
    } catch (error) {
      console.error('Error in USDC transfer test:', error);
      throw error;
    }
  });

  // Test 6: Lock USDC balance and verify lock status
  it('should lock USDC balance and show correct lock status', async function () {
    try {
      // Check initial lock status
      const initialLockStatus = await callViewMethod(
        ContractAddress,
        'isUsdcLocked',
        { account_id: AccountAddress }
      );
      expect(initialLockStatus).to.be.false;

      // Lock the USDC balance
      try {
        await callWriteMethod(
          Bob,
          ContractAddress,
          'lockUsdcBalance',
          {} // No parameters needed as it uses caller's account
        );
      } catch (error) {
        // Transaction failed
        throw new Error(`USDC lock failed: ${error.message}`);
      }

      // Check final lock status
      const finalLockStatus = await callViewMethod(
        ContractAddress,
        'isUsdcLocked',
        { account_id: bobAddress }
      );
      expect(finalLockStatus).to.be.true;

      console.info(`Successfully locked USDC balance for ${AccountAddress}`);
    } catch (error) {
      console.error('Error in USDC lock test:', error);
      throw error;
    }
  });

  // Test 7: Unlock USDC balance with a win
  it('should unlock USDC balance with a win', async function () {
    try {
      // Check if account is locked, if not, lock it first
      const isInitiallyLocked = await callViewMethod(
        ContractAddress,
        'isUsdcLocked',
        { account_id: bobAddress }
      );

      if (!isInitiallyLocked) {
        console.info('Account not locked, locking it first...');
        await callWriteMethod(Bob, ContractAddress, 'lockUsdcBalance', {});

        // Verify it's now locked
        const isNowLocked = await callViewMethod(
          ContractAddress,
          'isUsdcLocked',
          { account_id: bobAddress }
        );
        expect(isNowLocked).to.be.true;
        console.info('Account successfully locked');
      }

      // Get initial balance
      const initialBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );

      // Get initial nonce
      const initialNonce = await callViewMethod(ContractAddress, 'getNonce', {
        account_id: bobAddress,
      });

      console.info('%s Initial Nonce: %s', bobAddress, initialNonce);

      // Create game result message
      const gameResult = {
        accountId: bobAddress,
        amount: '1000000', // 1 USDC win
        nonce: initialNonce, // nonce is already an integer from the contract
        deadline: (Date.now() * 1_000_000 + 60_000_000_000).toString(), // 1 minute from now in nanoseconds
      };

      // Generate signature using ethers wallet
      const message = JSON.stringify(gameResult);
      console.info('Message:', message);
      const signature = await backendWallet.signMessage(message);
      console.info('Signature:', signature);

      // Call unlockUsdcBalance
      try {
        await callWriteMethod(Contract, ContractAddress, 'unlockUsdcBalance', {
          account_id: bobAddress, // Use Bob's address to match the gameResult
          amount_change: gameResult.amount, // 1 USDC win
          message: message,
          signature: signature, // Use base64 signature instead of hex
        });
      } catch (error) {
        // Transaction failed
        throw new Error(`USDC unlock failed: ${error.message}`);
      }

      // Check final balance
      const finalBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );

      // Verify balance increased by win amount
      expect(BigInt(finalBalance) - BigInt(initialBalance)).to.equal(
        BigInt(gameResult.amount)
      );

      // Verify account is no longer locked
      const isLocked = await callViewMethod(ContractAddress, 'isUsdcLocked', {
        account_id: bobAddress,
      });
      expect(isLocked).to.be.false;

      // Get final nonce and verify it increased by 1
      const finalNonce = await callViewMethod(ContractAddress, 'getNonce', {
        account_id: bobAddress,
      });

      console.info('%s Final Nonce: %s', bobAddress, finalNonce);
      expect(finalNonce).to.equal(initialNonce + 1);

      console.info(
        `Successfully unlocked USDC balance for ${bobAddress} with ${gameResult.amount} USDC win`
      );
      console.info(
        `Nonce correctly incremented from ${initialNonce} to ${finalNonce}`
      );
    } catch (error) {
      console.error('Error in USDC unlock test:', error);
      throw error;
    }
  });

  // Test 8: Unlock USDC balance with a loss
  it('should unlock USDC balance with a loss', async function () {
    try {
      // Check if account is locked, if not, lock it first
      const isInitiallyLocked = await callViewMethod(
        ContractAddress,
        'isUsdcLocked',
        { account_id: bobAddress }
      );

      if (!isInitiallyLocked) {
        console.info('Account not locked, locking it first...');
        await callWriteMethod(Bob, ContractAddress, 'lockUsdcBalance', {});

        // Verify it's now locked
        const isNowLocked = await callViewMethod(
          ContractAddress,
          'isUsdcLocked',
          { account_id: bobAddress }
        );
        expect(isNowLocked).to.be.true;
        console.info('Account successfully locked');
      }

      // Get initial balance
      const initialBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );

      console.info('%s Initial Balance: %s', bobAddress, initialBalance);

      // Get initial nonce
      const initialNonce = await callViewMethod(ContractAddress, 'getNonce', {
        account_id: bobAddress,
      });

      console.info('%s Initial Nonce: %s', bobAddress, initialNonce);

      // Create game result message with a loss
      const gameResult = {
        accountId: bobAddress,
        amount: '-1000000', // 1 USDC loss (negative amount)
        nonce: initialNonce, // nonce is already an integer from the contract
        deadline: (Date.now() * 1_000_000 + 60_000_000_000).toString(), // 1 minute from now in nanoseconds
      };

      // Generate signature using ethers wallet
      const message = JSON.stringify(gameResult);
      console.info('Message:', message);
      const signature = await backendWallet.signMessage(message);
      console.info('Signature:', signature);

      // Call unlockUsdcBalance
      try {
        await callWriteMethod(Contract, ContractAddress, 'unlockUsdcBalance', {
          account_id: bobAddress, // Use Bob's address to match the gameResult
          amount_change: gameResult.amount, // 1 USDC loss (negative)
          message: message,
          signature: signature,
        });
      } catch (error) {
        // Transaction failed
        throw new Error(`USDC unlock failed: ${error.message}`);
      }

      // Check final balance
      const finalBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );

      console.info('%s Final Balance: %s', bobAddress, finalBalance);

      // Verify balance decreased by loss amount
      expect(BigInt(finalBalance) - BigInt(initialBalance)).to.equal(
        BigInt(gameResult.amount)
      );

      // Verify account is no longer locked
      const isLocked = await callViewMethod(ContractAddress, 'isUsdcLocked', {
        account_id: bobAddress,
      });
      expect(isLocked).to.be.false;

      // Get final nonce and verify it increased by 1
      const finalNonce = await callViewMethod(ContractAddress, 'getNonce', {
        account_id: bobAddress,
      });

      console.info('%s Final Nonce: %s', bobAddress, finalNonce);
      expect(finalNonce).to.equal(initialNonce + 1);

      console.info(
        `Successfully unlocked USDC balance for ${bobAddress} with ${gameResult.amount} USDC loss`
      );
      console.info(
        `Nonce correctly incremented from ${initialNonce} to ${finalNonce}`
      );
    } catch (error) {
      console.error('Error in USDC unlock test:', error);
      throw error;
    }
  });

  // Test 9: Fail to sabotage the message
  it('should fail to forge the signature message', async function () {
    // Check if account is locked, if not, lock it first
    const isInitiallyLocked = await callViewMethod(
      ContractAddress,
      'isUsdcLocked',
      { account_id: bobAddress }
    );

    if (!isInitiallyLocked) {
      console.info('Account not locked, locking it first...');
      await callWriteMethod(Bob, ContractAddress, 'lockUsdcBalance', {});

      // Verify it's now locked
      const isNowLocked = await callViewMethod(
        ContractAddress,
        'isUsdcLocked',
        { account_id: bobAddress }
      );
      expect(isNowLocked).to.be.true;
      console.info('Account successfully locked');
    }

    // Get initial balance
    const initialBalance = await callViewMethod(
      ContractAddress,
      'getUsdcBalance',
      { account_id: bobAddress }
    );

    console.info('%s Initial Balance: %s', bobAddress, initialBalance);

    // Get initial nonce
    const initialNonce = await callViewMethod(ContractAddress, 'getNonce', {
      account_id: bobAddress,
    });

    console.info('%s Initial Nonce: %s', bobAddress, initialNonce);

    // Create game result message with a loss
    const gameResult = {
      accountId: bobAddress,
      amount: '-1000000', // 1 USDC loss (negative amount)
      nonce: initialNonce, // nonce is already an integer from the contract
      deadline: (Date.now() * 1_000_000 + 60_000_000_000).toString(), // 1 minute from now in nanoseconds
    };

    // Generate signature using ethers wallet
    const message = JSON.stringify(gameResult);
    console.info('Message:', message);
    const signature = await backendWallet.signMessage(message);
    console.info('Signature:', signature);

    // Sabotage the value to withdraw
    gameResult.amount = '50000000'; // 50 USDC
    const sabotagedMessage = JSON.stringify(gameResult);

    // Call unlockUsdcBalance
    try {
      await callWriteMethod(Contract, ContractAddress, 'unlockUsdcBalance', {
        message: sabotagedMessage, // We sabotaged the message
        signature: signature, // But we still use the correct signature
      });
      throw new Error(`It should have failed, but it didn't`);
    } catch (error) {
      expect(error.message).to.include('Signature verification failed');
    }
  });

  // Test 10: Withdraw USDC from contract
  it('should withdraw USDC from contract', async function () {
    try {
      // First, clear any pending withdrawal status (admin function for emergency)
      try {
        await callWriteMethod(
          Contract,
          ContractAddress,
          'clearPendingWithdrawal',
          { account_id: bobAddress }
        );
        console.info('Cleared any pending withdrawal status');
      } catch (error) {
        // Ignore if method doesn't exist or fails
        console.info('No pending withdrawal to clear or method failed');
      }

      // Check if account is locked, if yes, unlock it first
      const isInitiallyLocked = await callViewMethod(
        ContractAddress,
        'isUsdcLocked',
        { account_id: bobAddress }
      );

      if (isInitiallyLocked) {
        console.info('Account locked, unlocking it first...');

        const initialNonce = await callViewMethod(ContractAddress, 'getNonce', {
          account_id: bobAddress,
        });

        const gameResult = {
          accountId: bobAddress,
          amount: '1000000', // 1 USDC win
          nonce: initialNonce, // nonce is already an integer from the contract
          deadline: (Date.now() * 1_000_000 + 60_000_000_000).toString(), // 1 minute from now in nanoseconds
        };

        const message = JSON.stringify(gameResult);
        const signature = await backendWallet.signMessage(message);

        await callWriteMethod(Contract, ContractAddress, 'unlockUsdcBalance', {
          message: message,
          signature: signature,
        });
        console.info('Account unlocked successfully');
      }

      // Get initial balance
      const initialBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );
      console.info(
        `Initial USDC balance on the AGC contract state: ${initialBalance}`
      );

      // Get initial balance on the USDC contract
      const initialBalanceOnUsdcContract = await callViewMethod(
        usdcContractId,
        'ft_balance_of',
        { account_id: bobAddress }
      );
      console.info(
        `Initial USDC balance on Bob's account: ${initialBalanceOnUsdcContract}`
      );

      // Call withdrawUsdc
      await callWriteMethod(Bob, ContractAddress, 'withdrawUsdc', {
        amount: '1000000', // 1 USDC
      });

      // Wait a bit for the callback to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check final balance
      const finalBalance = await callViewMethod(
        ContractAddress,
        'getUsdcBalance',
        { account_id: bobAddress }
      );
      console.info(
        `Final USDC balance on the AGC contract state: ${finalBalance}`
      );

      // Get final balance on the USDC contract
      const finalBalanceOnUsdcContract = await callViewMethod(
        usdcContractId,
        'ft_balance_of',
        { account_id: bobAddress }
      );
      console.info(
        `Final USDC balance on Bob's account: ${finalBalanceOnUsdcContract}`
      );

      // Verify balance decreased by withdrawal amount on contract
      expect(BigInt(finalBalance) - BigInt(initialBalance)).to.equal(
        BigInt('-1000000')
      );

      // Verify balance increased by withdrawal amount on user's USDC account
      expect(
        BigInt(finalBalanceOnUsdcContract) -
          BigInt(initialBalanceOnUsdcContract)
      ).to.equal(BigInt('1000000'));

      console.info('Withdrawal test completed successfully!');
    } catch (error) {
      console.error('Error in USDC withdrawal test:', error);
      throw error;
    }
  });
});
