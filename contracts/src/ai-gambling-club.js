import { NearBindgen, call, view, initialize, near, LookupMap, encode, decode } from "near-sdk-js";

/**
 * AI Gambling Club Contract
 * 
 * A contract that allows users to deposit their USDC tokens and use them to bet
 * on the platform at https://aigambling.club
 * Emits events for all operations.
 */
@NearBindgen({ requireInit: true })
export class AIGamblingClub {
  constructor() {
    // Maps to store user balances
    this.usdcBalances = new LookupMap("usdc_balances");

    // Maps to store locked status and amounts
    this.usdcLocked = new LookupMap("usdc_locked");
  
    // Maps to track pending withdrawals
    this.usdcWithdrawalsPending = new LookupMap("usdc_withdrawals_pending");

    // Maps to track nonces
    this.nonces = new LookupMap("nonces");
    
    // Admin account
    this.adminAccount = "";
    
    // USDC token contract address
    this.usdcTokenContract = "";

    // Backend Ethereum address for signature verification
    this.backendPublicKey = "";
  }

  /**
   * Initialize the contract
   * @param admin_account - The account ID of the admin
   * @param usdc_token_contract - The account ID of the USDC token contract
   * @param backend_public_key - The Ethereum address of the backend signer (hex string)
   */
  @initialize({})
  init({ admin_account, usdc_token_contract, backend_public_key }) {
    this.adminAccount = admin_account;
    this.usdcTokenContract = usdc_token_contract;
    this.backendPublicKey = backend_public_key;
    
    // Log initialization event
    this._emitEvent("CONTRACT_INITIALIZED", {
      admin_account,
      usdc_token_contract,
      backend_public_key,
      timestamp: this._getCurrentTimestamp()
    });
  }

  /**
   * Deposit - Handle USDC token transfers into the contract
   * @param sender_id - The account that initiated the transfer
   * @param amount - The amount of USDC tokens being transferred
   * @param msg - Optional message attached to the transfer
   * @returns The amount of tokens to return to sender ("0" to accept all)
   */
  @call({})
  ft_on_transfer({ sender_id, amount, msg }) {
    // Verify the caller is the USDC contract
    if (near.predecessorAccountId() !== this.usdcTokenContract) {
      throw new Error("Only accept transfers from USDC contract");
    }
    
    // Check if account is locked
    if (this._isUsdcLocked(sender_id)) {
      // Return all tokens if account is locked
      return amount;
    }
    
    // Update balance
    const currentBalance = BigInt(this._getUsdcBalance(sender_id));
    const newBalance = currentBalance + BigInt(amount);
    this.usdcBalances.set(sender_id, newBalance.toString());
    
    // Emit deposit event
    this._emitEvent("USDC_DEPOSIT", {
      account_id: sender_id,
      amount,
      new_balance: newBalance.toString(),
      timestamp: this._getCurrentTimestamp()
    });
    
    // Return "0" to accept the entire transfer
    return "0";
  }

  /**
   * Withdraw - Handle USDC token transfers from the contract
   * @param amount - The amount of USDC tokens to withdraw
   */
  @call({})
  withdrawUsdc({ amount }) {
    const accountId = near.predecessorAccountId();
    
    // Check if account is locked
    if (this._isUsdcLocked(accountId)) {
      throw new Error("Account is locked");
    }

    // Check if withdrawal is already pending
    if (this._isWithdrawalPending(accountId)) {
      throw new Error("Previous withdrawal still pending");
    }
    
    // Check if balance is sufficient
    const currentBalance = BigInt(this._getUsdcBalance(accountId));
    if (currentBalance < BigInt(amount)) {
      throw new Error("Insufficient balance");
    }

    // Mark withdrawal as pending and reserve the amount
    this.usdcWithdrawalsPending.set(accountId, "1");
    
    // Create promise for USDC transfer
    const promise = near.promiseBatchCreate(this.usdcTokenContract);
    const transferArgs = JSON.stringify({
      receiver_id: accountId,
      amount: amount,
      memo: "Withdrawal from AI Gambling Club"
    });
    
    // Call ft_transfer on USDC contract
    near.promiseBatchActionFunctionCall(
      promise,
      "ft_transfer",
      transferArgs,
      BigInt("1"), // Attached deposit for gas
      BigInt("30000000000000") // Gas
    );

    // Create a callback to handle the transfer result
    const callbackArgs = JSON.stringify({
      account_id: accountId,
      amount: amount,
      previous_balance: currentBalance.toString()
    });
    
    // Chain the callback to execute after the transfer
    near.promiseThen(
      promise,
      near.currentAccountId(),
      "_after_usdc_withdrawal",
      callbackArgs,
      BigInt("0"),
      BigInt("30000000000000")
    );
    
    return "Withdrawal pending";
  }

  /**
   * Internal callback after USDC withdrawal
   * @private
   */
  @call({private: true})
  _after_usdc_withdrawal({ account_id, amount, previous_balance }) {
    let transferSuccessful = false;
    
    try {
      // Check if the transfer was successful
      const result = near.promiseResult(0);
      transferSuccessful = result !== null;
    } catch (error) {
      // Promise failed
      transferSuccessful = false;
    }

    if (transferSuccessful) {
      // Update balance only after successful transfer
      const newBalance = BigInt(previous_balance) - BigInt(amount);
      this.usdcBalances.set(account_id, newBalance.toString());
      
      // Emit withdrawal event
      this._emitEvent("USDC_WITHDRAWAL", {
        account_id,
        amount,
        new_balance: newBalance.toString(),
        timestamp: this._getCurrentTimestamp(),
      });
    }

    // Clear pending status regardless of outcome
    this.usdcWithdrawalsPending.set(account_id, "0");

    return transferSuccessful ? "Withdrawal successful" : "Withdrawal failed";
  }

  /**
   * Lock the caller's USDC balance for gambling
   */
  @call({})
  lockUsdcBalance() { 
    const account_id = near.predecessorAccountId();

    // Check if withdrawal is pending
    if (this._isWithdrawalPending(account_id)) {
      throw new Error("Cannot lock account with pending withdrawal");
    }

    // Set lock status
    this.usdcLocked.set(account_id, "1");
    
    // Emit lock event
    this._emitEvent("USDC_BALANCE_LOCKED", {
      account_id,
      amount: this._getUsdcBalance(account_id),
      timestamp: this._getCurrentTimestamp()
    });
    
    return true;
  }

  /**
   * Unlock a user's USDC balance and apply game result
   * @param message - The original message containing game result data
   * @param signature - The ECDSA signature of the message from the backend
   */
  @call({})
  unlockUsdcBalance({ message, signature }) {    
    // First verify the signature using the internal function
    // Use the stored Ethereum address for verification
    const recoveredAddress = this._verifyMessageSignature(message, signature, this.backendPublicKey);

    if (recoveredAddress !== this.backendPublicKey.toLowerCase()) {
      throw new Error(`Signature verification failed. Expected: ${this.backendPublicKey.toLowerCase()}, Got: ${recoveredAddress}`);
    }

    // Only parse and validate message content after signature is verified
    const gameResult = JSON.parse(message);

    // Check if nonce is valid
    const currentNonce = this._getNonce(gameResult.accountId);
    const providedNonce = parseInt(gameResult.nonce);
    if (providedNonce !== currentNonce) {
      throw new Error(`Nonce mismatch.`);
    }
    this.nonces.set(gameResult.accountId, (gameResult.nonce + 1).toString());
    
    // Check if deadline has passed
    const currentTimestamp = this._getCurrentTimestamp();
    if (currentTimestamp > gameResult.deadline) {
      throw new Error(`Unlock deadline has expired. Current: ${currentTimestamp}, Deadline: ${gameResult.deadline}`);
    }
    
    // Check if account is locked
    if (!this._isUsdcLocked(gameResult.accountId)) {
      throw new Error("Account is not locked");
    }
    
    // Convert amounts to BigInt for consistent comparison
    const amountChange = BigInt(gameResult.amount);

    // Get current balance and calculate new balance
    const currentBalance = BigInt(this._getUsdcBalance(gameResult.accountId));
    
    // For losses (negative gameResult.amount), verify we have enough balance
    if (amountChange < BigInt(0) && currentBalance < -amountChange) {
      throw new Error("Insufficient balance for loss deduction");
    }
    
    // Calculate and set new balance
    const finalBalance = currentBalance + amountChange;
    this.usdcBalances.set(gameResult.accountId, finalBalance.toString());
    
    // Remove lock status
    this.usdcLocked.set(gameResult.accountId, "0");
    
    // Emit unlock event with more descriptive data
    this._emitEvent("USDC_BALANCE_UNLOCKED", {
      account_id: gameResult.accountId,
      amount_change: gameResult.amount,
      is_win: amountChange > BigInt(0),
      final_balance: finalBalance.toString(),
      timestamp: this._getCurrentTimestamp()
    });
    
    return true;
  }

  /**
   * Change the admin account (admin only)
   * @param new_admin - The new admin account ID
   */
  @call({})
  changeAdmin({ new_admin }) {
    // Check if caller is admin
    this._assertAdmin();
    
    const oldAdmin = this.adminAccount;
    this.adminAccount = new_admin;
    
    // Emit admin change event
    this._emitEvent("ADMIN_CHANGED", {
      old_admin: oldAdmin,
      new_admin,
      timestamp: this._getCurrentTimestamp()
    });
    
    return true;
  }

  /**
   * Update the backend signer public key (admin only)
   * @param new_public_key - The new Ethereum address for the backend signer (hex string)
   */
  @call({})
  updateBackendSigner({ new_public_key }) {
    // Check if caller is admin
    this._assertAdmin();
    
    // Validate the Ethereum address format (must be hex string)
    if (!/^(0x)?[0-9a-fA-F]{40}$/.test(new_public_key)) {
      throw new Error("Invalid Ethereum address format - must be 40 character hex string");
    }
    
    this.backendPublicKey = new_public_key;
    
    return true;
  }

  /**
   * Clear pending withdrawal status (admin only - for emergency/testing)
   * @param account_id - The account ID to clear pending status for
   */
  @call({})
  clearPendingWithdrawal({ account_id }) {
    // Check if caller is admin
    this._assertAdmin();
    
    this.usdcWithdrawalsPending.set(account_id, "0");
    
    // Emit event
    this._emitEvent("PENDING_WITHDRAWAL_CLEARED", {
      account_id,
      admin: near.predecessorAccountId(),
      timestamp: this._getCurrentTimestamp()
    });
    
    return true;
  }

  /**
   * Get the current admin account
   * @returns The admin account ID
   */
  @view({})
  getAdmin() {
    return this.adminAccount;
  }

  /**
   * Get the USDC balance of an account
   * @param account_id - The account ID to check
   * @returns The USDC balance of the account
   */
  @view({})
  getUsdcBalance({ account_id }) {
    return this._getUsdcBalance(account_id);
  }

  /**
   * Get the nonce for an account
   * @param account_id - The account ID to check
   * @returns The nonce for the account as an integer
   */
  @view({})
  getNonce({ account_id }) {
    return this._getNonce(account_id);
  }

  /**
   * Check if an account's USDC balance is locked
   * @param account_id - The account ID to check
   * @returns Whether the account's USDC balance is locked
   */
  @view({})
  isUsdcLocked({ account_id }) {
    return this._isUsdcLocked(account_id);
  }

  /**
   * Internal method to emit an event
   * @param event_type - The type of event
   * @param data - The event data
   */
  _emitEvent(event_type, data) {
    near.log(`EVENT: ${JSON.stringify({
      standard: "ai-Gambling-club",
      version: "1.0.0",
      event: event_type,
      data
    })}`);
  }

  /**
   * Internal method to assert that the caller is the admin
   */
  _assertAdmin() {
    const caller = near.predecessorAccountId();
    const contractAccount = near.currentAccountId();
    
    // Allow both the set admin and the contract account itself to have admin privileges
    if (caller !== this.adminAccount && caller !== contractAccount) {
      throw new Error("Only the admin or contract owner can call this method");
    }
  }

  /**
   * Internal method to get the USDC balance of an account
   * @param accountId - The account ID to check
   * @returns The USDC balance of the account
   */
  _getUsdcBalance(accountId) {
    const balance = this.usdcBalances.get(accountId);
    return balance === null ? "0" : balance;
  }

  /**
   * Internal method to get the nonce for an account
   * @param accountId - The account ID to check
   * @returns The nonce for the account as an integer
   */
  _getNonce(accountId) {
    const nonce = this.nonces.get(accountId);
    return nonce === null ? 0 : parseInt(nonce);
  }

  /**
   * Internal method to get the current timestamp
   * @returns The current timestamp in nanoseconds
   */
  _getCurrentTimestamp() {
    return near.blockTimestamp().toString();
  }

  /**
   * Internal method to check if an account's USDC balance is locked
   * @param accountId - The account ID to check
   * @returns Whether the account's USDC balance is locked
   */
  _isUsdcLocked(accountId) {
    return this.usdcLocked.get(accountId) === "1";
  }

  /**
   * Check if a withdrawal is pending for an account
   * @private
   */
  _isWithdrawalPending(accountId) {
    return this.usdcWithdrawalsPending.get(accountId) === "1";
  }

  /**
   * Convert hex string to Uint8Array
   * @param hexString - The hex string to convert
   * @returns Uint8Array representation of the hex string
   */
  _hexStringToUint8Array(hexString) {
    if (typeof hexString !== 'string') {
      throw new TypeError('Expected a string argument.');
    }

    // Remove the "0x" prefix if it exists.
    const processedString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;

    // Check if the remaining string has an even length (each byte needs two hex chars).
    if (processedString.length % 2 !== 0) {
      throw new Error('Hex string must have an even number of characters after removing \'0x\'.');
    }

    // Create a Uint8Array with the appropriate length.
    const byteArray = new Uint8Array(processedString.length / 2);

    // Iterate through the string, taking two characters at a time.
    for (let i = 0; i < processedString.length; i += 2) {
      const byteString = processedString.substring(i, i + 2);
      const byteValue = parseInt(byteString, 16);

      // Check if parseInt resulted in a valid number (handles non-hex chars).
      if (isNaN(byteValue)) {
        throw new Error(`Invalid hexadecimal character found in string: "${byteString}"`);
      }

      byteArray[i / 2] = byteValue;
    }

    return byteArray;
  }

  /**
   * Verify the signature of a message using ECDSA and Ethereum standard
   * @param message - The message to verify
   * @param signature - The signature to verify
   * @returns True if the signature is valid, false otherwise
   */
  _verifyMessageSignature(message, signature) {
    // Parse the signature (r, s, v format)
    // signature should be 65 bytes: 32 bytes r + 32 bytes s + 1 byte v
    if (!signature || typeof signature !== 'string' || !signature.startsWith('0x')) {
      throw new Error("Invalid signature format. Expected hex string with '0x' prefix.");
    }
    const sigBytes = this._hexStringToUint8Array(signature);
    if (sigBytes.length !== 65) {
      throw new Error("Invalid signature length. Expected 65 bytes.");
    }
    
    // Extract r, s, v from signature
    const r = sigBytes.slice(0, 32);
    const s = sigBytes.slice(32, 64);
    let v = sigBytes[64];
    
    // Normalize V value for NEAR's ecrecover
    // Ethereum uses v = 27/28 for legacy transactions
    // or v = chainId * 2 + 35/36 for EIP-155 transactions
    // NEAR expects v = 0/1/2/3 (raw recovery ID)
    if (v >= 35) {
      // EIP-155 format: v = chainId * 2 + 35 + recovery_id
      // Extract recovery_id: (v - 35) % 2
      v = (v - 35) % 2;
    } else if (v >= 27) {
      // Legacy format: v = 27 + recovery_id
      v = v - 27;
    }
    // If v is already 0-3, use as-is
    
    if (v > 1) { // ecrecover in NEAR likely expects 0 or 1
      throw new Error(`Invalid recovery ID derived: ${sigBytes[64]} resulted in ${v}. Must be 0 or 1.`);
    }
    
    // Create message hash using keccak256 (Ethereum standard)
    const prefixString = "\x19Ethereum Signed Message:\n";
    const messageBytes = encode(message); // Encode message string to UTF-8 bytes
    const prefixBytes = encode(prefixString + messageBytes.length.toString()); // Encode prefix + length string
  
    // Concatenate prefix bytes and message bytes
    const prefixedMessageBytes = new Uint8Array(prefixBytes.length + messageBytes.length);
    prefixedMessageBytes.set(prefixBytes);
    prefixedMessageBytes.set(messageBytes, prefixBytes.length);
  
    // Hash the *prefixed* message using Keccak256
    const messageHash = near.keccak256(prefixedMessageBytes);

    // Recover the public key using ecrecover
    const recoveredPubKey = near.ecrecover(
      messageHash,          // hash: Uint8Array
      sigBytes.slice(0, 64), // sig: Uint8Array (r + s)
      v,                    // v: u8 (recovery ID 0 or 1)
      false                 // false returns 64-byte pubkey
    );
    
    if (!recoveredPubKey) {
      // If recovery fails, log details for debugging
      near.log(`ecrecover failed. Hash: ${JSON.stringify(messageHash)}, Sig(r+s): ${JSON.stringify(sigBytes.slice(0, 64))}, v: ${v}`);
      throw new Error("Failed to recover public key from signature. Signature might be invalid or message mismatch.");
    }
    
    // Address is the last 20 bytes of the Keccak256 hash of the public key.
    const pubKeyHash = near.keccak256(recoveredPubKey); // Hash the 64-byte public key
    const recoveredAddressBytes = pubKeyHash.slice(-20); // Take the last 20 bytes

    // Convert address bytes to hex string with "0x" prefix
    const recoveredAddressHex = Array.from(recoveredAddressBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return "0x" + recoveredAddressHex;
  }
}
