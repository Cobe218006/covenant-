-- Phase 1 / Foundation — RBAC
-- Deliberately simple for Phase 1: a fixed role enum per user, per tenant.
-- Phase 3 (Governance / policy engine) will layer fine-grained,
-- resource-level permissions on top of this — this table is the identity
-- layer RBAC checks are anchored to, not the final policy model.

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'analyst', 'auditor', 'viewer')),
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, role)
);

CREATE INDEX roles_tenant_user_idx ON roles (tenant_id, user_id);

-- Every tenant must always retain at least one 'owner'. Enforced at the
-- application layer on role removal (see tenants/tenantController.ts);
-- documented here since it is a hard invariant of the data model.
COMMENT ON TABLE roles IS
  'Invariant: every tenant must retain >=1 user with role=owner. Enforced in app layer, not DB constraint (cross-row invariant).';
