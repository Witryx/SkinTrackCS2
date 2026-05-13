import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 7000;
const CSFLOAT_INSPECT_APIS = [
  process.env.CSFLOAT_INSPECT_API,
  "https://api.csgofloat.com/",
].filter((url): url is string => Boolean(url));

type InspectPayload = {
  iteminfo?: {
    floatvalue?: number | string | null;
    float_value?: number | string | null;
  };
  floatvalue?: number | string | null;
  float_value?: number | string | null;
};

type LookupResult =
  | {
      ok: true;
      payload: InspectPayload | null;
      endpoint: string;
    }
  | {
      ok: false;
      error: string;
      details?: string;
      status?: number;
      endpoint?: string;
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

const lookupInspectPayload = async (
  inspectLink: string
): Promise<LookupResult> => {
  let lastError: LookupResult = {
    ok: false,
    error: "Inspect float service unavailable.",
  };

  for (const endpoint of CSFLOAT_INSPECT_APIS) {
    const url = `${endpoint}?url=${encodeURIComponent(inspectLink)}`;
    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          Origin: "https://csfloat.com",
          "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
      });

      const raw = await res.text().catch(() => "");
      if (!res.ok) {
        lastError = {
          ok: false,
          error: "Inspect float lookup failed.",
          details: raw.slice(0, 180),
          status: res.status,
          endpoint,
        };
        continue;
      }

      try {
        return {
          ok: true,
          payload: raw ? (JSON.parse(raw) as InspectPayload) : null,
          endpoint,
        };
      } catch {
        lastError = {
          ok: false,
          error: "Invalid inspect response.",
          endpoint,
        };
      }
    } catch (error) {
      lastError = {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Inspect float service unavailable.",
        endpoint,
      };
    }
  }

  return lastError;
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

    if (/%[^%\s]+%/.test(inspectLink)) {
      return NextResponse.json(
        {
          floatValue: null,
          source: "inspect-link-template",
          error: "Inspect link contains unresolved Steam placeholders.",
        },
        { status: 200 }
      );
    }

    const lookup = await lookupInspectPayload(inspectLink);
    if (!lookup.ok) {
      return NextResponse.json(
        {
          floatValue: null,
          source: lookup.endpoint ?? "inspect-service",
          error: lookup.error,
          details: lookup.details,
        },
        { status: 200 }
      );
    }

    if (!lookup.payload) {
      return NextResponse.json(
        {
          floatValue: null,
          source: lookup.endpoint,
          error: "Invalid inspect response.",
        },
        { status: 200 }
      );
    }

    const floatValue = parseNumber(
      lookup.payload.iteminfo?.floatvalue ??
        lookup.payload.iteminfo?.float_value ??
        lookup.payload.floatvalue ??
        lookup.payload.float_value
    );

    return NextResponse.json({
      floatValue,
      source: lookup.endpoint,
    });
  } catch (error) {
    console.error("Inspect float lookup failed", error);
    return NextResponse.json(
      { floatValue: null, source: "inspect-service", error: "Inspect float lookup failed." },
      { status: 200 }
    );
  }
}
