# SkinTrack CS2

Webova aplikace pro sledovani CS2 skinu, cen, trendu, wishlistu a cenovych alertu.

## Splneni pozadavku

| Pozadavek | Splneni v projektu |
| --- | --- |
| Programovaci jazyk a framework | TypeScript, React a Next.js App Router |
| Databaze a jeji vyuziti | MariaDB/MySQL pres Prisma ORM, modely `User`, `Skin`, `Shop`, `PriceHistory`, `Favorite`, `Notification` |
| Kontejnerizace | `Dockerfile` pro aplikaci a `docker-compose.yml` pro aplikaci + MariaDB |
| Responzivni design | Tailwind CSS, responzivni gridy a breakpointy pro desktop i mobil |
| Sifrovani citlivych udaju | API klice v env promennych, e-mail pro alerty ulozeny pomoci AES-256-GCM, lookup pres HMAC hash |
| Nasazena aplikace | Aplikace je pripravena pro Docker deployment nebo Vercel/Render deployment; produkcni URL nastavte v `NEXT_PUBLIC_SITE_URL` |
| Podminky pouzivani / privacy policy | Stranka `/privacy` dostupna z paticky aplikace |

## Lokalne

1. Nainstalujte zavislosti:

```bash
npm install
```

2. Vytvorte `.env` podle `.env.example` a nastavte minimalne:

```bash
DATABASE_URL="mysql://skinner:skinnerpass@localhost:3306/skinner"
DOCKER_DATABASE_URL="mysql://skinner:skinnerpass@mariadb:3306/skinner"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
APP_ENCRYPTION_KEY="..."
```

Klic pro sifrovani vygenerujete:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

3. Spustte databazi:

```bash
docker compose up -d mariadb
```

4. Aplikujte migrace a spustte aplikaci:

```bash
npm run db:migrate
npm run dev
```

Aplikace pobezi na `http://localhost:3000`.

## Docker

Pro kompletni beh aplikace i databaze:

```bash
docker compose up --build
```

Compose spusti:

- `app` na portu `3000`
- `mariadb` na portu `3306`
- automaticke `prisma migrate deploy` pri startu kontejneru aplikace

## Produkcni nasazeni

Pro produkci nastavte tyto promenne prostredi v hostingu:

- `DATABASE_URL`
- `DOCKER_DATABASE_URL` pro Docker Compose, pokud se lisi od defaultni MariaDB sluzby
- `NEXT_PUBLIC_SITE_URL`
- `APP_ENCRYPTION_KEY`
- volitelne `STEAM_API_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `CSFLOAT_API_KEY`, `DMARKET_PUBLIC_KEY`, `DMARKET_SECRET_KEY`

Po nasazeni spustte migrace:

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

To znamena jednou denne ve 03:00 UTC. Vercel Hobby plan nepovoli castejsi cron typu `0 */6 * * *`, proto musi byt schedule maximalne jednou denne. Pokud je cron nastaveny i ve Vercel dashboardu, zmente ho tam na stejnou hodnotu nebo ho smazte a nechte konfiguraci z repozitare.
