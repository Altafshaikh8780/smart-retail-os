export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

export const sanitizePrice = (price: string | number): number => {
  return Number(String(price).replace(/[^\d.]/g, ""));
};
