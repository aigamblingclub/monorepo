# Environment Setup for Contract Integration

## Required Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL=your-postgresql-connection-string

# NEAR Configuration
NEAR_NODE_URL=https://rpc.testnet.near.org
AGC_CONTRACT_ID=your-agc-contract.testnet

# Backend Signing Configuration
BACKEND_PRIVATE_KEY=your-ethereum-private-key-here
```

## Environment Variable Descriptions

- **NEAR_NODE_URL**: NEAR RPC endpoint (defaults to testnet if not set)
- **AGC_CONTRACT_ID**: The deployed AI Gambling Club contract ID on NEAR
- **BACKEND_PRIVATE_KEY**: Ethereum private key for signing withdrawal messages

## Contract Integration Features

The contract route now includes:

1. **Real-time on-chain data**: Gets user nonce and balance from NEAR contract
2. **Database synchronization**: Automatically syncs DB when on-chain nonce is higher
3. **Complete validation**: Checks game status, balance, and nonce before signing
4. **Ethereum-compatible signatures**: Uses ethers.js for message signing

## Usage Example

```bash
POST /api/contract/sign-message
Headers: { "x-api-key": "your-api-key" }
Body: {
  "nearImplicitAddress": "user.testnet",
  "withdrawAmount": 1000000
}
```

The system will:
1. Query the NEAR contract for current nonce and balance
2. Sync database if needed
3. Validate withdrawal eligibility
4. Sign the withdrawal message
5. Return signature for use with the NEAR contract 