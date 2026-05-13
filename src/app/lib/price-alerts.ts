const DEFAULT_SHARP_PRICE_CHANGE_PERCENT = 10;

export function getSharpPriceChangeThresholdPercent() {
  const raw = process.env.PRICE_ALERT_THRESHOLD_PERCENT;
  const parsed = raw ? Number(raw) : DEFAULT_SHARP_PRICE_CHANGE_PERCENT;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SHARP_PRICE_CHANGE_PERCENT;
  }
  return parsed;
}

export function calculateChangePercent(previousPrice: number, currentPrice: number) {
  if (!Number.isFinite(previousPrice) || previousPrice <= 0) return null;
  if (!Number.isFinite(currentPrice)) return null;
  return ((currentPrice - previousPrice) / previousPrice) * 100;
}
