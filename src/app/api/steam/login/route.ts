import { NextResponse } from "next/server";
import { getSiteUrl } from "@/app/lib/site-url";

const openidEndpoint = "https://steamcommunity.com/openid/login";

export async function GET() {
  const siteUrl = getSiteUrl();
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
