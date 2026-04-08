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

export function formatCurrency(amount: number, currencySymbol: string = '₹'): string {
  // If the currency is INR/₹, use standard Indian formatting
  if (currencySymbol === '₹' || currencySymbol === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Otherwise, use the provided symbol and standard number formatting
  return `${currencySymbol}${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}


export const sanitizePrice = (price: string | number): number => {
  return Number(String(price).replace(/[^\d.]/g, ""));
};
