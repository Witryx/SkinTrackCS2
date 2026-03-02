export type SkinCategory =
  | "knife"
  | "gloves"
  | "rifle"
  | "sniper-rifle"
  | "smg"
  | "pistol"
  | "shotgun"
  | "machinegun";

export type SkinCategoryOption = {
  key: SkinCategory;
  label: string;
  query: string;
  aliases: string[];
  weaponTerms: string[];
};

export type SkinWeaponOption = {
  key: string;
  label: string;
  aliases: string[];
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripWeaponDecorators = (value: string) =>
  value
    .replace(/^\s*stattrak(?:\u2122)?\s+/i, "")
    .replace(/^\s*souvenir\s+/i, "")
    .replace(/^\s*(?:\u2605)\s*/i, "")
    .trim();

const normalizeWeaponKey = (value: string) =>
  normalizeText(stripWeaponDecorators(value)).replace(/\s+/g, "");

const normalizedIncludesAny = (value: string, terms: string[]) => {
  if (!value) return false;
  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    return normalizedTerm.length ? value.includes(normalizedTerm) : false;
  });
};

export const skinCategoryOptions: SkinCategoryOption[] = [
  {
    key: "knife",
    label: "Knife",
    query: "knife",
    aliases: ["knife", "knives", "nuz", "noz", "daggers"],
    weaponTerms: [
      "knife",
      "bayonet",
      "m9 bayonet",
      "karambit",
      "flip knife",
      "gut knife",
      "butterfly knife",
      "falchion knife",
      "huntsman knife",
      "bowie knife",
      "shadow daggers",
      "navaja knife",
      "stiletto knife",
      "talon knife",
      "ursus knife",
      "classic knife",
      "skeleton knife",
      "nomad knife",
      "paracord knife",
      "survival knife",
      "kukri knife",
      "daggers",
    ],
  },
  {
    key: "gloves",
    label: "Gloves",
    query: "gloves",
    aliases: ["glove", "gloves", "rukavice", "hand wraps"],
    weaponTerms: [
      "glove",
      "gloves",
      "hand wraps",
      "bloodhound gloves",
      "driver gloves",
      "sport gloves",
      "specialist gloves",
      "hydra gloves",
      "moto gloves",
      "broken fang gloves",
      "wraps",
    ],
  },
  {
    key: "rifle",
    label: "Rifle",
    query: "rifle",
    aliases: ["rifle", "rifles"],
    weaponTerms: ["ak-47", "m4a4", "m4a1-s", "famas", "galil ar", "aug", "sg 553"],
  },
  {
    key: "sniper-rifle",
    label: "Sniper Rifle",
    query: "sniper rifle",
    aliases: ["sniper", "sniper rifle", "awp", "ssg", "scout"],
    weaponTerms: ["awp", "ssg 08", "scar-20", "g3sg1", "sniper rifle"],
  },
  {
    key: "smg",
    label: "SMG",
    query: "smg",
    aliases: ["smg", "submachine gun"],
    weaponTerms: ["mp9", "mp7", "ump-45", "p90", "pp-bizon", "mac-10", "mp5-sd", "smg"],
  },
  {
    key: "pistol",
    label: "Pistol",
    query: "pistol",
    aliases: ["pistol", "pistols", "deagle", "usp", "glock"],
    weaponTerms: [
      "glock-18",
      "usp-s",
      "p2000",
      "p250",
      "desert eagle",
      "deagle",
      "dual berettas",
      "five-seven",
      "tec-9",
      "cz75-auto",
      "r8 revolver",
      "pistol",
    ],
  },
  {
    key: "shotgun",
    label: "Shotgun",
    query: "shotgun",
    aliases: ["shotgun", "shotguns"],
    weaponTerms: ["nova", "xm1014", "mag-7", "sawed-off", "shotgun"],
  },
  {
    key: "machinegun",
    label: "Machinegun",
    query: "machinegun",
    aliases: ["machinegun", "machine gun", "mg", "negev", "m249"],
    weaponTerms: ["m249", "negev", "machinegun", "machine gun"],
  },
];

export const skinWeaponOptions: SkinWeaponOption[] = [
  { key: "bayonet", label: "Bayonet", aliases: ["bayonet"] },
  { key: "m9bayonet", label: "M9 Bayonet", aliases: ["m9bayonet", "m9 bayonet", "m9"] },
  { key: "karambit", label: "Karambit", aliases: ["karambit", "kara"] },
  {
    key: "butterflyknife",
    label: "Butterfly Knife",
    aliases: ["butterflyknife", "butterfly knife", "butterfly", "bfk"],
  },
  { key: "flipknife", label: "Flip Knife", aliases: ["flipknife", "flip knife", "flip"] },
  { key: "gutknife", label: "Gut Knife", aliases: ["gutknife", "gut knife", "gut"] },
  {
    key: "falchionknife",
    label: "Falchion Knife",
    aliases: ["falchionknife", "falchion knife", "falchion"],
  },
  {
    key: "huntsmanknife",
    label: "Huntsman Knife",
    aliases: ["huntsmanknife", "huntsman knife", "huntsman"],
  },
  { key: "bowieknife", label: "Bowie Knife", aliases: ["bowieknife", "bowie knife", "bowie"] },
  {
    key: "shadowdaggers",
    label: "Shadow Daggers",
    aliases: ["shadowdaggers", "shadow daggers", "daggers", "shadow"],
  },
  { key: "navajaknife", label: "Navaja Knife", aliases: ["navajaknife", "navaja knife", "navaja"] },
  {
    key: "stilettoknife",
    label: "Stiletto Knife",
    aliases: ["stilettoknife", "stiletto knife", "stiletto"],
  },
  { key: "talonknife", label: "Talon Knife", aliases: ["talonknife", "talon knife", "talon"] },
  { key: "ursusknife", label: "Ursus Knife", aliases: ["ursusknife", "ursus knife", "ursus"] },
  { key: "classicknife", label: "Classic Knife", aliases: ["classicknife", "classic knife", "classic"] },
  {
    key: "skeletonknife",
    label: "Skeleton Knife",
    aliases: ["skeletonknife", "skeleton knife", "skeleton"],
  },
  { key: "nomadknife", label: "Nomad Knife", aliases: ["nomadknife", "nomad knife", "nomad"] },
  {
    key: "paracordknife",
    label: "Paracord Knife",
    aliases: ["paracordknife", "paracord knife", "paracord"],
  },
  {
    key: "survivalknife",
    label: "Survival Knife",
    aliases: ["survivalknife", "survival knife", "survival"],
  },
  { key: "kukriknife", label: "Kukri Knife", aliases: ["kukriknife", "kukri knife", "kukri"] },
  { key: "ak47", label: "AK-47", aliases: ["ak47", "ak-47", "ak"] },
  { key: "m4a4", label: "M4A4", aliases: ["m4a4", "m4 a4", "m4"] },
  { key: "m4a1s", label: "M4A1-S", aliases: ["m4a1s", "m4a1-s", "m4 a1 s"] },
  { key: "awp", label: "AWP", aliases: ["awp"] },
  { key: "ssg08", label: "SSG 08", aliases: ["ssg08", "ssg 08", "scout"] },
  { key: "scar20", label: "SCAR-20", aliases: ["scar20", "scar-20"] },
  { key: "g3sg1", label: "G3SG1", aliases: ["g3sg1"] },
  { key: "aug", label: "AUG", aliases: ["aug"] },
  { key: "sg553", label: "SG 553", aliases: ["sg553", "sg 553", "krieg"] },
  { key: "famas", label: "FAMAS", aliases: ["famas"] },
  { key: "galilar", label: "Galil AR", aliases: ["galilar", "galil ar", "galil"] },
  { key: "glock18", label: "Glock-18", aliases: ["glock18", "glock-18", "glock"] },
  { key: "usps", label: "USP-S", aliases: ["usps", "usp-s", "usp"] },
  { key: "p2000", label: "P2000", aliases: ["p2000"] },
  { key: "p250", label: "P250", aliases: ["p250"] },
  {
    key: "deserteagle",
    label: "Desert Eagle",
    aliases: ["deserteagle", "desert eagle", "deagle"],
  },
  {
    key: "dualberettas",
    label: "Dual Berettas",
    aliases: ["dualberettas", "dual berettas"],
  },
  { key: "fiveseven", label: "Five-SeveN", aliases: ["fiveseven", "five-seven"] },
  { key: "tec9", label: "Tec-9", aliases: ["tec9", "tec-9"] },
  { key: "cz75auto", label: "CZ75-Auto", aliases: ["cz75auto", "cz75-auto", "cz75"] },
  {
    key: "r8revolver",
    label: "R8 Revolver",
    aliases: ["r8revolver", "r8 revolver", "revolver"],
  },
  { key: "mp9", label: "MP9", aliases: ["mp9"] },
  { key: "mp7", label: "MP7", aliases: ["mp7"] },
  { key: "mp5sd", label: "MP5-SD", aliases: ["mp5sd", "mp5-sd", "mp5"] },
  { key: "ump45", label: "UMP-45", aliases: ["ump45", "ump-45", "ump"] },
  { key: "p90", label: "P90", aliases: ["p90"] },
  { key: "ppbizon", label: "PP-Bizon", aliases: ["ppbizon", "pp-bizon", "bizon"] },
  { key: "mac10", label: "MAC-10", aliases: ["mac10", "mac-10"] },
  { key: "nova", label: "Nova", aliases: ["nova"] },
  { key: "xm1014", label: "XM1014", aliases: ["xm1014"] },
  { key: "mag7", label: "MAG-7", aliases: ["mag7", "mag-7"] },
  { key: "sawedoff", label: "Sawed-Off", aliases: ["sawedoff", "sawed-off"] },
  { key: "m249", label: "M249", aliases: ["m249"] },
  { key: "negev", label: "Negev", aliases: ["negev"] },
];

const optionByKey = new Map<SkinCategory, SkinCategoryOption>(
  skinCategoryOptions.map((option) => [option.key, option])
);

const optionAliases = skinCategoryOptions.map((option) => ({
  option,
  normalizedAliases: [
    normalizeText(option.label),
    normalizeText(option.query),
    normalizeText(option.key),
    ...option.aliases.map(normalizeText),
  ],
}));

const weaponOptionsByKey = new Map<string, SkinWeaponOption>(
  skinWeaponOptions.map((option) => [option.key, option])
);

const weaponAliases = skinWeaponOptions.map((option) => ({
  option,
  normalizedAliases: [
    normalizeWeaponKey(option.label),
    ...option.aliases.map((alias) => normalizeWeaponKey(alias)),
  ],
}));

export function resolveSkinCategory(value?: string | null): SkinCategory | null {
  const normalized = normalizeText(value ?? "");
  if (!normalized) return null;

  for (const entry of optionAliases) {
    if (entry.normalizedAliases.some((alias) => alias === normalized)) {
      return entry.option.key;
    }
  }
  return null;
}

export function getSkinCategoryLabel(category?: SkinCategory | null) {
  if (!category) return null;
  return optionByKey.get(category)?.label ?? null;
}

export function findSkinCategorySuggestions(value: string): SkinCategoryOption[] {
  const normalized = normalizeText(value);
  if (normalized.length < 2) return [];

  const scored = optionAliases
    .map((entry) => {
      let score = Number.POSITIVE_INFINITY;
      for (const alias of entry.normalizedAliases) {
        if (!alias) continue;
        if (alias === normalized) score = Math.min(score, 0);
        else if (alias.startsWith(normalized)) score = Math.min(score, 1);
        else if (alias.includes(normalized)) score = Math.min(score, 2);
        else if (normalized.includes(alias)) score = Math.min(score, 3);
      }
      return { option: entry.option, score };
    })
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label));

  return scored.map((entry) => entry.option);
}

export function resolveSkinWeaponKey(value?: string | null): string | null {
  const normalized = normalizeWeaponKey(value ?? "");
  if (!normalized) return null;

  for (const entry of weaponAliases) {
    if (entry.normalizedAliases.some((alias) => alias === normalized)) {
      return entry.option.key;
    }
  }
  return normalized;
}

export function getSkinWeaponLabel(weaponKey?: string | null) {
  const resolvedKey = resolveSkinWeaponKey(weaponKey);
  if (!resolvedKey) return null;
  return weaponOptionsByKey.get(resolvedKey)?.label ?? null;
}

export function findSkinWeaponSuggestions(value: string): SkinWeaponOption[] {
  const normalized = normalizeWeaponKey(value);
  if (normalized.length < 2) return [];

  const scored = weaponAliases
    .map((entry) => {
      let score = Number.POSITIVE_INFINITY;
      for (const alias of entry.normalizedAliases) {
        if (!alias) continue;
        if (alias === normalized) score = Math.min(score, 0);
        else if (alias.startsWith(normalized)) score = Math.min(score, 1);
        else if (alias.includes(normalized)) score = Math.min(score, 2);
        else if (normalized.includes(alias)) score = Math.min(score, 3);
      }
      return { option: entry.option, score };
    })
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.option.label.localeCompare(b.option.label));

  return scored.map((entry) => entry.option);
}

export function isWeaponMatchingFilter(
  weapon: string,
  marketHashName: string | null | undefined,
  weaponFilter: string
) {
  const expected = resolveSkinWeaponKey(weaponFilter);
  if (!expected) return false;

  const directWeapon = resolveSkinWeaponKey(weapon);
  if (directWeapon === expected) return true;

  const marketHashWeapon = `${marketHashName ?? ""}`.split("|")[0]?.trim() ?? "";
  const marketWeapon = resolveSkinWeaponKey(marketHashWeapon);
  return marketWeapon === expected;
}

export function isWeaponInSkinCategory(
  weapon: string,
  marketHashName: string | null | undefined,
  category: SkinCategory
) {
  const option = optionByKey.get(category);
  if (!option) return false;
  const haystackRaw = `${weapon ?? ""} ${marketHashName ?? ""}`;
  const haystack = normalizeText(haystackRaw);
  if (!haystack) return false;

  if (category === "knife" && /(?:\u2605)/.test(haystackRaw)) return true;
  return normalizedIncludesAny(haystack, option.weaponTerms);
}
