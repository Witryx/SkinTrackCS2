# SkinTrack CS2

Webová aplikace pro sledování CS2 skinů, cen, trendů, wishlistu a cenových alertů.

## Splnění požadavků

| Požadavek | Splnění v projektu |
| --- | --- |
| Programovací jazyk a framework | TypeScript, React a Next.js App Router |
| Databáze a její využití | MariaDB/MySQL přes Prisma ORM, modely `User`, `Skin`, `Shop`, `PriceHistory`, `Favorite`, `Notification` |
| Kontejnerizace | `Dockerfile` pro aplikaci a `docker-compose.yml` pro aplikaci + MariaDB |
| Responzivní design | Tailwind CSS, responzivní gridy a breakpointy pro desktop i mobil |
| Šifrování citlivých údajů | API klíče v env proměnných, e-mail pro alerty uložený pomocí AES-256-GCM, lookup přes HMAC hash |
| Nasazená aplikace | Aplikace je připravena pro Docker deployment nebo Vercel/Render deployment; produkční URL nastavte v `NEXT_PUBLIC_SITE_URL` |
| Podmínky používání / privacy policy | Stránka `/privacy` dostupná z patičky aplikace |

## Lokálně

1. Nainstalujte závislosti:

```bash
npm install
```

2. Vytvořte `.env` podle `.env.example` a nastavte minimálně:

```bash
DATABASE_URL="mysql://skinner:skinnerpass@localhost:3306/skinner"
DOCKER_DATABASE_URL="mysql://skinner:skinnerpass@mariadb:3306/skinner"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
APP_ENCRYPTION_KEY="..."
```

Klíč pro šifrování vygenerujete:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

3. Spusťte databázi:

```bash
docker compose up -d mariadb
```

4. Aplikujte migrace a spusťte aplikaci:

```bash
npm run db:migrate
npm run dev
```

Aplikace poběží na `http://localhost:3000`.

## Docker

Pro kompletní běh aplikace i databáze:

```bash
docker compose up --build
```

Compose spustí:

- `app` na portu `3000`
- `mariadb` na portu `3306`
- automatické `prisma migrate deploy` při startu kontejneru aplikace

## Produkční nasazení

Pro produkci nastavte tyto proměnné prostředí v hostingu:

- `DATABASE_URL`
- `DOCKER_DATABASE_URL` pro Docker Compose, pokud se liší od defaultní MariaDB služby
- `NEXT_PUBLIC_SITE_URL`
- `APP_ENCRYPTION_KEY`
- volitelně `STEAM_API_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `CSFLOAT_API_KEY`, `DMARKET_PUBLIC_KEY`, `DMARKET_SECRET_KEY`

Po nasazení spusťte migrace:

```bash
npm run db:migrate
```

Build:

```bash
npm run build
npm run start
```

### Vercel Cron

Projekt obsahuje `vercel.json` s cronem:

```json
{
  "path": "/api/skins/cron",
  "schedule": "0 3 * * *"
}
```

To znamená jednou denně ve 03:00 UTC. Vercel Hobby plán nepovolí častější cron typu `0 */6 * * *`, proto musí být schedule maximálně jednou denně. Pokud je cron nastavený i ve Vercel dashboardu, změňte ho tam na stejnou hodnotu nebo ho smažte a nechte konfiguraci z repozitáře.
