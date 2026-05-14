export function calculateChangePercent(previousPrice: number, currentPrice: number) {
  if (!Number.isFinite(previousPrice) || previousPrice <= 0) return null;
  if (!Number.isFinite(currentPrice)) return null;
  return ((currentPrice - previousPrice) / previousPrice) * 100;
}
