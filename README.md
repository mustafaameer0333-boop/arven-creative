# ARVÉN Creative — Production Store

Production-ready starter for the ARVÉN Creative digital storefront: Express + TypeScript + Prisma + PostgreSQL, authoritative server-side catalog pricing, order lifecycle, payment verification adapters, inventory, automatic delivery, admin dashboard, support tickets, audit logs, Telegram notifications, and Docker deployment.

## Included

- `index.html` — production storefront.
- `public/admin.html` — admin dashboard.
- `src/` — API/server/services.
- `prisma/schema.prisma` — PostgreSQL schema.
- `prisma/catalog.json` — 423 seeded products from the current storefront.
- `Dockerfile` + `docker-compose.yml` — container deployment.
- `.env.example` — production environment template.

## Important production rule

Do not put Telegram, Binance Pay, Resend, database, JWT, or encryption secrets in the frontend. Keep them only in the server environment.

## Local / first deployment

1. Copy `.env.example` to `.env`.
2. Replace every placeholder secret/password/domain.
3. Set a real PostgreSQL `DATABASE_URL`.
4. Run:

```bash
npm install
npx prisma generate
npm run db:deploy
npm run db:seed
npm run build
npm run start:prod
```

5. Check `https://YOUR-DOMAIN/health`.
6. Open `/admin` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Docker deployment

```bash
cp .env.example .env
# edit .env

docker compose build
docker compose up -d db

docker compose run --rm app npx prisma db push
docker compose run --rm app npm run db:seed
docker compose up -d app
```

After deployment:

- Store: `https://YOUR-DOMAIN/`
- Admin: `https://YOUR-DOMAIN/admin`
- Health: `https://YOUR-DOMAIN/health`
- Binance webhook: `https://YOUR-DOMAIN/api/payments/binance/webhook`

Put HTTPS in front of the app using your hosting provider/reverse proxy. Do not expose PostgreSQL publicly.

## Payments

### USDT TRC20

Set `TRON_RECEIVING_ADDRESS` and `TRONGRID_API_KEY`. The verifier queries TronGrid's TRC20 account history, filters for the official USDT TRC20 contract, requires confirmed transfers, checks the transaction hash, and matches the received amount to the server order total.

The current implementation uses `only_confirmed=true`; `TRC20_MIN_CONFIRMATIONS` is retained as configuration metadata but an exact numeric confirmation count is not calculated.

Keep `PAYMENT_AUTO_VERIFY=false` until the production payment flow has been tested.

### Binance Pay

Set:

- `BINANCE_PAY_API_KEY`
- `BINANCE_PAY_SECRET_KEY`
- `BINANCE_PAY_CERTIFICATE_SN`
- `BINANCE_PAY_BASE_URL=https://bpay.binanceapi.com`

The server signs Merchant API requests with HMAC-SHA512. Binance Pay credentials never belong in client-side JavaScript.

The current verification path expects a Binance Merchant Trade Number created through the merchant flow and then queries its status before accepting payment. The webhook is signature-checked and timestamp-checked before processing.

## Inventory and delivery

Admin → Products/inventory → add one digital credential per line.

If `DELIVERY_ENCRYPTION_KEY` is set, inventory values are encrypted with AES-256-GCM at rest. Generate a key with:

```bash
openssl rand -hex 32
```

If Resend is configured, verified orders with complete stock are emailed automatically. Otherwise the delivery remains recorded in the database/admin workflow.

## Security hardening included

- Server-authoritative product prices.
- Randomized order IDs.
- Admin JWT in an HttpOnly cookie.
- Login and payment-verification rate limits.
- Helmet security headers.
- Request-size limit.
- Binance webhook raw-body signature verification.
- Binance webhook timestamp freshness check.
- Duplicate TXID protection.
- Atomic inventory claiming to reduce double-sale races.
- Graceful shutdown and health check.
- No production secrets in the storefront.

## Before opening sales

- Use HTTPS.
- Use managed PostgreSQL with automated backups.
- Rotate/revoke any old Telegram token that was ever exposed in the previous frontend.
- Create a fresh Telegram bot token and keep it only in `.env`.
- Use a unique admin password and JWT secret.
- Configure your payment provider credentials.
- Add real inventory.
- Test successful payment, wrong amount, duplicate transaction, replayed webhook, insufficient stock, email delivery, admin login, and cancellation/refund procedures.
- Keep `PAYMENT_AUTO_VERIFY=false` until those tests pass; then enable it deliberately.
