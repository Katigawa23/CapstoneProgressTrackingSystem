# Capstone Progress Tracking System

This Next.js app stores backlog data in PostgreSQL through `DATABASE_URL`.

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

### Windows PowerShell note

If PowerShell blocks `npm` with an execution policy error, use one of these instead:

```bash
npm.cmd run dev
```

Or from the repository root:

```bash
start-frontend.cmd
```

## Notes

- `lib/db.ts` automatically enables SSL for Neon and other remote Postgres hosts.
- The backlog table is created automatically on first API use.
- If you want separate databases later, use a different `DATABASE_URL` locally than the one stored in Vercel.
