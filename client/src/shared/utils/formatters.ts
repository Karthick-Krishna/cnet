/**
 * Financial Formatting Utilities for HSBC Cnet Corporate Banking
 */

export function formatINR(amount: number, hide = false): string {
  if (hide) return '••••••••';
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount);

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export function formatInrCrores(amount: number, hide = false): string {
  if (hide) return '•••• Cr';
  if (amount === undefined || amount === null || isNaN(amount)) return '0.0000 Cr';
  const cr = amount / 10000000;
  return `${Number(cr.toFixed(4))} Cr`;
}

export function formatFinancialCurrency(amount: number, currency: string = 'GBP', hide = false): string {
  if (hide) return '••••••••';
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  if (currency === 'INR') {
    return formatINR(amount, hide);
  }

  const symbolMap: Record<string, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
    JPY: '¥',
    SGD: 'S$',
    AED: 'AED ',
    CHF: 'CHF ',
  };

  const symbol = symbolMap[currency] ?? `${currency} `;
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(Math.abs(amount));

  return `${amount < 0 ? '-' : ''}${symbol}${formatted}`;
}

export function maskAccountNumber(accNum: string): string {
  if (!accNum) return '•••• •••• 0000';
  const clean = accNum.replace(/\s+/g, '');
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

export function maskCardNumber(cardNum: string): string {
  if (!cardNum) return '•••• •••• •••• 0000';
  const clean = cardNum.replace(/\s+/g, '');
  const last4 = clean.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export function formatDateTime(dateInput: string | Date | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

export function formatDateShort(dateInput: string | Date | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateInput);
  }
}
