import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podmínky a privacy policy | SkinTrack CS2",
  description: "Podmínky používání a ochrana soukromí aplikace SkinTrack CS2.",
};

const sections = [
  {
    title: "1. Účel aplikace",
    body: "SkinTrack CS2 je školní webová aplikace pro sledování cen, trendů, wishlistu a upozornění u CS2 skinů. Data z externích marketů slouží pouze k informativnímu porovnání.",
  },
  {
    title: "2. Ukládaná data",
    body: "Aplikace ukládá SteamID, veřejné údaje ze Steam profilu, wishlist, nastavení alertů, cenovou historii, notifikace a volitelný e-mail pro cenové alerty.",
  },
  {
    title: "3. Ochrana citlivých údajů",
    body: "Tajné API klíče jsou uložené v proměnných prostředí mimo zdrojový kód. E-mail pro alerty se ukládá šifrovaně pomocí AES-256-GCM a pro kontrolu duplicity se používá pouze HMAC hash.",
  },
  {
    title: "4. Lokálně uložená data",
    body: "Frontend ukládá do localStorage SteamID a preferenci motivu, aby zůstalo přihlášení a vzhled zachované mezi návštěvami ve stejném prohlížeči.",
  },
  {
    title: "5. Externí služby",
    body: "Aplikace komunikuje se Steamem, Skinportem a podle konfigurace také s CSFloat, DMarketem a e-mailovou službou Resend. Tyto služby mohou zpracovávat požadavky podle vlastních pravidel.",
  },
  {
    title: "6. Omezení odpovědnosti",
    body: "Ceny a dostupnost skinů se rychle mění. SkinTrack CS2 negarantuje přesnost dat a neslouží jako finanční doporučení ani závazná nabídka.",
  },
  {
    title: "7. Smazání dat",
    body: "Uživatel může odebrat položky z wishlistu a smazat e-mail pro alerty. Pro smazání účtu nebo export dat kontaktujte správce projektu.",
  },
];

export default function PrivacyPage() {
  return (
    <section className="container-max space-y-7 py-8 sm:py-10">
      <div className="market-stage p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="kicker">Privacy policy</div>
          <h1 className="display mt-2 text-4xl leading-tight sm:text-5xl">
            Podmínky používání a ochrana soukromí
          </h1>
          <p className="mt-4 text-sm leading-6 text-[color:var(--muted)] sm:text-base">
            Platné pro aplikaci SkinTrack CS2. Poslední aktualizace: 6. 6. 2026.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="surface p-5 sm:p-6">
            <h2 className="text-lg font-black">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {section.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
