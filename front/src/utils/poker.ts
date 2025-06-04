// Format poker chips with no decimal places and thousands separator
export function formatChips(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

// Calculate percentage with specified decimal places
export function calculatePercentage(part: number, total: number, decimals: number = 1): string {
  if (total === 0) return '0';
  return ((part / total) * 100).toFixed(decimals);
} 