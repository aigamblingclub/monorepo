# AI Gambling Club NEAR Contract

This repository contains a NEAR smart contract for AI Gambling Club, a GameFi platform where users can bet on AIs playing against each other. The contract handles deposits and withdrawals for both NEAR and USDC tokens, with admin functionality to lock user funds and adjust balances as poker matches are played.

## Features

- Deposit and withdraw NEAR tokens
- Deposit and withdraw USDC tokens
- Admin functionality to lock/unlock user funds
- Admin ability to adjust balances upon unlocking
- Comprehensive event emission for all operations
- Full suite of deployment and management scripts
- Secure signature verification for game results

## Project Structure

```
ai-gambling-club-near/
├── src/
│   └── ai-gambling-club.js       # Main contract implementation
├── scripts/
│   ├── build.js                # Compiles contract to WebAssembly
│   ├── deploy.js               # General deployment script
│   ├── deploy-testnet.js       # Testnet-specific deployment
│   ├── deploy-mainnet.js       # Mainnet deployment with safety checks
│   ├── interact.js             # General contract interaction
│   ├── admin.js                # Admin operations interface
│   └── monitor.js              # Event monitoring with filtering
├── build/                      # Compiled contract output
├── package.json                # Project configuration and scripts
└── todo.md                     # Development task list
```

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- NEAR CLI (installed globally)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

### Getting Test USDC (Testnet)

To test the contract on testnet, you'll need some test USDC. Follow these steps:

1. Register your account with the test USDC contract (requires a small NEAR deposit for storage):
   ```bash
   near call usdc.fakes.testnet storage_deposit '{"account_id": "YOUR_ACCOUNT.testnet"}' --accountId YOUR_ACCOUNT.testnet --amount 0.1
   ```

2. Mint test USDC (1000 USDC in this example, adjust amount as needed):
   ```bash
   near call usdc.fakes.testnet mint '{"account_id": "YOUR_ACCOUNT.testnet", "amount": "1000000000"}' --accountId YOUR_ACCOUNT.testnet
   ```
   Note: USDC uses 6 decimal places, so "1000000000" = 1000 USDC

3. Check your balance:
   ```bash
   near view usdc.fakes.testnet ft_balance_of '{"account_id": "YOUR_ACCOUNT.testnet"}'
   ```

You can repeat the mint command to get more test USDC as needed. Remember that these are test tokens with no real value!

### Generating Backend Signing Keys

The contract uses Ed25519 signatures to verify game results. You'll need to generate a keypair for this:

1. Generate a new keypair using NEAR CLI:
   ```bash
   near generate-key backend-signer-key
   ```

2. The command will output something like:
   ```
   Key pair: {
     "publicKey": "ed25519:BxLk4CJJPDM1MQW2qKJCop5BYxjNovxLA7TUXuUm9xns",
     "secretKey": "ed25519:Vtm4UXxd1..."
   }
   ```

3. Copy the public key and private key to your .env file:
   ```
   BACKEND_PUBLIC_KEY=ed25519:BxLk4CJJPDM1MQW2qKJCop5BYxjNovxLA7TUXuUm9xns
   BACKEND_PRIVATE_KEY=ed25519:Vtm4UXxd1...
   ```

   Note: Keep your private key secure and never commit it to version control!

### Building the Contract

```
npm run build
```

This will compile the contract to WebAssembly in the `build` directory.

### Deploying the Contract

#### To Testnet

```
npm run deploy:testnet <account_id> [admin_account] [usdc_token_contract] [backend_public_key]
```

- `account_id`: The account ID to deploy the contract to
- `admin_account`: (Optional) The account ID of the admin (defaults to the deployer)
- `usdc_token_contract`: (Optional) The account ID of the USDC token contract (defaults to `usdc.testnet`)
- `backend_public_key`: The Ed25519 public key for signature verification (from step above)

#### To Mainnet

```
npm run deploy:mainnet <account_id> [admin_account] [usdc_token_contract] [backend_public_key]
```

- `account_id`: The account ID to deploy the contract to
- `admin_account`: (Optional) The account ID of the admin (defaults to the deployer)
- `usdc_token_contract`: (Optional) The account ID of the USDC token contract (defaults to the standard USDC contract on mainnet)
- `backend_public_key`: The Ed25519 public key for signature verification (from step above)

#### Using the Redeploy Script

The redeploy script provides a convenient way to redeploy your contract to either testnet or mainnet. It will handle deleting the existing contract (if any), creating a new one, deploying the code, and initializing it.

```
npm run redeploy <network> <account_id> [admin_account] [usdc_token_contract] [beneficiary_account] [backend_public_key]
```

- `network`: Network to deploy to ("testnet" or "mainnet")
- `account_id`: The account ID to deploy the contract to
- `admin_account`: (Optional) The account ID of the admin (defaults to account_id)
- `usdc_token_contract`: (Optional) The USDC token contract (defaults based on network)
  - Testnet default: usdc.fakes.testnet
  - Mainnet default: a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near
- `beneficiary_account`: The account that will receive funds when deleting the contract
- `backend_public_key`: (Optional) The Ed25519 public key for signature verification (defaults to BACKEND_PUBLIC_KEY from .env)

Example:
```bash
# Testnet deployment
npm run redeploy testnet aigaming.testnet aigaming.testnet usdc.fakes.testnet aigaming.testnet ed25519:public-address

# Mainnet deployment
npm run redeploy mainnet aigaming.near aigaming.near usdc.near aigaming.near ed25519:public-address
```

Note: For mainnet deployments, the script will prompt for confirmation before proceeding.

### Interacting with the Contract

#### General Interaction

```
npm run interact [network] [contract_id] [method] [args_json]
```

- `network`: "testnet" or "mainnet" (default: testnet)
- `contract_id`: The account ID of the contract
- `method`: The method to call on the contract
- `args_json`: JSON string of arguments to pass to the method (default: {})

#### Admin Operations

```
npm run admin [network] [contract_id]
```

- `network`: "testnet" or "mainnet" (default: testnet)
- `contract_id`: The account ID of the contract

This will present a menu of admin operations to choose from.

#### Monitoring Events

```
npm run monitor [network] [contract_id] [block_height] [num_blocks]
```

- `network`: "testnet" or "mainnet" (default: testnet)
- `contract_id`: The account ID of the contract
- `block_height`: Block height to start from (default: latest)
- `num_blocks`: Number of blocks to scan (default: 100)

## Contract Methods

### User Methods

- `depositNear()` - Deposit NEAR tokens (payable)
- `withdrawNear({ amount })` - Withdraw NEAR tokens
- `depositUsdc({ amount })` - Deposit USDC tokens
- `withdrawUsdc({ amount })` - Withdraw USDC tokens
- `getNearBalance({ account_id })` - Get NEAR balance
- `getUsdcBalance({ account_id })` - Get USDC balance
- `isNearLocked({ account_id })` - Check if NEAR balance is locked
- `isUsdcLocked({ account_id })` - Check if USDC balance is locked

### Admin Methods

- `lockNearBalance({ account_id })` - Lock a user's NEAR balance
- `unlockNearBalance({ account_id, new_balance })` - Unlock a user's NEAR balance and optionally adjust it
- `lockUsdcBalance({ account_id })` - Lock a user's USDC balance
- `unlockUsdcBalance({ account_id, new_balance, message, signature })` - Unlock a user's USDC balance with signature verification
- `changeAdmin({ new_admin })` - Change the admin account
- `getAdmin()` - Get the current admin account

## Events

The contract emits the following events:

- `CONTRACT_INITIALIZED` - Contract initialization
- `NEAR_DEPOSIT` - NEAR token deposit
- `NEAR_WITHDRAWAL` - NEAR token withdrawal
- `USDC_DEPOSIT` - USDC token deposit
- `USDC_WITHDRAWAL` - USDC token withdrawal
- `NEAR_BALANCE_LOCKED` - NEAR balance locked
- `NEAR_BALANCE_UNLOCKED` - NEAR balance unlocked
- `USDC_BALANCE_LOCKED` - USDC balance locked
- `USDC_BALANCE_UNLOCKED` - USDC balance unlocked
- `ADMIN_CHANGED` - Admin account changed

## License

MIT