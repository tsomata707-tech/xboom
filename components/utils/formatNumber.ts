
export const formatNumber = (num: number | string): string => {
  const n = Number(num);
  if (num === null || num === undefined || isNaN(n)) return '0';

  const absNum = Math.abs(n);

  // Trillions
  if (absNum >= 1_000_000_000_000) {
    return (n / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '') + 'T';
  }
  // Billions
  if (absNum >= 1_000_000_000) {
    return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  // Millions
  if (absNum >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  // Thousands
  if (absNum >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  
  // Small numbers: show up to 2 decimal places if needed, remove trailing zeros
  // e.g. 10.00 -> 10, 10.50 -> 10.5, 10.55 -> 10.55
  return Number(n.toFixed(2)).toString();
};
