# AI Gambling Club Contract Testing

This directory contains automated tests for the AI Gambling Club NEAR contract. These tests use direct RPC calls instead of relying on the NEAR CLI, making them suitable for use in automated systems and backend integration.

## Prerequisites

- Node.js (v14 or later)
- NEAR account with testnet funds
- Access to the NEAR private key

## Setting Up

1. Copy the `.env.example` file to `.env` in the root directory:
   ```
   cp ../.env.example ../.env
   ```

2. Edit the `.env` file with your NEAR account information:
   ```
   NEAR_ACCOUNT_ID=your-testnet-account.testnet
   NEAR_PRIVATE_KEY=ed25519:your-private-key
   ```

   The private key can be found in one of these locations:
   - `~/.near-credentials/testnet/your-account.json` if you've used NEAR CLI
   - Exported from your NEAR wallet

3. Install dependencies:
   ```
   npm install
   ```

4. Build the contract:
   ```
   npm run build
   ```

## Running Tests

Run tests with:

```
npm test
```

This will:
1. Connect to NEAR using your private key
2. Deploy the contract to your account
3. Validate the user and admin functions

### Creating Test Accounts (Testnet)

To create a new test account on NEAR testnet, you can use one of these methods:

1. Using NEAR CLI with faucet (Recommended for testing):
   ```bash
   near create-account YOUR_ACCOUNT.testnet --useFaucet
   ```
   This will:
   - Create a new account
   - Fund it with initial NEAR from the faucet
   - Store credentials in ~/.near-credentials/testnet/

2. Using an existing account as master account:
   ```bash
   near create-account YOUR_ACCOUNT.testnet --masterAccount YOUR_MASTER_ACCOUNT.testnet --initialBalance 5
   ```
   This requires your master account to have sufficient balance.

The credentials will be stored in `~/.near-credentials/testnet/YOUR_ACCOUNT.testnet.json` in this format:
```json
{
  "account_id": "YOUR_ACCOUNT.testnet",
  "public_key": "ed25519:...",
  "private_key": "ed25519:..."
}
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