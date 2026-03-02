"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSkinDetailPath, getSkinImageUrl } from "@/app/lib/skin-images";
import { Rarity, rarityTextClass } from "@/app/lib/rarity";

type CardDensity = "regular" | "compact";

export type SkinMarketCardProps = {
  name: string;
  weapon: string;
  skin: string;
  wear?: string | null;
  rarity?: string | null;
  minFloat?: number | null;
  maxFloat?: number | null;
  price?: number | null;
  volume7d?: number | null;
  median7d?: number | null;
  quantity?: number | null;
  itemPage?: string | null;
  marketPage?: string | null;
  density?: CardDensity;
  className?: string;
};

const currency = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? currency.format(value) : "-";

const wearToShort: Record<string, string> = {
  "Factory New": "FN",
  "Minimal Wear": "MW",
  "Field-Tested": "FT",
  "Well-Worn": "WW",
  "Battle-Scarred": "BS",
};

const wearBadgeClassByName: Record<string, string> = {
  "Factory New": "bg-lime-500/20 text-lime-200 border border-lime-300/40",
  "Minimal Wear": "bg-emerald-500/20 text-emerald-200 border border-emerald-300/40",
  "Field-Tested": "bg-sky-500/20 text-sky-200 border border-sky-300/40",
  "Well-Worn": "bg-violet-500/20 text-violet-200 border border-violet-300/40",
  "Battle-Scarred": "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-300/40",
};

const isStatTrak = (name: string, weapon: string) =>
  `${name} ${weapon}`.toLowerCase().includes("stattrak");

const isSouvenir = (name: string, weapon: string) =>
  `${name} ${weapon}`.toLowerCase().includes("souvenir");

const normalizeWeapon = (weapon: string) =>
  weapon.replace(/^stattrak(?:\u2122)?\s*/i, "").trim();

const normalizeLabel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const resolveWearShort = (wear?: string | null) => {
  if (!wear) return "STD";
  const normalized = wear.trim();
  if (!normalized) return "STD";
  return wearToShort[normalized] ?? normalized.slice(0, 2).toUpperCase();
};

const resolveWearBadgeClass = (wear?: string | null) => {
  if (!wear) return "bg-slate-500/20 text-slate-200 border border-slate-300/30";
  return (
    wearBadgeClassByName[wear.trim()] ??
    "bg-slate-500/20 text-slate-200 border border-slate-300/30"
  );
};

const join = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function SkinMarketCard({
  name,
  weapon,
  skin,
  wear,
  rarity,
  price,
  density = "regular",
  className,
}: SkinMarketCardProps) {
  const router = useRouter();
  const detailPath = getSkinDetailPath(name);
  const imageUrl = getSkinImageUrl(name);
  const st = isStatTrak(name, weapon);
  const souvenir = isSouvenir(name, weapon);
  const weaponLabel = normalizeWeapon(weapon || "Skin");
  const skinLabel = (skin || "").trim();
  const wearShort = resolveWearShort(wear);
  const wearClass = resolveWearBadgeClass(wear);
  const compact = density === "compact";
  const showSkinSubtitle =
    !!skinLabel && normalizeLabel(weaponLabel) !== normalizeLabel(skinLabel);

  const rootCardClass = join(
    "group relative flex cursor-pointer flex-col overflow-hidden rounded-[1.45rem] border bg-[#030d24] transition",
    souvenir
      ? compact
        ? "border-amber-300/70 shadow-[0_12px_34px_rgba(245,158,11,0.24)] hover:border-amber-200/90"
        : "border-amber-300/70 shadow-[0_18px_48px_rgba(245,158,11,0.28)] hover:-translate-y-1 hover:border-amber-200/90"
      : compact
        ? "border-cyan-400/20 shadow-[0_12px_30px_rgba(2,8,23,0.58)] hover:border-emerald-300/35"
        : "border-cyan-400/25 shadow-[0_18px_46px_rgba(2,8,23,0.66)] hover:-translate-y-1 hover:border-emerald-300/45",
    className
  );

  const onCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a")) return;
    router.push(detailPath);
  };

  const onCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(detailPath);
    }
  };

  return (
    <article
      className={rootCardClass}
      role="link"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(150%_95%_at_50%_0%,rgba(33,131,255,0.2),rgba(2,9,24,0)_62%)]" />
      <div className="relative z-10 flex h-full flex-col">
        <div className={join(compact ? "px-3.5 pt-3.5 pb-3.5" : "px-4 pt-4 pb-4")}>
          <div className="flex items-center justify-end gap-1.5">
            {st && (
              <span
                className={join(
                  "rounded-lg border border-amber-300/45 bg-amber-500/20 px-2 text-[10px] font-semibold uppercase text-amber-100",
                  compact ? "py-0.5" : "py-1"
                )}
              >
                ST
              </span>
            )}
            <span
              className={join(
                "rounded-lg px-2 text-[11px] font-semibold uppercase",
                compact ? "py-0.5" : "py-1",
                wearClass
              )}
            >
              {wearShort}
            </span>
          </div>

          <div
            className={join(
              "mt-2 flex items-center justify-center overflow-hidden rounded-2xl border border-slate-700/65 bg-[radial-gradient(circle_at_50%_28%,rgba(40,113,255,0.34),rgba(3,9,22,0.95)_72%)] px-3",
              compact ? "h-40" : "h-48"
            )}
          >
            <img
              src={imageUrl}
              alt={name}
              loading="lazy"
              className={join(
                "w-full object-contain drop-shadow-[0_10px_22px_rgba(2,8,23,0.85)] transition duration-300 group-hover:scale-[1.025]",
                compact ? "max-h-36" : "max-h-44"
              )}
            />
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="min-w-0 space-y-0.5">
              <div
                className={join(
                  "font-black leading-[0.95] tracking-[-0.02em] text-slate-100 break-words",
                  compact ? "text-[1.75rem]" : "text-[2rem]"
                )}
              >
                {weaponLabel}
              </div>
              {showSkinSubtitle && (
                <div
                  className={join(
                    "font-semibold leading-[0.95] tracking-[-0.01em] text-slate-300/95 break-words",
                    compact ? "text-[1.25rem]" : "text-[1.4rem]"
                  )}
                >
                  {skinLabel}
                </div>
              )}
            </div>
            <div className="text-right">
              <div
                className={join(
                  "font-extrabold leading-none text-slate-100",
                  compact ? "text-[1.9rem]" : "text-[2.15rem]"
                )}
              >
                {formatCurrency(price)}
              </div>
            </div>
          </div>

        </div>

        <div
          className={join(
            "mt-auto flex items-center justify-between border-t border-slate-800/95 text-slate-400",
            compact ? "px-3.5 pb-3.5 pt-2.5 text-[11px]" : "px-4 pb-4 pt-3 text-xs"
          )}
        >
          <span className={rarityTextClass[(rarity as Rarity) ?? "Mil-Spec"] ?? "text-slate-300"}>
            {rarity ?? "Unknown"}
          </span>
          <Link
            href={detailPath}
            prefetch={false}
            className={join(
              "inline-flex items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/10 font-semibold text-cyan-100 transition hover:border-cyan-200/65 hover:bg-cyan-500/20 hover:text-white",
              compact ? "h-9 min-w-24 px-4 text-sm" : "h-10 min-w-28 px-5 text-sm"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            Detail
          </Link>
        </div>
      </div>
    </article>
  );
}
