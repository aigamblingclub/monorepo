import { NearBindgen, call, view, initialize, near, LookupMap } from "near-sdk-js";

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
    
    // Admin account
    this.adminAccount = "";
    
    // USDC token contract address
    this.usdcTokenContract = "";

    // Backend public key for signature verification
    this.backendPublicKey = "";
  }

  /**
   * Initialize the contract
   * @param admin_account - The account ID of the admin
   * @param usdc_token_contract - The account ID of the USDC token contract
   * @param backend_public_key - The Ed25519 public key of the backend (base64 encoded)
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
    const callbackPromise = near.promiseBatchCreate(near.currentAccountId());
    near.promiseBatchActionFunctionCall(
      callbackPromise,
      "_after_usdc_withdrawal",
      JSON.stringify({
        account_id: accountId,
        amount: amount,
        previous_balance: currentBalance.toString()
      }),
      BigInt("0"),
      BigInt("30000000000000")
    );

    // Wait for transfer to complete before calling callback
    near.promiseAnd([promise, callbackPromise]);
    
    return "Withdrawal pending";
  }

  /**
   * Internal callback after USDC withdrawal
   * @private
   */
  @call({private: true})
  _after_usdc_withdrawal({ account_id, amount, previous_balance }) {
    // Clear pending status regardless of outcome
    this.usdcWithdrawalsPending.set(account_id, "0");

    // Check if the transfer was successful
    if (!near.promiseResult(0)) {
      throw new Error("USDC transfer failed");
    }

    // Update balance only after successful transfer
    const newBalance = BigInt(previous_balance) - BigInt(amount);
    this.usdcBalances.set(account_id, newBalance.toString());
    
    // Emit withdrawal event
    this._emitEvent("USDC_WITHDRAWAL", {
      account_id,
      amount,
      new_balance: newBalance.toString(),
      timestamp: this._getCurrentTimestamp()
    });
    
    return newBalance.toString();
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
   * @param account_id - The account ID to unlock
   * @param amount_change - The amount to change (negative for loss, positive for win)
   * @param message - The original message containing game result data
   * @param signature - The Ed25519 signature of the message from the backend
   */
  @call({})
  unlockUsdcBalance({ account_id, amount_change, message, signature }) {    
    // First verify the signature using NEAR's built-in ed25519 verification
    const isValid = near.signerAccountPk.verify(
      Buffer.from(message),
      Buffer.from(signature, 'base64'),
      Buffer.from(this.backendPublicKey, 'base64')  // Use the stored backend public key
    );
    
    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Only parse and validate message content after signature is verified
    const gameResult = JSON.parse(message);
    if (gameResult.accountId !== account_id) {
      throw new Error("Account ID mismatch in game result");
    }
    
    // Check if account is locked
    if (!this._isUsdcLocked(account_id)) {
      throw new Error("Account is not locked");
    }
    
    // Convert amounts to BigInt for consistent comparison
    const amountChange = BigInt(amount_change);
    const signedAmount = BigInt(gameResult.amount);

    // Verify the amount change matches what's in the signed message
    if (amountChange !== signedAmount) {
      throw new Error("Amount mismatch with signed message");
    }

    // Get current balance and calculate new balance
    const currentBalance = BigInt(this._getUsdcBalance(account_id));
    
    // For losses (negative amount_change), verify we have enough balance
    if (amountChange < BigInt(0) && currentBalance < -amountChange) {
      throw new Error("Insufficient balance for loss deduction");
    }
    
    // Calculate and set new balance
    const finalBalance = currentBalance + amountChange;
    this.usdcBalances.set(account_id, finalBalance.toString());
    
    // Remove lock status
    this.usdcLocked.set(account_id, "0");
    
    // Emit unlock event with more descriptive data
    this._emitEvent("USDC_BALANCE_UNLOCKED", {
      account_id,
      admin: near.predecessorAccountId(),
      amount_change,
      is_win: amountChange > BigInt(0),
      final_balance: finalBalance.toString(),
      game_id: gameResult.gameId,
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
   * Get the USDC balance of an account
   * @param account_id - The account ID to check
   * @returns The USDC balance of the account
   */
  @view({})
  getUsdcBalance({ account_id }) {
    return this._getUsdcBalance(account_id);
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
   * Check if an account's USDC balance is locked
   * @param account_id - The account ID to check
   * @returns Whether the account's USDC balance is locked
   */
  @view({})
  isUsdcLocked({ account_id }) {
    return this._isUsdcLocked(account_id);
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
   * Internal method to get the USDC balance of an account
   * @param accountId - The account ID to check
   * @returns The USDC balance of the account
   */
  _getUsdcBalance(accountId) {
    const balance = this.usdcBalances.get(accountId);
    return balance === null ? "0" : balance;
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
}
