export function getSkinImageUrl(marketHashName: string) {
  const safeName = marketHashName.trim();
  return `https://api.steamapis.com/image/item/730/${encodeURIComponent(safeName)}`;
}

export function getSkinDetailPath(marketHashName: string) {
  const safeName = marketHashName.trim();
  return `/explorer/${encodeURIComponent(safeName)}`;
}
