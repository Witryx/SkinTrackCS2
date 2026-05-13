type RatesCache = {
  fetchedAt: number;
  rates: Record<string, number>;
};

const ECB_RATES_URL =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

let cache: RatesCache | null = null;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const parseRates = (xml: string) => {
  const rates: Record<string, number> = { EUR: 1 };
  const regex = /currency='([A-Z]{3})'\s+rate='([\d.]+)'/g;

  for (const match of xml.matchAll(regex)) {
    const currency = match[1];
    const rate = Number(match[2]);
    if (!currency || !Number.isFinite(rate) || rate <= 0) continue;
    rates[currency] = rate;
  }

  return rates;
};

export async function getExchangeRates() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  const response = await fetch(ECB_RATES_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`ECB rates fetch failed with status ${response.status}`);
  }

  const xml = await response.text();
  const rates = parseRates(xml);
  cache = { fetchedAt: now, rates };
  return rates;
}

export async function convertCurrency(
  amount: number | null,
  fromCurrency: string,
  toCurrency = "EUR"
) {
  if (amount === null || !Number.isFinite(amount)) return null;

  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) return null;
  if (from === to) return roundMoney(amount);

  const rates = await getExchangeRates();
  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) return null;

  const valueInEur = from === "EUR" ? amount : amount / fromRate;
  const converted = to === "EUR" ? valueInEur : valueInEur * toRate;
  return roundMoney(converted);
}
