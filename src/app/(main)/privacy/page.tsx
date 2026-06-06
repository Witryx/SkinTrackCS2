import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podminky a privacy policy | SkinTrack CS2",
  description: "Podminky pouzivani a ochrana soukromi aplikace SkinTrack CS2.",
};

const sections = [
  {
    title: "1. Ucel aplikace",
    body: "SkinTrack CS2 je skolni webova aplikace pro sledovani cen, trendu, wishlistu a upozorneni u CS2 skinu. Data z externich marketu slouzi pouze k informativnimu porovnani.",
  },
  {
    title: "2. Ukladana data",
    body: "Aplikace uklada SteamID, verejne udaje ze Steam profilu, wishlist, nastaveni alertu, cenovou historii, notifikace a volitelny e-mail pro cenove alerty.",
  },
  {
    title: "3. Ochrana citlivych udaju",
    body: "Tajne API klice jsou ulozene v promennych prostredi mimo zdrojovy kod. E-mail pro alerty se uklada sifrovane pomoci AES-256-GCM a pro kontrolu duplicity se pouziva pouze HMAC hash.",
  },
  {
    title: "4. Lokalne ulozena data",
    body: "Frontend uklada do localStorage SteamID a preferenci motivu, aby zustalo prihlaseni a vzhled zachovane mezi navstevami ve stejnem prohlizeci.",
  },
  {
    title: "5. Externi sluzby",
    body: "Aplikace komunikuje se Steamem, Skinportem a podle konfigurace take s CSFloat, DMarketem a e-mailovou sluzbou Resend. Tyto sluzby mohou zpracovavat pozadavky podle vlastnich pravidel.",
  },
  {
    title: "6. Omezeni odpovednosti",
    body: "Ceny a dostupnost skinu se rychle meni. SkinTrack CS2 negarantuje presnost dat a neslouzi jako financni doporuceni ani zavazna nabidka.",
  },
  {
    title: "7. Smazani dat",
    body: "Uzivatel muze odebrat polozky z wishlistu a smazat e-mail pro alerty. Pro smazani uctu nebo export dat kontaktujte spravce projektu.",
  },
];

export default function PrivacyPage() {
  return (
    <section className="container-max space-y-7 py-8 sm:py-10">
      <div className="market-stage p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="kicker">Privacy policy</div>
          <h1 className="display mt-2 text-4xl leading-tight sm:text-5xl">
            Podminky pouzivani a ochrana soukromi
          </h1>
          <p className="mt-4 text-sm leading-6 text-[color:var(--muted)] sm:text-base">
            Platne pro aplikaci SkinTrack CS2. Posledni aktualizace: 6. 6. 2026.
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
