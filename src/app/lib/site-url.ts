const hasProtocol = (value: string) => /^https?:\/\//i.test(value);

const isLocalHost = (value: string) =>
  value.startsWith("localhost") || value.startsWith("127.0.0.1");

export function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const withProtocol = hasProtocol(raw)
    ? raw
    : `${isLocalHost(raw) ? "http" : "https"}://${raw}`;

  return withProtocol.replace(/\/+$/, "");
}
