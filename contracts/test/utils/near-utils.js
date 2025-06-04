import { connect, keyStores, utils, providers, KeyPair } from 'near-api-js';
import { TextEncoder } from 'util';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Initialize NEAR connection using private key
 * @param {Object} credentials Optional credentials object
 * @param {string} credentials.accountId Account ID to initialize
 * @param {string} credentials.privateKey Private key for the account
 * @returns {Object} NEAR connection objects
 */
export async function initNear(credentials = null) {
  // Use provided credentials or fall back to env vars
  const accountId = credentials?.accountId || process.env.NEAR_ACCOUNT_ID;
  const privateKey = credentials?.privateKey || process.env.NEAR_PRIVATE_KEY;

  if (!accountId || !privateKey) {
    throw new Error('[ERROR][CONFIG] Missing NEAR credentials');
  }

  const keyStore = new keyStores.InMemoryKeyStore();
  const keyPair = utils.KeyPair.fromString(privateKey);

  await keyStore.setKey('testnet', accountId, keyPair);

  const config = {
    keyStore,
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
  };

  const near = await connect(config);
  const account = await near.account(accountId);

  return { near, account, accountId };
}

/**
 * Check if a contract is already initialized
 * @param {String} contractId Contract ID
 * @param {Object} options Options object
 * @param {String} options.nodeUrl NEAR node URL
 * @returns {Object} {isInitialized: boolean, adminAccount: string}
 */
export async function isContractInitialized(contractId, options = {}) {
  const { nodeUrl = process.env.NEAR_NODE_URL } = options;
  if (!nodeUrl) {
    throw new Error('[ERROR][CONFIG] Missing NEAR_NODE_URL in .env file');
  }

  try {
    const connectionConfig = {
      url: nodeUrl,
    };
    const provider = new providers.JsonRpcProvider(connectionConfig);

    // Try to access admin account using the getAdmin method
    const response = await provider.query({
      request_type: 'call_function',
      account_id: contractId,
      method_name: 'getAdmin',
      args_base64: Buffer.from(JSON.stringify({})).toString('base64'),
      finality: 'optimistic',
    });

    // If we get a result, the contract has been initialized
    const adminAccount = JSON.parse(Buffer.from(response.result).toString());
    return { isInitialized: !!adminAccount, admin: adminAccount };
  } catch (error) {
    // If we get an error, the contract is likely not initialized or the method doesn't exist
    return { isInitialized: false, admin: null };
  }
}

/**
 * Deploy a contract to NEAR
 * @param {Object} account NEAR account
 * @param {String} contractName Contract name
 * @param {String} wasmPath Path to WASM file
 * @param {Object} initArgs Initialization arguments
 * @param {Object} options Options object
 * @param {String} options.verbose Verbose output
 * @returns {Object} Deployment result
 */
export async function deployContract(
  account,
  contractName,
  wasmPath,
  initArgs = {},
  options = {}
) {
  const { verbose = false } = options;
  try {
    const wasmBinary = readFileSync(wasmPath);

    // Deploy the contract
    if (verbose) {
      console.info(`[INFO][DEPLOY] Deploying contract to ${contractName}...`);
    }

    // First, check if the contract is already initialized
    const { isInitialized, admin } = await isContractInitialized(contractName);
    if (verbose) {
      console.info(`[INFO][DEPLOY] Contract is initialized: ${isInitialized}`);
    }

    // First, create the account if it doesn't exist
    try {
      // Calculate gas and deposit for deployment
      const gas = '300000000000000';

      const deployResult = await account.deployContract(wasmBinary);

      if (verbose) {
        console.info(`[INFO][DEPLOY] Contract deployed successfully`);
      }

      // Initialize the contract if initialization arguments are provided and not already initialized
      if (Object.keys(initArgs).length > 0) {
        if (isInitialized) {
          if (verbose) {
            console.info(
              `[INFO][INIT] Contract is already initialized, skipping initialization`
            );
          }
          return {
            success: true,
            contractId: contractName,
            alreadyInitialized: true,
          };
        } else {
          if (verbose) {
            console.info(
              `[INFO][INIT] Initializing contract with args:`,
              initArgs
            );
          }
          try {
            const initResult = await account.functionCall({
              contractId: contractName,
              methodName: 'init',
              args: initArgs,
              gas: gas,
              attachedDeposit: utils.format.parseNearAmount('0.01'),
            });
            if (verbose) {
              console.info(`[INFO][INIT] Contract initialization successful`);
            }
            return {
              success: true,
              contractId: contractName,
              alreadyInitialized: false,
            };
          } catch (initError) {
            if (initError.toString().includes('Contract already initialized')) {
              if (verbose) {
                console.info(
                  `[INFO][INIT] Contract is already initialized, initialization attempt was rejected`
                );
              }
              return {
                success: true,
                contractId: contractName,
                alreadyInitialized: true,
              };
            } else {
              if (verbose) {
                console.error(
                  `[ERROR][DEPLOY] Error initializing contract:`,
                  initError
                );
              }
              return {
                success: false,
                error: initError,
                alreadyInitialized: false,
              };
            }
          }
        }
      }

      return {
        success: true,
        contractId: contractName,
        alreadyInitialized: false,
      };
    } catch (error) {
      // Check if the error is because the contract is already initialized
      if (error.toString().includes('Contract already initialized')) {
        if (verbose) {
          console.info(`[INFO][INIT] Contract is already initialized`);
        }
        return { success: false, error, alreadyInitialized: true };
      }
      if (verbose) {
        console.error(`[ERROR][DEPLOY] Error deploying contract:`, error);
      }
      return { success: false, error, alreadyInitialized: isInitialized };
    }
  } catch (error) {
    if (verbose) {
      console.error(`[ERROR][DEPLOY] Failed to deploy contract:`, error);
    }
    return { success: false, error };
  }
}

/**
 * Call a contract view method
 * @param {String} contractId Contract ID
 * @param {String} methodName Method name
 * @param {Object} args Method arguments
 * @returns {Object} Method result
 */
export async function callViewMethod(contractId, methodName, args = {}) {
  const nodeUrl = process.env.NEAR_NODE_URL || 'https://rpc.testnet.near.org';

  const connectionConfig = {
    url: nodeUrl,
  };
  const provider = new providers.JsonRpcProvider(connectionConfig);

  try {
    const result = await provider.query({
      request_type: 'call_function',
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      finality: 'optimistic',
    });

    return JSON.parse(Buffer.from(result.result).toString());
  } catch (error) {
    console.error(`Error calling view method ${methodName}:`, error);
    throw error;
  }
}

/**
 * Call a contract change method
 * @param {Object} account NEAR account
 * @param {String} contractId Contract ID
 * @param {String} methodName Method name
 * @param {Object} args Method arguments
 * @param {String} attachedDeposit Attached deposit in yoctoNEAR
 * @param {String} gas Gas to use
 * @returns {Object} Transaction result
 */
export async function callWriteMethod(
  account,
  contractId,
  methodName,
  args = {},
  attachedDeposit = '0',
  gas = '300000000000000'
) {
  try {
    const result = await account.functionCall({
      contractId,
      methodName,
      args,
      gas,
      attachedDeposit,
    });

    return result;
  } catch (error) {
    console.error(`Error calling change method ${methodName}:`, error);
    throw error;
  }
}

/**
 * Signs a JavaScript object using a NEAR Ed25519 key pair.
 * The object is first serialized to a JSON string, then encoded to UTF-8 bytes.
 * These bytes are then signed directly using the Ed25519 algorithm.
 * NO explicit hashing (like SHA-256) is performed before signing,
 * as the standard Ed25519 sign/verify functions (like the one in near-sdk-js)
 * typically expect the raw message.
 *
 * @param {object} messageObject - The JavaScript object to sign.
 * @param {string} privateKeyString - The NEAR private key string (e.g., "ed25519:...")
 * @returns {Uint8Array, Uint8Array} The signature bytes and the message bytes.
 */
export function signMessage(messageObject, privateKeyString) {
  // 1. Serialize the object to a JSON string
  const messageString = JSON.stringify(messageObject);

  // 2. Encode the JSON string to UTF-8 bytes (Uint8Array)
  const messageBytes = new TextEncoder().encode(messageString);

  // 3. Create KeyPair from the private key string
  const keyPair = KeyPair.fromString(privateKeyString);

  // 4. Sign the message bytes (no explicit pre-hashing)
  const signature = keyPair.sign(messageBytes);

  // 5. Return the signature bytes encoded as Uint8Array
  // signature.signature is the Uint8Array
  return { signature: signature.signature, messageBytes: messageBytes };
}

/**
 * Get test USDC tokens from the fakes contract
 * @param {Object} account NEAR account object
 * @param {number} amountInUSD Amount in USD to mint (will be converted to proper decimals)
 * @returns {Promise<string>} The amount of USDC minted
 */
export async function mintUSDCTokens(account, amountInUSD = 100) {
  const usdcContractId = process.env.USDC_CONTRACT_ID || 'usdc.fakes.testnet';

  try {
    // Check current balance first
    const currentBalance = await callViewMethod(
      usdcContractId,
      'ft_balance_of',
      { account_id: account.accountId }
    );
    console.info(`Initial USDC balance: ${currentBalance}`);

    // Convert USD amount to proper decimals (USDC uses 6 decimals)
    const requiredAmount = BigInt(amountInUSD * 1_000_000);

    // Only mint if current balance is less than required amount
    if (BigInt(currentBalance) < requiredAmount) {
      // First register the account with storage deposit if needed
      await callWriteMethod(
        account,
        usdcContractId,
        'storage_deposit',
        { account_id: account.accountId },
        utils.format.parseNearAmount('0.1')
      );

      // Mint only the difference needed
      const mintAmount = (requiredAmount - BigInt(currentBalance)).toString();
      await callWriteMethod(account, usdcContractId, 'mint', {
        account_id: account.accountId,
        amount: mintAmount,
      });

      // Verify the new balance
      const newBalance = await callViewMethod(usdcContractId, 'ft_balance_of', {
        account_id: account.accountId,
      });
      console.info(`USDC balance after minting: ${newBalance}`);
      return newBalance;
    } else {
      console.info(
        `Account already has sufficient USDC balance (${currentBalance}), skipping mint`
      );
      return currentBalance;
    }
  } catch (error) {
    console.error('[ERROR][USDC] Failed to get test USDC tokens:', error);
    throw error;
  }
}
