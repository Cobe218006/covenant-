# Proof Vault — Phase 1: Foundation

> Proof Vault provides evidence, provenance, verification, and policy
> infrastructure. It does not itself provide credit, financing, lending,
> factoring approval, or financial settlement.

This is the **Foundation** phase of the full Proof Vault build (see the
build manifest / prompt for Phases 2–7): project setup, PostgreSQL
persistence, authentication, tenant model, Row-Level Security, and RBAC.
No evidence, verification, policy, transaction, or audit functionality
lives here yet — this phase exists to make everything after it provably
tenant-isolated from the ground up.

## Stack

- Node.js + TypeScript + Express
- PostgreSQL 14+ (RLS, `pgcrypto`, `citext`)
- Argon2id password hashing (`argon2`)
- Server-side sessions in Postgres (`express-session` + `connect-pg-simple`)
- `zod` for request validation

No paid AI provider is required or contacted anywhere in this phase.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create a local Postgres database
createdb proofvault
# or, with Docker:
# docker run --name proofvault-pg -e POSTGRES_USER=proofvault -e POSTGRES_PASSWORD=proofvault \
#   -e POSTGRES_DB=proofvault -p 5432:5432 -d postgres:16

# 3. Configure environment
cp .env.example .env
# generate a real session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste the output into SESSION_SECRET in .env

# 4. Run migrations
npm run migrate

# 5. (optional) seed a demo tenant + owner user
npm run seed

# 6. Start the dev server
npm run dev
```

Server listens on `http://localhost:4000` by default. Health check:
`GET /health`.

## Verifying the RLS boundary

Before building anything in Phase 2, confirm tenant isolation is actually
enforced at the database layer (not just declared in SQL that might be
silently bypassed by a superuser connection role):

```bash
npx ts-node tests/rls.smoke.ts
```

This creates two throwaway tenants, confirms a session scoped to tenant A
can see its own row but gets **zero rows** (not an error, not leaked data)
when it tries to read tenant B's row directly by id.

## API surface (Phase 1)

| Method | Path                              | Auth         | Purpose                                  |
|--------|------------------------------------|--------------|-------------------------------------------|
| POST   | `/api/auth/signup`                | none         | Create a new tenant + owner user          |
| POST   | `/api/auth/login`                 | none         | `{ tenantSlug, email, password }`         |
| POST   | `/api/auth/logout`                | session      | Destroy session                           |
| GET    | `/api/auth/me`                    | session      | Current user + tenant + roles             |
| GET    | `/api/tenant/members`             | session      | List members of the current tenant        |
| POST   | `/api/tenant/members`             | owner/admin  | Invite a member with a role               |
| DELETE | `/api/tenant/members/:id/roles`   | owner/admin  | Remove a role (blocks removing last owner)|

## What's deliberately NOT here yet

Per the manifest's build order, none of the following exist in this
phase — they are Phase 2 onward and should be added as new
`src/<domain>/` modules + new numbered migrations, following the exact
patterns established here (tenant-scoped queries only via `withTenant`,
RLS policy added in the same PR as the table):

- Evidence records / EAL engine / hashing (Phase 2)
- Disputes / policy engine / audit chain (Phase 3)
- Transactions / VTR / REP / payment status (Phase 4)
- Dashboard / registry UI (Phase 5)
- AI extraction / search / cost governor (Phase 6)
- External provider adapters / Bulla adapter (Phase 7)

## Golden rules already load-bearing in this phase

- Every tenant is isolated at the database layer (`003_rls_policies.sql`,
  `tests/rls.smoke.ts`).
- Real authentication: Argon2id + sessions, never a bare `password_hash`
  column treated as sufficient on its own (`src/auth/password.ts`).
- No paid AI provider is mandatory or contacted in this phase.
