import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const steamId = context.params.id;

    if (!steamId) {
      return NextResponse.json(
        { error: "Missing SteamID" },
        { status: 400 }
      );
    }

    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Steam API Key" },
        { status: 500 }
      );
    }

    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`;

    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Steam API failed", status: res.status },
        { status: 500 }
      );
    }

    const json = await res.json();
    const player = json.response?.players?.[0];

    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      steamId,
      player,
    });
  } catch (error) {
    console.error("Steam profile error:", error);
    return NextResponse.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
