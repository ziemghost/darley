const priceFormatters = new Map<number, Intl.NumberFormat>();
const sizeFormatters = new Map<number, Intl.NumberFormat>();

function getFormatter(
  cache: Map<number, Intl.NumberFormat>,
  decimals: number,
): Intl.NumberFormat {
  let fmt = cache.get(decimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    cache.set(decimals, fmt);
  }
  return fmt;
}

export function formatPrice(price: number, decimals = 2): string {
  return getFormatter(priceFormatters, decimals).format(price);
}

export function formatSize(size: number, decimals = 5): string {
  return getFormatter(sizeFormatters, decimals).format(size);
}

export function inferPriceDecimals(priceStr: string): number {
  const dot = priceStr.indexOf('.');
  if (dot === -1) return 0;
  const trimmed = priceStr.replace(/0+$/, '').replace(/\.$/, '');
  const newDot = trimmed.indexOf('.');
  if (newDot === -1) return 0;
  return Math.min(trimmed.length - newDot - 1, 4);
}
