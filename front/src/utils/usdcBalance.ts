/**
 * USDC Balance Conversion Utilities
 * 
 * This module provides utility functions for converting USDC balances between 
 * contract format (smallest units) and human-readable format (decimal USDC).
 * Follows the standard 6-decimal precision for USDC and other stablecoins.
 * 
 * @module usdcBalance
 */

/**
 * Standard decimal places for USDC and most stablecoins
 * @constant {number}
 */
const USDC_DECIMALS = 6;

/**
 * Multiplier for USDC decimal conversion (10^6 = 1,000,000)
 * @constant {number}
 */
const USDC_MULTIPLIER = Math.pow(10, USDC_DECIMALS);

/**
 * Converts raw USDC balance from contract to human-readable decimal format
 * 
 * Transforms the smallest unit balance (micro-USDC) returned from smart contracts
 * into the standard decimal format that users expect to see.
 * 
 * @param {string | number} rawBalance - Raw balance from contract (in smallest units)
 * @returns {string} Human-readable USDC balance with 2 decimal places
 * 
 * @example
 * // Contract returns 1000000 (1 USDC in micro-USDC)
 * formatUsdcBalance(1000000) // "1.00"
 * 
 * @example
 * // Contract returns 1500000 (1.5 USDC in micro-USDC)
 * formatUsdcBalance("1500000") // "1.50"
 * 
 * @example
 * // Handle zero balance
 * formatUsdcBalance(0) // "0.00"
 */
export function formatUsdcBalance(rawBalance: string | number): string {
  try {
    const balance = typeof rawBalance === 'string' ? parseFloat(rawBalance) : rawBalance;
    
    // Handle invalid or zero balances
    if (isNaN(balance) || balance < 0) {
      return "0.00";
    }
    
    // Convert from smallest units to USDC
    const usdcAmount = balance / USDC_MULTIPLIER;
    
    // Format to 2 decimal places for display
    return usdcAmount.toFixed(2);
  } catch (error) {
    console.error('Error formatting USDC balance:', error);
    return "0.00";
  }
}

/**
 * Converts human-readable USDC amount to contract format (smallest units)
 * 
 * Transforms user-entered USDC amounts into the format expected by smart contracts.
 * Useful for transaction preparation and contract method calls.
 * 
 * @param {string | number} usdcAmount - USDC amount in decimal format
 * @returns {string} Balance in smallest units (micro-USDC) as string
 * 
 * @example
 * // User wants to send 1.5 USDC
 * toContractBalance(1.5) // "1500000"
 * 
 * @example
 * // User enters "10.25" USDC
 * toContractBalance("10.25") // "10250000"
 * 
 * @example
 * // Handle edge cases
 * toContractBalance(0) // "0"
 */
export function toContractBalance(usdcAmount: string | number): string {
  try {
    const amount = typeof usdcAmount === 'string' ? parseFloat(usdcAmount) : usdcAmount;
    
    // Handle invalid amounts
    if (isNaN(amount) || amount < 0) {
      return "0";
    }
    
    // Convert to smallest units and ensure integer
    const contractBalance = Math.floor(amount * USDC_MULTIPLIER);
    
    return contractBalance.toString();
  } catch (error) {
    console.error('Error converting to contract balance:', error);
    return "0";
  }
}

/**
 * Formats USDC balance with currency symbol and proper formatting
 * 
 * Provides a user-friendly display format with currency symbol and
 * appropriate number formatting for different balance ranges.
 * 
 * @param {string | number} rawBalance - Raw balance from contract
 * @param {boolean} showSymbol - Whether to include USDC symbol (default: true)
 * @returns {string} Formatted balance with optional currency symbol
 * 
 * @example
 * // Standard formatting with symbol
 * formatUsdcDisplay(1500000) // "$1.50 USDC"
 * 
 * @example
 * // Without symbol
 * formatUsdcDisplay(1500000, false) // "$1.50"
 * 
 * @example
 * // Large amounts with proper formatting
 * formatUsdcDisplay(1000000000) // "$1,000.00 USDC"
 */
export function formatUsdcDisplay(rawBalance: string | number, showSymbol: boolean = true): string {
  try {
    const formattedBalance = formatUsdcBalance(rawBalance);
    const numericBalance = parseFloat(formattedBalance);
    
    // Format with thousands separators for large amounts
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericBalance);
    
    return showSymbol ? `${formatted} USDC` : formatted;
  } catch (error) {
    console.error('Error formatting USDC display:', error);
    return showSymbol ? "$0.00 USDC" : "$0.00";
  }
}

/**
 * Validates if a USDC amount string is valid for contract operations
 * 
 * Checks if the provided amount is a valid number that can be safely
 * converted to contract format without precision loss.
 * 
 * @param {string} amount - USDC amount to validate
 * @returns {boolean} True if amount is valid for contract operations
 * 
 * @example
 * isValidUsdcAmount("1.50") // true
 * isValidUsdcAmount("1.123456") // true (6 decimals max)
 * isValidUsdcAmount("1.1234567") // false (too many decimals)
 * isValidUsdcAmount("abc") // false
 * isValidUsdcAmount("-1") // false
 */
export function isValidUsdcAmount(amount: string): boolean {
  try {
    const numAmount = parseFloat(amount);
    
    // Check if it's a valid positive number
    if (isNaN(numAmount) || numAmount < 0) {
      return false;
    }
    
    // Check decimal places (shouldn't exceed USDC_DECIMALS)
    const decimalPart = amount.split('.')[1];
    if (decimalPart && decimalPart.length > USDC_DECIMALS) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the raw balance as a number for calculations
 * 
 * Safely converts raw balance to number format for mathematical operations.
 * Returns 0 for invalid inputs to prevent calculation errors.
 * 
 * @param {string | number} rawBalance - Raw balance from contract
 * @returns {number} Numeric value of the raw balance
 * 
 * @example
 * getRawBalanceAsNumber("1500000") // 1500000
 * getRawBalanceAsNumber(1500000) // 1500000
 * getRawBalanceAsNumber("invalid") // 0
 */
export function getRawBalanceAsNumber(rawBalance: string | number): number {
  try {
    const balance = typeof rawBalance === 'string' ? parseFloat(rawBalance) : rawBalance;
    return isNaN(balance) || balance < 0 ? 0 : balance;
  } catch (error) {
    console.error('Error converting raw balance to number:', error);
    return 0;
  }
} 