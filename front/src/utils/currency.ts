export const USDC_DECIMALS = 6;  // Standard USDC decimals on NEAR
export const DISPLAY_DECIMALS = 2;  // Number of decimals to show to users

export function formatUSDCtoDisplay(atomicValue: number): string {
  const value = atomicValue / Math.pow(10, USDC_DECIMALS);
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: DISPLAY_DECIMALS,
    maximumFractionDigits: DISPLAY_DECIMALS
  });
}

export function parseInputToAtomic(inputValue: string): number {
  // Remove any non-numeric characters except decimal point
  const cleanValue = inputValue.replace(/[^\d.]/g, '');
  
  // Convert to number and multiply to get atomic format
  const value = parseFloat(cleanValue) || 0;
  return Math.round(value * Math.pow(10, USDC_DECIMALS));
}

// Helper function to validate input values
export function isValidUSDCInput(value: string): boolean {
  if (value === '') return true;  // Allow empty field
  
  const number = parseFloat(value);
  return !isNaN(number) && number >= 0;  // Validate if it's a non-negative number
}

// Convert atomic value to decimal for display without currency symbol
export function atomicToDecimal(atomicValue: number): string {
  const value = atomicValue / Math.pow(10, USDC_DECIMALS);
  return value.toFixed(DISPLAY_DECIMALS);
} 