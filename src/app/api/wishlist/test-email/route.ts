import { NextRequest, NextResponse } from "next/server";
import { sendWishlistTestEmail } from "@/app/lib/email";
import { prisma } from "@/app/lib/prisma";
import { getSiteUrl } from "@/app/lib/site-url";
import { getUserContactEmail } from "@/app/lib/secure-data";
import { normalizeSteamId } from "@/app/lib/user-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const steamId = normalizeSteamId(body?.steamId);

  if (!steamId) {
    return NextResponse.json({ error: "Missing SteamID." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { steamId } });
    if (!user) {
      return NextResponse.json(
        { error: "Uživatel nebyl nalezen." },
        { status: 404 }
      );
    }

    const email = getUserContactEmail(user);
    if (!email) {
      return NextResponse.json(
        { error: "Nejdřív ulož e-mail pro alerty." },
        { status: 400 }
      );
    }

    const detailUrl = new URL("/wishlist", getSiteUrl()).toString();
    const result = await sendWishlistTestEmail({ to: email, detailUrl });

    if (!result.sent) {
      return NextResponse.json(
        { error: "E-mailové alerty nejsou na serveru nakonfigurované." },
        { status: 503 }
      );
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Wishlist test e-mail failed", error);
    return NextResponse.json(
      { error: "Testovací e-mail se nepodařilo odeslat." },
      { status: 500 }
    );
  }
}
