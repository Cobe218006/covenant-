# AEO 9 — real accounts + database

This is the real, server-backed version of AEO 9: Next.js 16 + Postgres
(via Prisma) + Auth.js v5, replacing the single-file `aeo9.html` app's
localStorage-only persistence. Progress and accounts live in a real
database, so they follow you across any browser or device you sign into —
which a static HTML file can never do — and Google/Microsoft/GitHub sign-in
work for real, because there's now a server to hold the OAuth secrets.

Scope of this first pass: accounts (password + OAuth) and lesson progress
that persists. The single-file app's other features (assessments, voice
training, credentials, AI Visibility Lab, etc.) aren't ported yet.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and
   `AUTH_SECRET` at minimum (see `.env.example` for how to get each value,
   including the exact steps for registering Google/GitHub/Microsoft OAuth
   apps if you want those too — they're optional for a first run).
3. `npx prisma migrate dev` — creates the schema in your database.
4. `npx prisma db seed` — loads the curriculum (5 courses, ported from the
   original single-file app).
5. `npm run dev` — open http://localhost:3000.

Email/password sign-up works immediately with just `DATABASE_URL` and
`AUTH_SECRET` set. Each OAuth provider (Google/GitHub/Microsoft) only
appears functional once its own two env vars are filled in — omitting one
doesn't break the others or the password flow.

## Deploying

This needs real hosting (unlike the single-file app) since it has a server.
Vercel is the natural fit for Next.js. Whichever host you use, set
`AUTH_URL` to the real deployed URL and add that same URL's callback paths
to each OAuth app's allowed redirect URIs (see `.env.example`) — OAuth
providers reject callbacks to URLs they don't recognize.
