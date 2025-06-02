import { ethers } from 'ethers';

/**
 * Generate a new Ethereum private key and its corresponding public key
 */
function generateEthereumPrivateKey() {
  const randomBytes32 = ethers.hexlify(ethers.randomBytes(32));
  console.log('Generated Ethereum private key:', randomBytes32); // 0x prefixed hex string
  console.log(
    'Generated Ethereum public key:',
    new ethers.Wallet(randomBytes32).address
  );
}

generateEthereumPrivateKey();
