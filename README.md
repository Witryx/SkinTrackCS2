# SkinTrack CS2

Next.js aplikace pro sledovani CS2 skinu, wishlist, cenove notifikace a e-mail alerty.

## Lokalni spusteni

1. Nainstaluj zavislosti:

```bash
npm install
```

2. Vytvor `.env` podle `.env.example` a nastav minimalne:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
STEAM_API_KEY="..."
CRON_SECRET="..."
```

3. Aplikuj migrace a spust dev server:

```bash
npm run db:migrate
npm run dev
```

## Nasazeni na Vercel

Projekt je pripraveny pro Vercel pres `vercel.json`.

### Krok za krokem

1. Nahraj projekt na GitHub.

```bash
git add .
git commit -m "Prepare Vercel deploy"
git push
```

2. Otevri Vercel Dashboard a dej `Add New` -> `Project`.

3. Vyber GitHub repozitar s timhle projektem a klikni na `Import`.

4. Framework nech jako `Next.js`. Root Directory nech prazdny / root projektu. Build command se vezme z `vercel.json`:

```bash
npm run vercel-build
```

5. Dej prvni `Deploy`. Pokud spadne kvuli chybejici `DATABASE_URL`, je to v poradku. Projekt uz tim bude ve Vercelu vytvoreny a pujde k nemu pripojit databaze.

6. Ve Vercelu otevri projekt -> `Storage` -> `Create Database`.

7. Vyber MySQL-kompatibilni databazi:

- doporuceno: `TiDB Cloud`
- alternativa: `PlanetScale`

8. Databazi pripoj ke stejnemu Vercel projektu. Integrace musi vytvorit env promennou `DATABASE_URL`.

9. Otevri projekt -> `Settings` -> `Environment Variables` a zkontroluj / pridej:

```bash
DATABASE_URL="mysql://..."
NEXT_PUBLIC_SITE_URL="https://nazev-projektu.vercel.app"
STEAM_API_KEY="..."
CRON_SECRET="dlouhy-nahodny-token"
RESEND_API_KEY="..."
EMAIL_FROM="SkinTrack <alerts@tvoje-domena.cz>"
```

`RESEND_API_KEY` a `EMAIL_FROM` jsou potreba jen pro realne e-maily. Bez nich web pojede, ale e-mail alerty se neposlou.

10. U env promennych vyber minimalne `Production`. Pokud chces testovat preview deploye, zapni i `Preview`.

11. Po nastaveni env promennych spust novy deploy:

- `Deployments`
- otevri posledni deployment
- `Redeploy`

Env promenny se na Vercelu projevi az v novem deployi.

12. Po uspesnem deployi otevri produkcni URL a otestuj:

- `/` nacte homepage
- `/wishlist` nacte wishlist
- Steam login pres tlacitko prihlaseni
- zvonecek s notifikacemi

13. Otestuj cron rucne z terminalu:

```bash
curl -H "Authorization: Bearer TVUJ_CRON_SECRET" https://nazev-projektu.vercel.app/api/skins/cron
```

Kdyz vrati JSON se sync vysledkem, automaticka aktualizace cen je pripravena.

### Databaze primo pres Vercel

Protoze projekt pouziva Prisma schema s `provider = "mysql"`, nejjednodussi varianta je ve Vercel Marketplace vybrat MySQL-kompatibilni databazi:

- doporuceno: TiDB Cloud
- alternativa: PlanetScale

Obe integrace umi pro Prisma nastavit `DATABASE_URL`. U TiDB Cloud ma URL tvar podobny:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:4000/DATABASE?sslaccept=strict"
```

Postgres integrace jako Neon, Supabase nebo Prisma Postgres by taky sly pouzit, ale znamenalo by to prepsat Prisma provider z `mysql` na `postgresql` a vytvorit nove migrace pro Postgres. Pro rychle nasazeni proto ber MySQL-kompatibilni databazi.

Ve Vercelu nastav Environment Variables:

- `DATABASE_URL` - produkcni MySQL databaze dostupna z internetu. Nepouzivej `localhost`.
- `NEXT_PUBLIC_SITE_URL` - finalni URL webu, napr. `https://skintrackcs2.vercel.app`.
- `STEAM_API_KEY` - Steam Web API key.
- `CRON_SECRET` - dlouhy nahodny token pro cron endpointy.
- `RESEND_API_KEY` a `EMAIL_FROM` - jen pokud maji fungovat realne e-maily.
- `CSFLOAT_API_KEY`, `CSFLOAT_INSPECT_API`, `DMARKET_PUBLIC_KEY`, `DMARKET_SECRET_KEY` - volitelne integrace.

Vercel build pouziva:

```bash
npm run vercel-build
```

Ten provede:

1. `prisma generate`
2. `prisma migrate deploy`
3. `next build`

Cron job je nastaveny v `vercel.json` na `/api/skins/cron` kazdych 6 hodin. Pokud je ve Vercelu nastavene `CRON_SECRET`, Vercel ho posle jako `Authorization: Bearer ...` a aplikace ho overi.

## Databaze

Aplikace pouziva Prisma + MySQL. Pro Vercel potrebujes hostovanou databazi, napr. Railway, PlanetScale, Aiven nebo jinou MySQL kompatibilni sluzbu.

Po prvnim deployi se migrace spusti automaticky v buildu. Pokud potrebujes migrace pustit rucne:

```bash
npm run db:migrate
```

## E-mail alerty

E-mail alerty pouzivaji Resend. Bez `RESEND_API_KEY` a `EMAIL_FROM` se e-maily neposilaji, ale aplikace dal normalne vytvari in-app notifikace.
