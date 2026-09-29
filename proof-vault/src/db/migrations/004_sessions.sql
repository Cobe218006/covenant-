-- Phase 1 / Foundation — session storage
-- Schema required by connect-pg-simple. This is infrastructure, not
-- tenant business data, so it intentionally has NO RLS policy and no
-- tenant_id column — a session's tenant scoping lives inside its JSON
-- payload (req.session.tenantId), set only after successful login.
CREATE TABLE "session" (
  "sid"    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  "sess"   JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
