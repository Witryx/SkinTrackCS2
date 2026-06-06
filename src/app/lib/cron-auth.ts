export function isCronAuthorized(headersList: Headers) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const headerSecret = headersList.get("x-cron-secret");
  if (headerSecret === secret) return true;

  const authorization = headersList.get("authorization") ?? "";
  return authorization === secret || authorization === `Bearer ${secret}`;
}
