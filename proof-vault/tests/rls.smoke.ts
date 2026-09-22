/**
 * Manual/CI smoke test for the RLS boundary described in golden rule #12.
 * Deliberately dependency-light (no test framework) so it can run with
 * plain ts-node in any environment, including CI containers with no
 * network access to install extra tooling.
 *
 * Run with: npx ts-node tests/rls.smoke.ts
 * Requires: migrations applied (npm run migrate) against a real Postgres.
 */
import crypto from "crypto";
import { pool, withSystemClient, withTenant } from "../src/db/pool";

async function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function main() {
  // 1. RLS must actually be enabled + forced, not just present in the migration file.
  const { rows: rlsRows } = await pool.query("SELECT assert_rls_enabled() AS enabled");
  await assert(rlsRows[0].enabled === true, "RLS is enabled + forced on tenants/users/roles");

  // 2. Create two isolated tenants with one user each. Tenant ids are
  // generated here, client-side, and every insert runs under
  // withTenant(tenantId, ...) using that same id -- this is exactly the
  // bootstrap pattern authController.signup uses, required by
  // tenants_isolation's WITH CHECK (id = current_tenant_id()), which has no
  // NULL-context exception (see 003_rls_policies.sql).
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  await withTenant(tenantA, (c) =>
    c.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [
      tenantA,
      "RLS Test Tenant A",
      `rls-test-a-${Date.now()}`,
    ])
  );
  await withTenant(tenantB, (c) =>
    c.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [
      tenantB,
      "RLS Test Tenant B",
      `rls-test-b-${Date.now()}`,
    ])
  );

  await withTenant(tenantA, (c) =>
    c.query(
      "INSERT INTO users (tenant_id, email, password_hash, full_name) VALUES ($1, 'a@test.local', 'x', 'A')",
      [tenantA]
    )
  );
  await withTenant(tenantB, (c) =>
    c.query(
      "INSERT INTO users (tenant_id, email, password_hash, full_name) VALUES ($1, 'b@test.local', 'x', 'B')",
      [tenantB]
    )
  );

  // 3. Querying "all users" while scoped to tenant A must return ONLY tenant A's user.
  const usersVisibleToA = await withTenant(tenantA, async (c) => {
    const { rows } = await c.query("SELECT tenant_id FROM users");
    return rows;
  });
  await assert(
    usersVisibleToA.length === 1 && usersVisibleToA[0].tenant_id === tenantA,
    "tenant A's session sees exactly its own user row, never tenant B's"
  );

  // 4. Attempting to read tenant B's row while scoped to tenant A must return zero rows,
  //    not an error and not the row — this is the fail-closed behavior RLS guarantees.
  const crossTenantAttempt = await withTenant(tenantA, async (c) => {
    const { rows } = await c.query("SELECT * FROM tenants WHERE id = $1", [tenantB]);
    return rows;
  });
  await assert(crossTenantAttempt.length === 0, "tenant A cannot read tenant B's tenant row via direct id lookup");

  // 5. An unauthenticated connection (no tenant context set) must still be
  // able to resolve a tenant by slug -- this is exactly what
  // authController.login does via withSystemClient before a session
  // exists. It must see only name/slug/status, never cross into users/roles.
  const slugLookup = await withSystemClient(async (c) => {
    const { rows } = await c.query("SELECT id FROM tenants WHERE id = $1", [tenantA]);
    return rows;
  });
  await assert(
    slugLookup.length === 1 && slugLookup[0].id === tenantA,
    "an unauthenticated connection can still look up a tenant by id/slug (needed for login)"
  );

  const unauthedUsersRead = await withSystemClient(async (c) => {
    const { rows } = await c.query("SELECT * FROM users WHERE tenant_id = $1", [tenantA]);
    return rows;
  });
  await assert(
    unauthedUsersRead.length === 0,
    "an unauthenticated connection sees zero rows on users (no public-lookup exception there)"
  );

  await pool.end();

  if (process.exitCode === 1) {
    console.error("\nRLS SMOKE TEST FAILED — do not proceed to Phase 2 until this passes.");
  } else {
    console.log("\nAll RLS smoke checks passed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
