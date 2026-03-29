# Capstone Progress Tracking System

This Next.js app stores backlog data in PostgreSQL through `DATABASE_URL`.

For local development, the app now uses file storage by default so `localhost` stays fast even when your remote database is slow or offline.

## Neon Setup

Use one Neon database so both environments read and write the same data:

1. Create a Neon project and copy the pooled connection string.
2. In `my-app/.env.local`, set:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-xxxx-pooler.region.aws.neon.tech/DATABASE?sslmode=require
```

3. In Vercel, open your project settings and add the same `DATABASE_URL` value for:
   - `Production`
   - `Preview`
   - `Development` (optional but useful for Vercel local workflows)

After that:

- `npm run dev` on your computer uses Neon.
- Your Vercel deployment uses the same Neon database.
- Changes made locally appear in the deployed site because both environments share one database.

## Local Development

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Local data is saved in `my-app/.data/*.json` while developing.

If you want to use PostgreSQL locally instead of file storage, set this in `my-app/.env.local`:

```bash
LOCAL_STORAGE_MODE=database
```

### Windows PowerShell note

If PowerShell blocks `npm` with an execution policy error, use one of these instead:

```bash
npm.cmd run dev
```

Or from the repository root:

```bash
start-frontend.cmd
```

To stop the local frontend on port `3000` from the repository root:

```bash
stop-frontend.cmd
```

## Notes

- `lib/db.ts` automatically enables SSL for Neon and other remote Postgres hosts.
- The backlog table is created automatically on first API use.
- If you want separate databases later, use a different `DATABASE_URL` locally than the one stored in Vercel.
