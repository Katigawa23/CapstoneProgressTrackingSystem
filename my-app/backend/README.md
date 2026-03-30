## Backend Structure

This folder contains the server-side backend code for the app.

- `config/`: backend runtime configuration helpers
- `db/`: database connection utilities
- `repositories/`: persistence and data-access logic used by API routes
- `sql/`: SQL scripts and schema files

The Next.js/Vercel route entrypoints remain in `app/api/`, so deployment behavior is unchanged.

## Microsoft Auth Deployment

For local development and Vercel deployment, configure these environment variables:

- `APP_URL`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `AUTH_SECRET`

Examples:

- Local `APP_URL`: `http://localhost:3000`
- Vercel `APP_URL`: `https://progress-tracking-gamma.vercel.app`

Microsoft Entra redirect URIs must include:

- `http://localhost:3000/dashboard/api/auth/microsoft/callback`
- `https://progress-tracking-gamma.vercel.app/dashboard/api/auth/microsoft/callback`
