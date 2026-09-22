-- Phase 2 — Evidence records + Evidence Audit Log (EAL)
-- Follows the exact pattern from Phase 1: tenant_id FK on every table,
-- RLS policy added in this same migration, strict tenant isolation (no
-- NULL-context exception -- unlike tenants in 003_rls_policies.sql,
-- evidence is never read before a session has a real tenant context).

CREATE TABLE evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  content_hash    TEXT NOT NULL,               -- hex digest, algorithm named below
  hash_algorithm  TEXT NOT NULL DEFAULT 'sha256'
                    CHECK (hash_algorithm IN ('sha256')),
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_driver  TEXT NOT NULL CHECK (storage_driver IN ('local', 's3')),
  storage_key     TEXT NOT NULL,                -- path/object key within that driver's store
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'deleted')),
  -- Evidence is provenance-bearing: who submitted it is part of the record
  -- itself, so a user row that created evidence cannot simply vanish out
  -- from under it (Phase 1 has no user-delete endpoint yet regardless).
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX evidence_tenant_idx ON evidence (tenant_id);
CREATE INDEX evidence_tenant_hash_idx ON evidence (tenant_id, content_hash);

CREATE TRIGGER evidence_set_updated_at
  BEFORE UPDATE ON evidence
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Evidence Audit Log (EAL): append-only record of every action taken
-- against an evidence record. "Append-only" is enforced below at the
-- database layer, not just by omitting UPDATE/DELETE routes in the app --
-- the same defense-in-depth spirit as RLS itself (golden rule #12).
CREATE TABLE evidence_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id     UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  -- SET NULL, not RESTRICT: the log entry is the durable record; it must
  -- survive even if the acting user's row is later removed.
  actor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL
                    CHECK (action IN (
                      'created', 'viewed', 'downloaded',
                      'hash_verified', 'hash_mismatch',
                      'deleted', 'restored'
                    )),
  detail          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX evidence_audit_log_tenant_evidence_idx
  ON evidence_audit_log (tenant_id, evidence_id, created_at);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'evidence_audit_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_audit_log_immutable
  BEFORE UPDATE OR DELETE ON evidence_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence FORCE ROW LEVEL SECURITY;

ALTER TABLE evidence_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY evidence_isolation ON evidence
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY evidence_audit_log_isolation ON evidence_audit_log
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Widen the existing RLS sanity check (000/003) to cover the new tables
-- too, rather than adding a second, easy-to-forget assertion function.
CREATE OR REPLACE FUNCTION assert_rls_enabled()
RETURNS BOOLEAN AS $$
  SELECT bool_and(relrowsecurity AND relforcerowsecurity)
  FROM pg_class
  WHERE relname IN ('tenants', 'users', 'roles', 'evidence', 'evidence_audit_log');
$$ LANGUAGE sql STABLE;
