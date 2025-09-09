// Money utility functions used across the app

export const parseMoney = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

export const moneyToCents = (v) => Math.round(parseMoney(v) * 100);

export const centsToStr = (c) => (Number(c || 0) / 100).toFixed(2);

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
