type HeaderReader = {
  get(name: string): string | null;
};

export function isCronAuthorized(headersList: HeaderReader) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";

  const raw =
    headersList.get("x-cron-secret") || headersList.get("authorization") || "";
  const provided = raw.replace(/^Bearer\s+/i, "").trim();

  return provided === secret;
}
