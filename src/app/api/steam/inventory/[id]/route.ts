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

  return linkTemplate
    .replace(/%assetid%/gi, assetId)
    .replace(/%owner_steamid%/gi, steamId);
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
    throw new Error(`Steam inventory failed (${res.status}): ${text}`);
  }
  return (await res.json()) as SteamInventoryResponse;
}

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const steamId = context.params.id;

    if (!steamId) {
      return NextResponse.json({ error: "Missing SteamID" }, { status: 400 });
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

    return NextResponse.json({
      total: page.total_inventory_count ?? items.length,
      items,
      truncated: guard >= 5,
    });
  } catch (error) {
    console.error("Steam inventory error:", error);
    return NextResponse.json(
      { error: "Steam inventory error", details: String(error) },
      { status: 500 }
    );
  }
}
