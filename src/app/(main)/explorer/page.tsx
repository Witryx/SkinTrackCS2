"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSkinImageUrl } from "@/app/lib/skin-images";
import { Rarity, rarityBgClass, rarityOptions } from "@/app/lib/rarity";
import {
  findSkinCategorySuggestions,
  findSkinWeaponSuggestions,
  getSkinCategoryLabel,
  getSkinWeaponLabel,
  resolveSkinCategory,
  type SkinCategory,
  type SkinCategoryOption,
  type SkinWeaponOption,
} from "@/app/lib/skin-categories";
import SkinMarketCard from "@/components/SkinMarketCard";

type SkinResult = {
  name: string;
  weapon: string;
  skin: string;
  wear?: string | null;
  rarity: string;
  minFloat: number | null;
  maxFloat: number | null;
  price: number | null;
  medianPrice: number | null;
  suggestedPrice: number | null;
  volume7d: number | null;
  median7d: number | null;
  quantity: number | null;
  itemPage?: string | null;
  marketPage?: string | null;
};

type SortMode = "cheapest" | "most-expensive";

type SuggestionGroup = {
  key: string;
  weapon: string;
  skin: string;
  imageName: string;
  variants: SkinResult[];
  hasStatTrak: boolean;
};

const normalizeWeaponForGroup = (weapon: string) =>
  weapon.replace(/^stattrak(?:\u2122)?\s*/i, "").trim();

const isStatTrakItem = (item: SkinResult) => {
  const source = `${item.name} ${item.weapon}`.toLowerCase();
  return source.includes("stattrak");
};

const buildSuggestionGroups = (items: SkinResult[]) => {
  const grouped = new Map<string, SuggestionGroup>();

  for (const item of items) {
    const weaponBase = normalizeWeaponForGroup(item.weapon || "Skin");
    const skinBase = (item.skin || "Skin").trim();
    const key = `${weaponBase.toLowerCase()}|${skinBase.toLowerCase()}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        weapon: weaponBase,
        skin: skinBase,
        imageName: item.name,
        variants: [],
        hasStatTrak: false,
      });
    }

    const group = grouped.get(key);
    if (!group) continue;
    group.variants.push(item);
    if (isStatTrakItem(item)) group.hasStatTrak = true;
    if (!group.imageName) group.imageName = item.name;
  }

  return [...grouped.values()]
    .sort((a, b) => {
      const totalA = a.variants.length;
      const totalB = b.variants.length;
      if (totalA !== totalB) return totalB - totalA;
      return `${a.weapon} ${a.skin}`.localeCompare(`${b.weapon} ${b.skin}`);
    });
};

const sortOptions = [
  { value: "cheapest", label: "Nejnizsi cena" },
  { value: "most-expensive", label: "Nejvyssi cena" },
] as const;


const useDebounce = <T,>(value: T, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

export default function ExplorerPage() {
  const [qInput, setQInput] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SkinCategory | null>(null);
  const [selectedWeapon, setSelectedWeapon] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rarity, setRarity] = useState<"all" | Rarity>("all");
  const [sort, setSort] = useState<SortMode>("cheapest");
  const [rarityOpen, setRarityOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SkinResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [items, setItems] = useState<SkinResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const rarityRef = useRef<HTMLDivElement | null>(null);
  const sortRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSuggestionsOpen(false);
      }
      if (rarityRef.current && !rarityRef.current.contains(target)) setRarityOpen(false);
      if (sortRef.current && !sortRef.current.contains(target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const debouncedSuggestQuery = useDebounce(qInput, 220);
  const hasActiveFilters =
    rarity !== "all" ||
    !!minPrice ||
    !!maxPrice ||
    !!selectedCategory ||
    !!selectedWeapon;
  const canSubmitSearch = qInput.trim().length >= 2 || hasActiveFilters;

  type SearchOverrides = {
    category?: SkinCategory | null;
    weapon?: string | null;
  };

  const runSearch = (
    queryToCommit = qInput,
    overrides: SearchOverrides = {}
  ) => {
    const normalized = queryToCommit.trim();
    const inferredCategory = resolveSkinCategory(normalized);
    const nextCategory =
      overrides.category !== undefined
        ? overrides.category
        : selectedCategory ?? inferredCategory;
    const nextWeapon =
      overrides.weapon !== undefined ? overrides.weapon : selectedWeapon;

    if (
      normalized.length < 2 &&
      rarity === "all" &&
      !minPrice &&
      !maxPrice &&
      !nextCategory &&
      !nextWeapon
    ) {
      setHasSearched(false);
      setItems([]);
      setError(null);
      return;
    }
    setSelectedCategory(nextCategory);
    setSelectedWeapon(nextWeapon);
    setCommittedQuery(normalized);
    setHasSearched(true);
    setSuggestionsOpen(false);
  };

  useEffect(() => {
    const query = debouncedSuggestQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const params = new URLSearchParams({
      q: query,
      sort: "cheapest",
      limit: "80",
    });

    if (rarity !== "all") params.set("rarity", rarity);
    if (selectedCategory) params.set("category", selectedCategory);
    if (selectedWeapon) params.set("weapon", selectedWeapon);

    const controller = new AbortController();
    setSuggestionsLoading(true);

    fetch(`/api/skins/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Suggestion fetch failed");
        const body = await res.json();
        const nextSuggestions = Array.isArray(body.items) ? body.items : [];
        setSuggestions(nextSuggestions.slice(0, 80));
        setSuggestionsOpen(true);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setSuggestions([]);
      })
      .finally(() => setSuggestionsLoading(false));

    return () => controller.abort();
  }, [debouncedSuggestQuery, rarity, selectedCategory, selectedWeapon]);

  useEffect(() => {
    if (!hasSearched) {
      setLoading(false);
      setError(null);
      setItems([]);
      return;
    }

    const params = new URLSearchParams({
      q: committedQuery,
      sort,
    });

    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (rarity !== "all") params.set("rarity", rarity);
    if (selectedWeapon) params.set("weapon", selectedWeapon);
    if (selectedCategory) {
      params.set("category", selectedCategory);
      params.set("limit", "2000");
    }
    if (selectedWeapon) {
      params.set("limit", "2000");
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/skins/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Fetch failed");
        }
        const body = await res.json();
        setItems(body.items ?? []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Nepodarilo se nacist data z databaze skinu.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [
    committedQuery,
    hasSearched,
    minPrice,
    maxPrice,
    sort,
    rarity,
    selectedCategory,
    selectedWeapon,
  ]);

  const badgeText = useMemo(() => {
    if (!hasSearched) return "Zacni psat a vyber skin ze suggestions";
    if (loading) return "Nacitani dat z databaze...";
    if (error) return "Chyba pri nacitani";
    return `Nalezeno ${items.length} polozek`;
  }, [hasSearched, loading, error, items.length]);

  const suggestionGroups = useMemo(
    () => buildSuggestionGroups(suggestions).slice(0, 12),
    [suggestions]
  );
  const categorySuggestions = useMemo(
    () => findSkinCategorySuggestions(qInput).slice(0, 6),
    [qInput]
  );
  const weaponSuggestions = useMemo(
    () => findSkinWeaponSuggestions(qInput).slice(0, 10),
    [qInput]
  );
  const selectedCategoryLabel = useMemo(
    () => getSkinCategoryLabel(selectedCategory),
    [selectedCategory]
  );
  const selectedWeaponLabel = useMemo(
    () => getSkinWeaponLabel(selectedWeapon),
    [selectedWeapon]
  );

  const paintSuggestion = useMemo(() => {
    const bySkin = new Map<
      string,
      { skin: string; imageName: string; weaponCount: number; variantsCount: number }
    >();

    for (const group of suggestionGroups) {
      const key = group.skin.toLowerCase();
      if (!bySkin.has(key)) {
        bySkin.set(key, {
          skin: group.skin,
          imageName: group.imageName,
          weaponCount: 0,
          variantsCount: 0,
        });
      }
      const entry = bySkin.get(key);
      if (!entry) continue;
      entry.weaponCount += 1;
      entry.variantsCount += group.variants.length;
    }

    const candidates = [...bySkin.values()]
      .filter((entry) => entry.weaponCount > 1)
      .sort((a, b) => b.variantsCount - a.variantsCount);

    return candidates[0] ?? null;
  }, [suggestionGroups]);

  const pendingInput = hasSearched && qInput.trim() !== committedQuery;
  const hasAnySuggestion =
    categorySuggestions.length > 0 ||
    weaponSuggestions.length > 0 ||
    suggestionGroups.length > 0;
  const showSuggestionsPanel =
    qInput.trim().length >= 2 && (suggestionsOpen || suggestionsLoading);

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    runSearch();
  };

  const onSuggestionGroupPick = (group: SuggestionGroup) => {
    const query = `${group.weapon} | ${group.skin}`.trim();
    setQInput(query);
    runSearch(query);
  };

  const onSuggestionCategoryPick = (category: SkinCategoryOption) => {
    setQInput(category.label);
    runSearch(category.label, { category: category.key, weapon: null });
  };

  const onSuggestionWeaponPick = (weapon: SkinWeaponOption) => {
    setQInput(weapon.label);
    runSearch(weapon.label, { weapon: weapon.key, category: null });
  };

  const onSuggestionPaintPick = (skin: string) => {
    setQInput(skin);
    runSearch(skin);
  };

  const onSearchInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && hasAnySuggestion) {
      event.preventDefault();
      setSuggestionsOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setSuggestionsOpen(false);
    }
  };

  return (
    <section className="container-max space-y-7 py-8">
      <header className="market-stage p-5 sm:p-6">
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="kicker">Skin Explorer</div>
              <h1 className="display text-4xl">Najdi skin rychleji</h1>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Naseptavani bezi pri psani, vysledky potvrdis Enterem nebo klikem.
              </p>
            </div>
            <div className="badge">
              SkinTrack smart search
            </div>
          </div>

          <div ref={searchRef} className="relative">
            <form onSubmit={onSearchSubmit}>
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--card-solid)] px-4 py-2.5 shadow-[var(--shadow-soft)] sm:px-5 sm:py-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="h-5 w-5 shrink-0 text-[color:var(--muted)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="9" cy="9" r="6" />
                  <path d="m13.5 13.5 4 4" />
                </svg>
                <input
                  value={qInput}
                  onChange={(event) => {
                    setQInput(event.target.value);
                    if (event.target.value.trim().length >= 2) {
                      setSuggestionsOpen(true);
                    }
                  }}
                  onFocus={() => {
                    if (qInput.trim().length >= 2) setSuggestionsOpen(true);
                  }}
                  onKeyDown={onSearchInputKeyDown}
                  placeholder="Search for your favorite skins"
                  className="w-full bg-transparent text-base text-[color:var(--fg)] outline-none placeholder:text-[color:var(--muted)]"
                />
                <button
                  type="submit"
                  disabled={!canSubmitSearch}
                  className="rounded-xl bg-[color:var(--fg)] px-4 py-2 text-xs font-bold uppercase text-[color:var(--bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Hledat
                </button>
              </div>
            </form>

            {showSuggestionsPanel && (
              <div className="card absolute left-0 right-0 z-30 mt-3 overflow-hidden">
                {suggestionsLoading && (
                  <div className="px-5 py-5 text-sm text-[color:var(--muted)]">Nacitam varianty...</div>
                )}

                {!suggestionsLoading && !!categorySuggestions.length && (
                  <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                    <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase text-[color:var(--muted)]">
                      Kategorie
                    </div>
                    <ul className="divide-y divide-[color:var(--border)]">
                      {categorySuggestions.map((category) => (
                        <li key={category.key}>
                          <button
                            type="button"
                            onClick={() => onSuggestionCategoryPick(category)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-[color:var(--card-solid)]"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[color:var(--fg)]">
                                {category.label}
                              </div>
                              <div className="truncate text-xs text-[color:var(--muted)]">
                                Zobrazit vsechny skiny v kategorii
                              </div>
                            </div>
                            <span className="rounded-lg border border-[color:var(--border)] bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-[color:var(--accent)]">
                              Kategorie
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!suggestionsLoading && !!weaponSuggestions.length && (
                  <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                    <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase text-[color:var(--muted)]">
                      Zbrane
                    </div>
                    <ul className="divide-y divide-[color:var(--border)]">
                      {weaponSuggestions.map((weapon) => (
                        <li key={weapon.key}>
                          <button
                            type="button"
                            onClick={() => onSuggestionWeaponPick(weapon)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-[color:var(--card-solid)]"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[color:var(--fg)]">
                                {weapon.label}
                              </div>
                              <div className="truncate text-xs text-[color:var(--muted)]">
                                Zobrazit vsechny skiny pro tuhle zbran
                              </div>
                            </div>
                            <span className="rounded-lg border border-[color:var(--border)] bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-500">
                              Zbran
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!suggestionsLoading && !hasAnySuggestion && (
                  <div className="px-5 py-5 text-sm text-[color:var(--muted)]">
                    Pro tenhle dotaz jsme nic nenasli.
                  </div>
                )}

                {!suggestionsLoading && !!suggestionGroups.length && (
                  <ul className="max-h-[30rem] overflow-y-auto divide-y divide-[color:var(--border)]">
                    {suggestionGroups.map((group) => {
                      const subtitle = group.hasStatTrak
                        ? `${group.variants.length} variant (normal + ST)`
                        : `${group.variants.length} variant`;

                      return (
                        <li key={group.key}>
                          <button
                            type="button"
                            onClick={() => onSuggestionGroupPick(group)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--surface-soft)]"
                          >
                            <div className="market-stage h-11 w-16 overflow-hidden p-1">
                              <img
                                src={getSkinImageUrl(group.imageName)}
                                alt={`${group.weapon} | ${group.skin}`}
                                loading="lazy"
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-base font-semibold text-[color:var(--fg)]">
                                {group.weapon}
                                <span className="px-2 text-[color:var(--muted)]">|</span>
                                {group.skin}
                              </div>
                              <div className="truncate text-xs text-[color:var(--muted)]">
                                {subtitle}
                              </div>
                            </div>
                            <span className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-2 py-1 text-[11px] font-semibold uppercase text-[color:var(--muted)]">
                              All
                            </span>
                          </button>
                        </li>
                      );
                    })}

                    {paintSuggestion && (
                      <li key={`paint-${paintSuggestion.skin}`}>
                        <button
                          type="button"
                          onClick={() => onSuggestionPaintPick(paintSuggestion.skin)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[color:var(--surface-soft)]"
                        >
                          <div className="market-stage h-11 w-16 overflow-hidden p-1">
                            <img
                              src={getSkinImageUrl(paintSuggestion.imageName)}
                              alt={paintSuggestion.skin}
                              loading="lazy"
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-base font-semibold text-[color:var(--fg)]">
                              {paintSuggestion.skin}
                            </div>
                            <div className="truncate text-xs text-[color:var(--muted)]">
                              {paintSuggestion.weaponCount} zbrani - {paintSuggestion.variantsCount} variant
                            </div>
                          </div>
                          <span className="rounded-lg border border-[color:var(--border)] bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-[color:var(--accent)]">
                            Paint
                          </span>
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="surface grid gap-4 p-4 md:grid-cols-[1.2fr_1fr]">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[color:var(--muted)]">Cena od (EUR)</label>
            <input
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="0"
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] px-3 py-2 text-sm text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)]"
              type="number"
              min="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[color:var(--muted)]">Cena do (EUR)</label>
            <input
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="500"
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] px-3 py-2 text-sm text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)]"
              type="number"
              min="0"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div ref={sortRef} className="relative">
              <label className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Sort</label>
              <button
                type="button"
                onClick={() => setSortOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] px-3 py-2 text-left text-sm text-[color:var(--fg)]"
              >
                <span>{sortOptions.find((option) => option.value === sort)?.label}</span>
                <span className="text-xs text-[color:var(--muted)]">v</span>
              </button>
              {sortOpen && (
                <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] shadow-2xl">
                  {sortOptions.map((option) => {
                    const active = option.value === sort;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSort(option.value);
                          setSortOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm transition ${
                          active
                            ? "bg-[color:var(--surface-soft)] text-[color:var(--fg)]"
                            : "text-[color:var(--muted)] hover:bg-[color:var(--surface-soft)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div ref={rarityRef} className="relative">
              <label className="mb-1 block text-xs font-semibold text-[color:var(--muted)]">Rarity</label>
              <button
                type="button"
                onClick={() => setRarityOpen((value) => !value)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                  rarity !== "all"
                    ? "border-[color:var(--accent)] bg-[color:var(--card-solid)] text-[color:var(--fg)]"
                    : "border-[color:var(--border)] bg-[color:var(--card-solid)] text-[color:var(--fg)]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{rarity === "all" ? "Vsechny kvality" : rarity}</span>
                  {rarity !== "all" && (
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        rarityBgClass[rarity as Rarity] ?? "bg-slate-200"
                      }`}
                    />
                  )}
                </span>
                <span className="text-xs text-[color:var(--muted)]">v</span>
              </button>

              {rarityOpen && (
                <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card-solid)] shadow-2xl">
                  {rarityOptions.map((option) => {
                    const active = option.value === rarity;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setRarity(option.value as "all" | Rarity);
                          setRarityOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                          active
                            ? "bg-[color:var(--surface-soft)] text-[color:var(--fg)]"
                            : "text-[color:var(--muted)] hover:bg-[color:var(--surface-soft)]"
                        }`}
                      >
                        <span>{option.label}</span>
                        {option.value !== "all" && (
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              rarityBgClass[option.value as Rarity] ?? "bg-slate-200"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 text-sm text-[color:var(--muted)] lg:flex-row lg:items-center">
        <span>{badgeText}</span>
        <div className="flex flex-wrap items-center gap-3">
          {selectedCategory && selectedCategoryLabel && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-cyan-500/10 px-3 py-1 text-xs text-[color:var(--accent)]">
              Kategorie: {selectedCategoryLabel}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  if (hasSearched) {
                    runSearch(qInput, { category: null });
                  }
                }}
                className="rounded-full border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase transition hover:bg-cyan-400/20"
              >
                Zrusit
              </button>
            </span>
          )}
          {selectedWeapon && selectedWeaponLabel && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-emerald-500/10 px-3 py-1 text-xs text-emerald-500">
              Zbran: {selectedWeaponLabel}
              <button
                type="button"
                onClick={() => {
                  setSelectedWeapon(null);
                  if (hasSearched) {
                    runSearch(qInput, { weapon: null });
                  }
                }}
                className="rounded-full border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase transition hover:bg-emerald-400/20"
              >
                Zrusit
              </button>
            </span>
          )}
          {pendingInput && (
            <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-xs text-amber-500">
              Nepotvrzene zmeny ve vyhledavani
            </span>
          )}
          {loading && <span className="text-[color:var(--fg)]">Loading...</span>}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/45 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!hasSearched && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-10 text-center text-[color:var(--muted)]">
          Pis do vyhledavani nahore, vyber suggestion a potvrd hledani.
        </div>
      )}

      {hasSearched && !loading && !items.length && !error && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-soft)] px-6 py-10 text-center text-[color:var(--muted)]">
          Nic jsme nenasli. Zkus zmenit filtr nebo jinou kombinaci.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((item) => {
          return (
            <SkinMarketCard
              key={item.name}
              name={item.name}
              weapon={item.weapon}
              skin={item.skin}
              wear={item.wear}
              rarity={item.rarity}
              minFloat={item.minFloat}
              maxFloat={item.maxFloat}
              price={item.price}
              volume7d={item.volume7d}
              median7d={item.median7d}
              quantity={item.quantity}
              itemPage={item.itemPage}
              marketPage={item.marketPage}
              density="compact"
            />
          );
        })}
      </div>
    </section>
  );
}

