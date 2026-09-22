-- Phase 1 / Foundation
-- Core tenant model + user identity. Every subsequent evidence, policy,
-- transaction and audit table (Phase 2+) will carry a tenant_id FK that
-- follows this same pattern.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           CITEXT,
  -- CITEXT requires the citext extension; fall back to lower(email) unique
  -- index if the extension is unavailable in your environment (see below).
  password_hash   TEXT NOT NULL,          -- argon2id hash, never plaintext or a raw column of "password"
  full_name       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'invited', 'disabled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One email per tenant (multi-tenant: the same email MAY exist in two
-- different tenants — that is intentional, not a bug).
CREATE UNIQUE INDEX users_tenant_email_uidx ON users (tenant_id, email);

CREATE INDEX users_tenant_idx ON users (tenant_id);

CREATE TRIGGER tenants_set_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
-- trigger_set_updated_at is defined in 000_functions.sql, which must run
-- before this file — see migrate.ts for enforced ordering.

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
