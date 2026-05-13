import { NextRequest, NextResponse } from "next/server";

type SteamTag = {
  category?: string;
  localized_category_name?: string;
  localized_tag_name?: string;
  internal_name?: string;
  name?: string;
};

type SteamInventoryResponse = {
  assets?: Array<{
    assetid: string;
    classid: string;
    instanceid: string;
    amount: string;
    tradable?: number;
    marketable?: number;
  }>;
  descriptions?: Array<{
    classid: string;
    instanceid: string;
    market_hash_name?: string;
    name?: string;
    icon_url?: string;
    icon_url_large?: string;
    type?: string;
    tradable?: number;
    marketable?: number;
    floatvalue?: string | number;
    paintwear?: string | number;
    actions?: Array<{
      link?: string;
      name?: string;
    }>;
    tags?: SteamTag[];
  }>;
  total_inventory_count?: number;
  more_items?: number;
  last_assetid?: string;
  success?: number;
  error?: string;
};

type InventoryPayload = {
  total: number;
  items: Array<{
    assetId: string;
    classId: string;
    instanceId: string;
    amount: number;
    name: string;
    marketHashName: string;
    iconUrl: string | null;
    type: string | null;
    tradable: number;
    marketable: number;
    rarityTag: string | null;
    collection: string | null;
    exterior: string | null;
    floatValue: number | null;
    inspectLink: string | null;
    position: number;
    source: "steam";
  }>;
  truncated: boolean;
  cached?: boolean;
  stale?: boolean;
};

class SteamInventoryFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string
  ) {
    super(message);
  }
}

const INVENTORY_CACHE_TTL_MS = 1000 * 60;
const INVENTORY_STALE_TTL_MS = 1000 * 60 * 10;
const inventoryCache = new Map<
  string,
  { fetchedAt: number; data: InventoryPayload }
>();

const parseFloatValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const extractTagValue = (tags: SteamTag[] | undefined, expected: string) => {
  if (!tags?.length) return null;
  const found = tags.find((tag) => {
    const category = `${tag.category ?? tag.localized_category_name ?? ""}`
      .trim()
      .toLowerCase();
    return category === expected.toLowerCase();
  });
  if (!found) return null;
  return (
    found.localized_tag_name?.trim() ||
    found.internal_name?.trim() ||
    found.name?.trim() ||
    null
  );
};

const buildInspectLink = (
  actions: Array<{ link?: string; name?: string }> | undefined,
  assetId: string,
  steamId: string
) => {
  if (!actions?.length) return null;
  const action = actions.find((entry) => {
    const link = entry.link ?? "";
    return (
      link.includes("csgo_econ_action_preview") ||
      link.includes("%assetid%")
    );
  });
  const linkTemplate = action?.link?.trim();
  if (!linkTemplate) return null;

  const inspectLink = linkTemplate
    .replace(/%assetid%/gi, assetId)
    .replace(/%owner_steamid%/gi, steamId);

  // Steam sometimes returns unresolved templates such as `%propid:6%`.
  // They are placeholders for values not exposed by this inventory endpoint,
  // so sending them to a float API only creates failing requests.
  if (/%[^%\s]+%/.test(inspectLink)) return null;

  return inspectLink;
};

async function fetchInventoryPage(
  steamId: string,
  startAssetId?: string
): Promise<SteamInventoryResponse> {
  const params = new URLSearchParams({
    l: "english",
    count: "2000",
  });
  if (startAssetId) params.set("start_assetid", startAssetId);

  const url = `https://steamcommunity.com/inventory/${steamId}/730/2?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SteamInventoryFetchError(
      `Steam inventory failed (${res.status})`,
      res.status,
      text
    );
  }
  return (await res.json()) as SteamInventoryResponse;
}

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const steamId = context.params.id;

  try {
    if (!steamId) {
      return NextResponse.json({ error: "Missing SteamID" }, { status: 400 });
    }

    const cached = inventoryCache.get(steamId);
    if (cached && Date.now() - cached.fetchedAt < INVENTORY_CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    let page = await fetchInventoryPage(steamId);
    if (page.success === 0) {
      return NextResponse.json(
        { error: page.error ?? "Steam inventory is private." },
        { status: 403 }
      );
    }

    const assets = [...(page.assets ?? [])];
    const descriptions = [...(page.descriptions ?? [])];

    let guard = 0;
    while (page.more_items && page.last_assetid && guard < 5) {
      page = await fetchInventoryPage(steamId, page.last_assetid);
      assets.push(...(page.assets ?? []));
      descriptions.push(...(page.descriptions ?? []));
      guard += 1;
    }

    const descriptionMap = new Map<string, (typeof descriptions)[number]>();
    for (const desc of descriptions) {
      descriptionMap.set(`${desc.classid}_${desc.instanceid}`, desc);
    }

    const items = assets.map((asset, index) => {
      const desc = descriptionMap.get(`${asset.classid}_${asset.instanceid}`);
      const tags = desc?.tags ?? [];
      const rarityTag = extractTagValue(tags, "rarity");
      const collection = extractTagValue(tags, "collection");
      const exterior = extractTagValue(tags, "exterior");
      const floatValue =
        parseFloatValue(desc?.floatvalue) ?? parseFloatValue(desc?.paintwear);
      const inspectLink = buildInspectLink(desc?.actions, asset.assetid, steamId);
      const parsedAmount = Number.parseInt(asset.amount ?? "1", 10);

      return {
        assetId: asset.assetid,
        classId: asset.classid,
        instanceId: asset.instanceid,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 1,
        name: desc?.name ?? "Unknown",
        marketHashName: desc?.market_hash_name ?? desc?.name ?? "Unknown",
        iconUrl: desc?.icon_url_large ?? desc?.icon_url ?? null,
        type: desc?.type ?? null,
        tradable: Number(desc?.tradable ?? asset.tradable ?? 0),
        marketable: Number(desc?.marketable ?? asset.marketable ?? 0),
        rarityTag,
        collection,
        exterior,
        floatValue,
        inspectLink,
        position: index,
        source: "steam" as const,
      };
    });

    const payload: InventoryPayload = {
      total: page.total_inventory_count ?? items.length,
      items,
      truncated: guard >= 5,
    };

    inventoryCache.set(steamId, { fetchedAt: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Steam inventory error:", error);
    const cached = steamId ? inventoryCache.get(steamId) : null;
    if (cached && Date.now() - cached.fetchedAt < INVENTORY_STALE_TTL_MS) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        stale: true,
      });
    }

    const status =
      error instanceof SteamInventoryFetchError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          status === 429
            ? "Steam dočasně omezuje požadavky na inventář. Zkus refresh za chvíli."
            : "Steam inventory error",
        details:
          error instanceof SteamInventoryFetchError
            ? error.details
            : String(error),
      },
      { status }
    );
  }
}
