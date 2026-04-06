# Capstone Progress Tracking System – AI Agent Guidelines

## Code Style & TypeScript

- **Strict TypeScript**: `tsconfig.json` has `strict: true`. Use explicit types; don't rely on inference.
- **Path aliases**: Use `@/` prefix for root imports (e.g., `@/components/Button`, `@/lib/auth-client`).
- **React 19 + Next.js 16**: Functional components with hooks. Use `next/link` for navigation, `next/image` for assets.
- **Naming conventions**:
  - Components: **PascalCase** (`DashboardBoard.tsx`, `UserProfile.tsx`)
  - Hooks & utils: **camelCase** (`useDashboardProjects.ts`, `formatDate.ts`)
  - Database repositories: **`*-repository.ts`** suffix (e.g., `project-repository.ts`)
  - File names: **kebab-case** (e.g., `project-switcher.tsx`, `app-sidebar.tsx`)
- **ESLint**: Run `npm run lint` to check code. Config is Next.js 9 + ESLint enforces standards.

## Architecture

This is a **Next.js monorepo** combining frontend and backend in one application:

- **Frontend** (`app/`): React components with App Router route groups `(dashboard)` and `(public)`
- **Backend** (`backend/`): Node.js TypeScript with repository pattern for data access
- **API layer** (`app/api/`): Next.js route handlers that call repositories, organized by entity (projects, backlog-items, backlog-comments)
- **Storage**: Hybrid—**PostgreSQL** (production/Vercel), **JSON files** (local development, default)
- **Authentication**: Microsoft Entra (OAuth2) with custom session management

**Key directories**:
- `app/`: Next.js routes, layouts, API handlers
- `components/`: Reusable React components (UI from Shadcn, custom features in subdirectories)
- `hooks/`: Custom React hooks (`use-dashboard-projects.ts`, `use-mobile.ts`)
- `lib/`: Utilities & shared logic (`auth-client.ts`, `rbac.ts`, `role-context.tsx`)
- `backend/`: Server logic (`db/`, `repositories/`, `auth/`, `config/`, `sql/`)
- `types/`: Centralized TypeScript definitions

## Build and Test

From `my-app/`:

```bash
npm install                # Install dependencies
npm run dev               # Start dev server (localhost:3000, uses file storage by default)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

**Environment variables** (set in `my-app/.env.local`):

```bash
DATABASE_URL=postgresql://...  # Neon pooled connection (for prod/shared dev)
LOCAL_STORAGE_MODE=file         # "file" (dev, default) or "database" (prod)
MICROSOFT_CLIENT_ID=...         # Entra app registration
MICROSOFT_CLIENT_SECRET=...     
MICROSOFT_TENANT_ID=...         
APP_URL=http://localhost:3000   # Or deployed URL
AUTH_SECRET=...                 # Cookie signing
```

**Local development**: `npm run dev` starts Turbopack dev server. Data saves to `.data/` JSON files by default. To switch to PostgreSQL, set `LOCAL_STORAGE_MODE=database` and point `DATABASE_URL` to your Neon database.

**Windows PowerShell**: If `npm` is blocked by execution policy, use `npx npm` or adjust PowerShell execution policy.

## Conventions

### Component Organization

- **UI components** live in `components/ui/` (Shadcn exports, don't modify directly)
- **Feature components** in `components/` (e.g., `project-switcher.tsx`, `app-sidebar.tsx`)  
- **Route-specific components** in `app/(dashboard)/dashboard/components/` or similar
- Props interfaces: Define above component, export if reusable

### Data Access Layer (Repositories)

Repositories in `backend/repositories/` handle all database/file I/O:
- `project-repository.ts`: Create, list projects
- `backlog-repository.ts`: Backlog item CRUD
- `backlog-comment-repository.ts`: Comments
- `microsoft-login-repository.ts`: Auth user tracking

**Pattern**: Repositories abstract storage backend (PostgreSQL vs file). API routes call repositories and return JSON.

### Types & Interfaces

- Centralize domain types in feature-specific files (e.g., `dashboard/types.ts`)
- Use `interface` for object shapes, `type` for unions/tuples
- Export from `types/` if used across multiple features

### API Routes

- Validate input first
- Call appropriate repository
- Return `NextResponse.json()` or error with 5xx status
- Keep route handlers thin; logic belongs in repositories

## Key Files to Understand

- `next.config.ts`: Turbopack config
- `tsconfig.json`: Strict TypeScript, path aliases
- `backend/db/connection.ts`: PostgreSQL pool singleton, SSL auto-detect
- `backend/config/storage-mode.ts`: Hybrid storage router
- `lib/auth-client.ts`: Client-side auth helpers
- `backend/auth/microsoft.ts`: Microsoft Entra utilities

See [README.md](my-app/README.md) for Neon setup and [backend/README.md](my-app/backend/README.md) for auth environment variable details.

## Gotchas & Tips

1. **File storage in `.data/`**: Git-ignored. Local changes don't sync to deployed app—use Neon for shared data.
2. **Path aliases break at build time if misconfigured**: Double-check `tsconfig.json` `compilerOptions.paths` matches module resolution.
3. **Microsoft Entra redirect URI**: Must match your setup in portal (`http://localhost:3000/api/auth/microsoft/callback` for dev).
4. **PostgreSQL pools have max connections**: `backend/db/connection.ts` sets `max: 4` to avoid exhaustion in serverless; adjust if needed.
5. **Repositories return both status and data**: Check response shape before accessing properties.
6. **React 19 prop spreading**: Use explicit props; avoid `{...props}` for overriding critical props.
