# Backend

Separate Node.js backend for the capstone system.

## Structure

- `src/config`: environment and database configuration
- `src/repositories`: data access layer
- `src/routes`: HTTP route handlers
- `src/server.js`: backend entry point

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `backend/.env` from `backend/.env.example`

3. Start the backend:

```bash
npm run dev
```

The backend runs on `http://localhost:4000` by default.

## API

- `GET /api/health`
- `GET /api/backlog-items`
- `POST /api/backlog-items`
- `PATCH /api/backlog-items/:id`
- `DELETE /api/backlog-items/:id`

## Notes

- In development, the repository falls back to `.data/backlog-items.json` if PostgreSQL is unavailable.
- Set `FRONTEND_ORIGIN` to your Next.js frontend URL for CORS.
