// Money utility functions used across the app

export const parseMoney = (v) => {
  if (v === "" || v == null) return 0;
  // Remove all non-numeric characters except decimal point and minus sign
  const cleaned = String(v).replace(/[^0-9.-]/g, "");
  // Handle multiple decimal points by keeping only the first one
  const parts = cleaned.split('.');
  const normalized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
  const n = Number(normalized);
  
  // Debug logging for problematic values
  if (String(v) !== String(n) && Math.abs(n) > 1000) {
    console.warn(`parseMoney: "${v}" -> "${cleaned}" -> "${normalized}" -> ${n}`);
  }
  
  return isNaN(n) ? 0 : n;
};

export const moneyToCents = (v) => {
  const parsed = parseMoney(v);
  const cents = Math.round(parsed * 100);
  
  // Debug logging for large values
  if (cents > 100000) {
    console.warn(`moneyToCents: "${v}" -> ${parsed} -> ${cents} cents`);
  }
  
  return cents;
};

export const centsToStr = (c) => {
  const value = Number(c || 0) / 100;
  // Only add commas for numbers >= 1000
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return value.toFixed(2);
  }
};

export const parsePct = (v) => {
  if (v === "" || v == null) return 0;
  const n = Number(String(v).replace("%", ""));
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
};

export const formatNumber = (n) => {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString();
};
