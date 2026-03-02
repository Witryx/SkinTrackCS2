import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 7000;
const CSFLOAT_INSPECT_API = "https://api.csfloat.com/";

type InspectPayload = {
  iteminfo?: {
    floatvalue?: number | string | null;
    float_value?: number | string | null;
  };
  floatvalue?: number | string | null;
  float_value?: number | string | null;
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {}
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { inspectLink?: unknown }
      | null;
    const inspectLink =
      typeof body?.inspectLink === "string" ? body.inspectLink.trim() : "";

    if (!inspectLink || !inspectLink.includes("csgo_econ_action_preview")) {
      return NextResponse.json(
        { error: "Invalid inspect link." },
        { status: 400 }
      );
    }

    const url = `${CSFLOAT_INSPECT_API}?url=${encodeURIComponent(inspectLink)}`;
    const res = await fetchWithTimeout(url, {
      headers: {
        // CSFloat blocks requests without a browser-like origin.
        Origin: "https://csfloat.com",
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    const raw = await res.text().catch(() => "");
    if (!res.ok) {
      return NextResponse.json(
        { error: "Inspect float lookup failed.", details: raw.slice(0, 180) },
        { status: res.status }
      );
    }

    let payload: InspectPayload | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as InspectPayload) : null;
    } catch {
      payload = null;
    }

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid inspect response." },
        { status: 502 }
      );
    }

    const floatValue = parseNumber(
      payload.iteminfo?.floatvalue ??
        payload.iteminfo?.float_value ??
        payload.floatvalue ??
        payload.float_value
    );

    return NextResponse.json({
      floatValue,
      source: "csfloat-inspect",
    });
  } catch (error) {
    console.error("Inspect float lookup failed", error);
    return NextResponse.json(
      { error: "Inspect float lookup failed." },
      { status: 500 }
    );
  }
}
