# Proof Vault — Phase 2: Evidence

> Proof Vault provides evidence, provenance, verification, and policy
> infrastructure. It does not itself provide credit, financing, lending,
> factoring approval, or financial settlement.

Phase 1 (**Foundation**) built project setup, PostgreSQL persistence,
authentication, the tenant model, Row-Level Security, and RBAC. Phase 2
(**Evidence**) adds the first real domain on top of it: evidence records
(a file + its content hash), pluggable object storage, hash-based
verification, and an append-only Evidence Audit Log (EAL). Policy,
disputes, transactions, and everything past that are still Phase 3+.

## Stack

- Node.js + TypeScript + Express
- PostgreSQL 14+ (RLS, `pgcrypto`, `citext`)
- Argon2id password hashing (`argon2`)
- Server-side sessions in Postgres (`express-session` + `connect-pg-simple`)
- `zod` for request validation
- `multer` (memory storage) for evidence file uploads
- Pluggable evidence storage: local filesystem (default) or any
  S3-compatible object store (`@aws-sdk/client-s3`)

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

Confirm tenant isolation is actually enforced at the database layer (not
just declared in SQL that might be silently bypassed by a superuser
connection role), and that the Evidence Audit Log is genuinely append-only:

```bash
npm test   # runs tests/rls.smoke.ts, then tests/evidence.smoke.ts
```

`rls.smoke.ts` creates two throwaway tenants, confirms a session scoped to
tenant A can see its own row but gets **zero rows** (not an error, not
leaked data) when it tries to read tenant B's row directly by id, and
confirms an unauthenticated connection can resolve a tenant by id/slug
(needed for login) but sees nothing on `users`.

`evidence.smoke.ts` creates two tenants' evidence records via the real
hash-and-store path, confirms tenant A cannot see tenant B's evidence or
audit log rows, and confirms `evidence_audit_log` rejects `UPDATE` and
`DELETE` outright (not just via missing routes — the database itself
refuses).

## API surface

| Method | Path                              | Auth              | Purpose                                    |
|--------|------------------------------------|-------------------|---------------------------------------------|
| POST   | `/api/auth/signup`                | none              | Create a new tenant + owner user             |
| POST   | `/api/auth/login`                 | none              | `{ tenantSlug, email, password }`            |
| POST   | `/api/auth/logout`                | session           | Destroy session                              |
| GET    | `/api/auth/me`                    | session           | Current user + tenant + roles                |
| GET    | `/api/tenant/members`             | session           | List members of the current tenant           |
| POST   | `/api/tenant/members`             | owner/admin       | Invite a member with a role                  |
| DELETE | `/api/tenant/members/:id/roles`   | owner/admin       | Remove a role (blocks removing last owner)   |
| POST   | `/api/evidence`                   | owner/admin/analyst | Upload a file (`multipart/form-data`, field `file`) + `title`/`description`; hashes + stores it |
| GET    | `/api/evidence`                   | session           | List evidence for the current tenant         |
| GET    | `/api/evidence/:id`                | session           | Evidence metadata (logs `viewed`)            |
| GET    | `/api/evidence/:id/download`       | session           | Download the original bytes (logs `downloaded`) |
| GET    | `/api/evidence/:id/verify`         | session           | Re-hash stored bytes vs. recorded hash (logs `hash_verified`/`hash_mismatch`) |
| GET    | `/api/evidence/:id/audit-log`      | owner/admin/auditor | Full EAL history for one evidence record   |
| DELETE | `/api/evidence/:id`                | owner/admin       | Soft-delete (row + audit trail retained)     |

## What's deliberately NOT here yet

Per the manifest's build order, none of the following exist yet — they
are Phase 3 onward and should be added as new `src/<domain>/` modules +
new numbered migrations, following the exact patterns established here
(tenant-scoped queries only via `withTenant`, RLS policy added in the
same PR as the table):

- Disputes / policy engine / audit chain (Phase 3)
- Transactions / VTR / REP / payment status (Phase 4)
- Dashboard / registry UI (Phase 5)
- AI extraction / search / cost governor (Phase 6)
- External provider adapters / Bulla adapter (Phase 7)

## Golden rules already load-bearing in this phase

- Every tenant is isolated at the database layer (`003_rls_policies.sql`,
  `005_evidence.sql`, `tests/rls.smoke.ts`, `tests/evidence.smoke.ts`).
- Real authentication: Argon2id + sessions, never a bare `password_hash`
  column treated as sufficient on its own (`src/auth/password.ts`).
- Evidence integrity is verifiable, not assumed: every upload is
  content-hashed at ingest, and `/verify` can prove at any later point
  whether the stored bytes still match (`src/evidence/evidenceController.ts`).
- The Evidence Audit Log is append-only at the database layer, not just by
  convention — `UPDATE`/`DELETE` are rejected by a trigger, not merely
  unrouted (`005_evidence.sql`).
- Evidence storage is provider-agnostic behind `ObjectStore`
  (`src/storage/objectStore.ts`); the evidence domain code never talks to
  the filesystem or an S3 client directly.
- No paid AI provider is mandatory or contacted in this phase.
