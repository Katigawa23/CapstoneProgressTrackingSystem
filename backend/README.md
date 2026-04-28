## Backend Structure

This folder contains the Node.js server-side backend code for the app and now lives at the repository root instead of inside `my-app/`.

- `config/`: backend runtime configuration helpers
- `db/`: database connection utilities
- `repositories/`: persistence and data-access logic used by API routes
- `sql/`: SQL scripts and schema files

The Next.js/Vercel route entrypoints remain in `my-app/app/api/`, so deployment behavior is unchanged while the backend implementation stays separated from the frontend app code.

## Microsoft Auth Deployment

For local development and Vercel deployment, configure these environment variables:

- `APP_URL`
- `NEXT_PUBLIC_APP_URL` (optional alias)
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `AUTH_SECRET`

Examples:

- Local `APP_URL`: `http://localhost:3000`
- Vercel `APP_URL`: `https://progress-tracking-gamma.vercel.app`
- Vercel `MICROSOFT_CLIENT_ID`: your Microsoft app registration client ID
- Vercel `MICROSOFT_CLIENT_SECRET`: your Microsoft app registration client secret
- Vercel `AUTH_SECRET`: a separate long random secret for signing cookies

Microsoft Entra redirect URIs must include:

- `http://localhost:3000/api/auth/microsoft/callback`
- `https://progress-tracking-gamma.vercel.app/api/auth/microsoft/callback`
