-- Phase 1 / Foundation — Row-Level Security
-- Golden rule #12: every tenant is isolated at the database layer.
-- This is enforced HERE, not in application query filters. Every table that
-- carries a tenant_id column must have RLS enabled + a policy in this file.
-- Phase 2+ tables (evidence, transactions, disputes, audit_log, ...) must
-- add their own policy here following the exact same pattern.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY; -- applies even to the table owner

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

-- tenants: baseline policy is strict and applies to every command --
-- INSERT/UPDATE/DELETE always require a real, matching tenant context (no
-- NULL-context exception), so an unauthenticated connection can never
-- create, modify, or delete a tenant row it doesn't already have the id
-- for. Signup satisfies this by generating the tenant id client-side and
-- running the whole bootstrap transaction under withTenant(newTenantId,
-- ...), so id = current_tenant_id() holds for its INSERT -- see
-- authController.signup.
CREATE POLICY tenants_isolation ON tenants
  USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());

-- tenants: a second, SELECT-only permissive policy (PostgreSQL ORs
-- multiple permissive policies together for the commands they apply to),
-- so it only ever widens what SELECT can see -- INSERT/UPDATE/DELETE stay
-- governed solely by tenants_isolation above. This lets an unauthenticated
-- connection (current_tenant_id() IS NULL) read tenants rows -- name/slug/
-- status only, no per-tenant business data -- which login needs to resolve
-- tenantSlug -> tenantId via withSystemClient before any tenant context
-- exists (see authController.login: "reveals only that a slug exists").
CREATE POLICY tenants_public_lookup ON tenants
  FOR SELECT
  USING (current_tenant_id() IS NULL);

-- users: strictly tenant-scoped, no exceptions -- unlike tenants, this
-- table holds emails and password hashes. Always accessed via
-- withTenant(tenantId, ...), signup included (see authController.signup).
CREATE POLICY users_isolation ON users
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- roles: strictly tenant-scoped, no exceptions.
CREATE POLICY roles_isolation ON roles
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Sanity check function used by tests/rls.smoke.ts: confirms RLS is not
-- silently disabled (e.g. by a superuser connection role) in this environment.
CREATE OR REPLACE FUNCTION assert_rls_enabled()
RETURNS BOOLEAN AS $$
  SELECT bool_and(relrowsecurity AND relforcerowsecurity)
  FROM pg_class
  WHERE relname IN ('tenants', 'users', 'roles');
$$ LANGUAGE sql STABLE;
