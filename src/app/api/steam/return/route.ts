import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getSteamUser } from "../../../lib/getSteamUser";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const openidEndpoint = "https://steamcommunity.com/openid/login";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;

  const mode = url.searchParams.get("openid.mode");
  if (mode !== "id_res") {
    const failUrl = new URL("/", siteUrl);
    failUrl.searchParams.set("steamError", "bad_mode");
    return NextResponse.redirect(failUrl.toString());
  }

  const verifyParams = new URLSearchParams();

  url.searchParams.forEach((value, key) => {
    if (key.startsWith("openid.")) {
      if (key === "openid.mode") {
        verifyParams.append("openid.mode", "check_authentication");
      } else {
        verifyParams.append(key, value);
      }
    }
  });

  if (!verifyParams.get("openid.ns")) {
    verifyParams.append("openid.ns", "http://specs.openid.net/auth/2.0");
  }

  try {
    const res = await fetch(openidEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: verifyParams.toString(),
    });

    const text = await res.text();
    const valid = text.includes("is_valid:true");

    if (!valid) {
      const failUrl = new URL("/", siteUrl);
      failUrl.searchParams.set("steamError", "invalid");
      return NextResponse.redirect(failUrl.toString());
    }

    const identity = url.searchParams.get("openid.identity") || "";
    const match = identity.match(/(\d+)$/);
    const steamId = match ? match[1] : "";

    if (steamId) {
      const profile = await getSteamUser(steamId);

      if (profile) {
        await prisma.user.upsert({
          where: { steamId },
          update: {
            name: profile.username,
            avatarUrl: profile.avatar,
          },
          create: {
            steamId,
            name: profile.username,
            avatarUrl: profile.avatar,
          },
        });
      }
    }

    const successUrl = new URL("/", siteUrl);
    if (steamId) {
      successUrl.searchParams.set("steamId", steamId);
    } else {
      successUrl.searchParams.set("steamError", "noid");
    }

    return NextResponse.redirect(successUrl.toString());
  } catch (err) {
    console.error("Steam verify failed", err);
    const failUrl = new URL("/", siteUrl);
    failUrl.searchParams.set("steamError", "exception");
    return NextResponse.redirect(failUrl.toString());
  }
}
