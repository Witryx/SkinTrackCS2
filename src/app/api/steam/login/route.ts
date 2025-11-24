import { NextResponse } from "next/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const openidEndpoint = "https://steamcommunity.com/openid/login";

export async function GET() {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${siteUrl}/api/steam/return`,
    "openid.realm": siteUrl,
    "openid.identity":
      "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id":
      "http://specs.openid.net/auth/2.0/identifier_select",
  });

  const redirectUrl = `${openidEndpoint}?${params.toString()}`;
  return NextResponse.redirect(redirectUrl);
}
