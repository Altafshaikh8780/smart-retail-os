/**
 * Global validation utilities for Smart Retail OS.
 * All functions must be production-grade and consistent across the system.
 */

/**
 * Validates a phone number.
 * Rule: Exactly 10 digits, numeric only.
 * @param phone The phone string to validate.
 * @returns true if valid, false otherwise.
 */
export function validatePhone(phone: string): boolean {
  return /^[0-9]{10}$/.test(phone);
}

/**
 * Formats a number into a consistent currency string based on store settings.
 * Ensures 2 decimal places and proper locale-specific separators.
 * @param amount The numeric amount to format.
 * @param currencyCode The currency symbol/code (e.g., 'INR', 'USD', '₹').
 */
export function formatCurrency(amount: number, currencySymbol: string = '₹'): string {
  // Map common symbols to ISO codes for Intl.NumberFormat if possible, 
  // though we'll primarily use the symbol as a prefix for simplicity if not a standard code.
  const locale = currencySymbol === '₹' ? 'en-IN' : 'en-US';
  const currency = currencySymbol === '₹' ? 'INR' : currencySymbol === '$' ? 'USD' : 'USD';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for non-standard symbols
    return `${currencySymbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
