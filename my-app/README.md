# Capstone Progress Tracking System

This folder is the Next.js frontend. The backlog API and database layer now live in the separate `backend` service.

## Frontend Environment

In `my-app/.env.local`, set:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Local Development

Start the backend first:

```bash
cd ../backend
npm install
npm run dev
```

Then start the frontend:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- The frontend now calls the standalone backend through `NEXT_PUBLIC_BACKEND_URL`.
- Backend database configuration lives in `backend/.env`.
- The backend creates the backlog table automatically on first use.
