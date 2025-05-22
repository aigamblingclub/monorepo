import { expect } from 'chai';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { initNear, deployContract, callViewMethod, callWriteMethod, signMessage } from './utils/near-utils.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get directory path
const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('AI Gambling Club Contract Tests', function() {
  // Test variables
  let near;
  let account;
  let accountId;
  let contractId;
  const wasmPath = join(__dirname, '..', 'build', 'ai-gambling-club.wasm');
  
  // Setup - runs before all tests
  before(async function() {
    try {
      // Initialize NEAR connection with private key from .env
      const connection = await initNear();
      
      // If we don't have a connection, throw an error
      if (!connection.account) {
        throw new Error('Failed to load NEAR account private key');
      }
      
      near = connection.near;
      account = connection.account;
      accountId = connection.accountId;
      contractId = process.env.CONTRACT_ID || accountId;
      
      console.log(`Successfully connected to NEAR account: ${accountId}`);
    } catch (error) {
      console.error('Error in before hook:', error);
      throw error;
    }
  });
  
  // Test 1: Deploy the contract with private key
  it('should deploy the contract', async function() {
    try {
      const usdcContractId = process.env.USDC_CONTRACT_ID || 'usdc.fakes.testnet';
      const backendPublicKey = process.env.BACKEND_PUBLIC_KEY || null;
      if (!backendPublicKey) {
        throw new Error('BACKEND_PUBLIC_KEY is not set');
      }
      
      // Deploy the contract
      const deployResult = await deployContract(
        account, 
        contractId, 
        wasmPath, 
        {
          admin_account: accountId,
          usdc_token_contract: usdcContractId,
          backend_public_key: backendPublicKey
        }
      );
      
      // If the deployment fails but the contract is already initialized,
      // we should still consider this a success for the test
      if (!deployResult.success && deployResult.error && 
          (deployResult.error.toString().includes('Contract already initialized') ||
           deployResult.alreadyInitialized === true)) {
        console.log('Contract was already deployed and initialized at', account);
        this.skip(); // Skip the rest of the test
        return;
      }
      
      expect(deployResult.success).to.be.true;
      expect(deployResult.contractId).to.equal(contractId);
      
      console.log(`Successfully deployed contract to ${contractId}`);
    } catch (error) {
      console.error('Deployment error:', error);
      throw error;
    }
  });
  
  // Test 2: Call the contract to get the admin
  it('should get the admin account', async function() {
    try {
      // Call the getAdmin view method
      const admin = await callViewMethod(contractId, 'getAdmin', {});
      
      expect(admin).includes(accountId);
      console.log(`Admin account is ${admin}`);
    } catch (error) {
      console.error('Error getting admin:', error);
      throw error;
    }
  });

  // Test 3: Change the contract owner
  it('should change the contract owner', async function() {
    try {
      // New admin account is the same as the current admin in this test
      const newAdmin = account;
      
      // Call the changeAdmin method
      const changeResult = await callWriteMethod(
        account,
        contractId,
        'changeAdmin',
        { new_admin: newAdmin }
      );
      
      // Verify the transaction succeeded
      expect(changeResult.transaction_outcome.status).to.have.property('SuccessValue');
      
      // Verify the admin was changed
      const admin = await callViewMethod(contractId, 'getAdmin', {});
      expect(admin).to.equal(newAdmin);
      
      console.log(`Successfully changed admin to ${newAdmin}`);
    } catch (error) {
      console.error('Error changing admin:', error);
      throw error;
    }
  });

  // Test 4: Transfer USDC to contract and check balance
  it('should transfer USDC to contract and update balance', async function() {
    try {
      const usdcContractId = process.env.USDC_CONTRACT_ID || 'usdc.fakes.testnet';
      const transferAmount = '100000'; // 0.1 USDC
      
      // Get initial balances
      const initialContractBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      // Transfer USDC to contract using ft_transfer_call
      const transferResult = await callWriteMethod(
        account,
        usdcContractId,
        'ft_transfer_call',
        {
          receiver_id: contractId,
          amount: transferAmount,
          msg: ''
        },
        '1' // Attach 1 yoctoNEAR for security
      );
      
      expect(transferResult.transaction_outcome.status).to.have.property('SuccessValue');
      
      // Check updated contract balance
      const newContractBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      // Verify balance increased by transfer amount
      expect(BigInt(newContractBalance) - BigInt(initialContractBalance))
        .to.equal(BigInt(transferAmount));
      
      console.log(`Successfully transferred ${transferAmount} USDC to contract`);
      console.log(`New contract balance: ${newContractBalance}`);
    } catch (error) {
      console.error('Error in USDC transfer test:', error);
      throw error;
    }
  });

  // Test 5: Lock USDC balance and verify lock status
  it('should lock USDC balance and show correct lock status', async function() {
    try {
      // Check initial lock status
      const initialLockStatus = await callViewMethod(
        contractId,
        'isUsdcLocked',
        { account_id: accountId }
      );
      expect(initialLockStatus).to.be.false;
      
      // Lock the USDC balance
      const lockResult = await callWriteMethod(
        account,
        contractId,
        'lockUsdcBalance',
        {}  // No parameters needed as it uses caller's account
      );
      
      // Verify the lock transaction succeeded
      expect(lockResult.transaction_outcome.status).to.have.property('SuccessValue');
      
      // Check final lock status
      const finalLockStatus = await callViewMethod(
        contractId,
        'isUsdcLocked',
        { account_id: accountId }
      );
      expect(finalLockStatus).to.be.true;
      
      console.log(`Successfully locked USDC balance for ${accountId}`);
    } catch (error) {
      console.error('Error in USDC lock test:', error);
      throw error;
    }
  });

  // Test 6: Unlock USDC balance with a win
  it('should unlock USDC balance with a win', async function() {
    try {
      // Get initial balance
      const initialBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      // Create game result message
      const gameResult = {
        gameId: "1",
        accountId: accountId,
        amount: "100000" // 0.1 USDC win
      };
      
      const message = JSON.stringify(gameResult);
      
      // Get backend private key from environment
      const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;
      if (!backendPrivateKey) {
        throw new Error('BACKEND_PRIVATE_KEY not set in environment');
      }
      
      // Generate signature
      const signature = signMessage(message, backendPrivateKey);
      
      // Call unlockUsdcBalance
      const unlockResult = await callWriteMethod(
        account,
        contractId,
        'unlockUsdcBalance',
        {
          account_id: accountId,
          amount_change: "100000", // 0.1 USDC win
          message,
          signature
        }
      );
      
      // Verify the unlock transaction succeeded
      expect(unlockResult.transaction_outcome.status).to.have.property('SuccessValue');
      
      // Check final balance
      const finalBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      // Verify balance increased by win amount
      expect(BigInt(finalBalance) - BigInt(initialBalance))
        .to.equal(BigInt("100000"));
      
      // Verify account is no longer locked
      const isLocked = await callViewMethod(
        contractId,
        'isUsdcLocked',
        { account_id: accountId }
      );
      expect(isLocked).to.be.false;
      
      console.log(`Successfully unlocked USDC balance for ${accountId} with 0.1 USDC win`);
    } catch (error) {
      console.error('Error in USDC unlock test:', error);
      throw error;
    }
  });

  // Test 7: Unlock USDC balance with a loss
  it('should unlock USDC balance with a loss', async function() {
    try {
      // Get initial balance
      const initialBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      // Lock the balance first (in case previous test unlocked it)
      const lockResult = await callWriteMethod(
        account,
        contractId,
        'lockUsdcBalance',
        {}
      );
      expect(lockResult.transaction_outcome.status).to.have.property('SuccessValue');
      
      // Create game result message with a loss
      const gameResult = {
        gameId: "2",
        accountId: accountId,
        amount: "-100000" // -0.1 USDC (loss)
      };
      
      const message = JSON.stringify(gameResult);
      
      // Get backend private key from environment
      const backendPrivateKey = process.env.BACKEND_PRIVATE_KEY;
      if (!backendPrivateKey) {
        throw new Error('BACKEND_PRIVATE_KEY not set in environment');
      }
      
      // Generate signature
      const signature = signMessage(message, backendPrivateKey);
      
      // Call unlockUsdcBalance
      const unlockResult = await callWriteMethod(
        account,
        contractId,
        'unlockUsdcBalance',
        {
          account_id: accountId,
          amount_change: "-100000", // -0.1 USDC (loss)
          message,
          signature
        }
      );
      
      // Verify the unlock transaction succeeded
      expect(unlockResult.transaction_outcome.status).to.have.property('SuccessValue');
      
      // Check final balance
      const finalBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      // Verify balance decreased by loss amount
      expect(BigInt(finalBalance) - BigInt(initialBalance))
        .to.equal(BigInt("-100000"));
      
      // Verify account is no longer locked
      const isLocked = await callViewMethod(
        contractId,
        'isUsdcLocked',
        { account_id: accountId }
      );
      expect(isLocked).to.be.false;
      
      console.log(`Successfully unlocked USDC balance for ${accountId} with 0.1 USDC loss`);
    } catch (error) {
      console.error('Error in USDC unlock with loss test:', error);
      throw error;
    }
  });

  // Test 8: Withdraw USDC from contract
  it('should withdraw USDC from contract', async function() {
    try {
      // Get initial balance
      const initialBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      console.log(`Initial USDC balance: ${initialBalance}`);
      
      // Verify we have enough balance to withdraw
      expect(BigInt(initialBalance)).to.be.gte(BigInt("100000")); // At least 0.1 USDC
      
      // Call withdrawUsdc
      const withdrawResult = await callWriteMethod(
        account,
        contractId,
        'withdrawUsdc',
        {
          amount: "100000" // 0.1 USDC
        }
      );
      
      // Verify the withdrawal transaction succeeded
      expect(withdrawResult.transaction_outcome.status).to.have.property('SuccessValue');
      
      // Check final balance
      const finalBalance = await callViewMethod(
        contractId,
        'getUsdcBalance',
        { account_id: accountId }
      );
      
      // Verify balance decreased by withdrawal amount
      expect(BigInt(finalBalance) - BigInt(initialBalance))
        .to.equal(BigInt("-100000"));
      
      console.log(`Successfully withdrew 0.1 USDC, final balance: ${finalBalance}`);
    } catch (error) {
      console.error('Error in USDC withdrawal test:', error);
      throw error;
    }
  });
}); 