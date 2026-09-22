/**
 * Manual/CI smoke test for Phase 2: confirms evidence + evidence_audit_log
 * are tenant-isolated at the database layer (same guarantee rls.smoke.ts
 * checks for Phase 1's tables), and that the audit log is genuinely
 * append-only -- rejected by the database itself, not just unrouted.
 *
 * Run with: npx ts-node tests/evidence.smoke.ts
 * Requires: migrations applied (npm run migrate) against a real Postgres,
 * and the configured ObjectStore (STORAGE_DRIVER) reachable.
 */
import crypto from "crypto";
import { pool, withTenant } from "../src/db/pool";
import { getObjectStore, buildObjectKey } from "../src/storage/objectStore";
import { logEvidenceAudit } from "../src/evidence/auditLog";

async function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${msg}`);
  }
}

async function createTestEvidence(tenantId: string, userId: string, content: string) {
  const evidenceId = crypto.randomUUID();
  const buffer = Buffer.from(content, "utf8");
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const store = getObjectStore();
  const storageKey = buildObjectKey(tenantId, evidenceId, "note.txt");

  await store.put(storageKey, buffer, "text/plain");

  await withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO evidence
         (id, tenant_id, title, content_hash, hash_algorithm, mime_type, size_bytes, storage_driver, storage_key, created_by)
       VALUES ($1, $2, 'Smoke test evidence', $3, 'sha256', 'text/plain', $4, $5, $6, $7)`,
      [evidenceId, tenantId, contentHash, buffer.length, store.driver, storageKey, userId]
    );
    await logEvidenceAudit(client, { tenantId, evidenceId, actorUserId: userId, action: "created" });
  });

  return { evidenceId, storageKey, contentHash };
}

async function main() {
  const { rows: rlsRows } = await pool.query("SELECT assert_rls_enabled() AS enabled");
  await assert(
    rlsRows[0].enabled === true,
    "RLS is enabled + forced on tenants/users/roles/evidence/evidence_audit_log"
  );

  // Bootstrap two throwaway tenants + one user each, exactly like
  // rls.smoke.ts, since evidence rows need a real created_by user.
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();

  await withTenant(tenantA, (c) =>
    c.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [
      tenantA,
      "Evidence Smoke Tenant A",
      `evidence-smoke-a-${Date.now()}`,
    ])
  );
  await withTenant(tenantB, (c) =>
    c.query("INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)", [
      tenantB,
      "Evidence Smoke Tenant B",
      `evidence-smoke-b-${Date.now()}`,
    ])
  );
  await withTenant(tenantA, (c) =>
    c.query(
      "INSERT INTO users (id, tenant_id, email, password_hash, full_name) VALUES ($1, $2, 'a@evidence-smoke.local', 'x', 'A')",
      [userA, tenantA]
    )
  );
  await withTenant(tenantB, (c) =>
    c.query(
      "INSERT INTO users (id, tenant_id, email, password_hash, full_name) VALUES ($1, $2, 'b@evidence-smoke.local', 'x', 'B')",
      [userB, tenantB]
    )
  );

  const evidenceA = await createTestEvidence(tenantA, userA, "tenant A's evidence content");
  await createTestEvidence(tenantB, userB, "tenant B's evidence content");

  // Tenant A's session must see exactly its own evidence, never tenant B's.
  const evidenceVisibleToA = await withTenant(tenantA, async (c) => {
    const { rows } = await c.query("SELECT tenant_id FROM evidence");
    return rows;
  });
  await assert(
    evidenceVisibleToA.length === 1 && evidenceVisibleToA[0].tenant_id === tenantA,
    "tenant A's session sees exactly its own evidence row, never tenant B's"
  );

  // Same for the audit log.
  const auditVisibleToA = await withTenant(tenantA, async (c) => {
    const { rows } = await c.query("SELECT tenant_id FROM evidence_audit_log");
    return rows;
  });
  await assert(
    auditVisibleToA.length === 1 && auditVisibleToA[0].tenant_id === tenantA,
    "tenant A's session sees exactly its own audit log row, never tenant B's"
  );

  // Direct cross-tenant id lookup must return zero rows, not an error.
  const crossTenantAttempt = await withTenant(tenantA, async (c) => {
    const { rows } = await c.query("SELECT * FROM evidence WHERE id != $1", [evidenceA.evidenceId]);
    return rows;
  });
  await assert(crossTenantAttempt.length === 0, "tenant A cannot read any evidence row that isn't its own");

  // The stored bytes must round-trip and re-hash to the recorded hash --
  // this is the same check /api/evidence/:id/verify performs.
  const store = getObjectStore();
  const bytesBack = await store.get(evidenceA.storageKey);
  const rehash = crypto.createHash("sha256").update(bytesBack).digest("hex");
  await assert(
    rehash === evidenceA.contentHash,
    "stored bytes round-trip through the ObjectStore and re-hash to the recorded content hash"
  );

  // The audit log must be append-only: even a same-tenant UPDATE/DELETE,
  // run with valid tenant context, must be rejected by the trigger itself.
  let updateRejected = false;
  try {
    await withTenant(tenantA, (c) =>
      c.query("UPDATE evidence_audit_log SET action = 'viewed' WHERE tenant_id = $1", [tenantA])
    );
  } catch (err: any) {
    updateRejected = /append-only/.test(err?.message ?? "");
  }
  await assert(updateRejected, "evidence_audit_log rejects UPDATE at the database layer (append-only trigger)");

  let deleteRejected = false;
  try {
    await withTenant(tenantA, (c) => c.query("DELETE FROM evidence_audit_log WHERE tenant_id = $1", [tenantA]));
  } catch (err: any) {
    deleteRejected = /append-only/.test(err?.message ?? "");
  }
  await assert(deleteRejected, "evidence_audit_log rejects DELETE at the database layer (append-only trigger)");

  await pool.end();

  if (process.exitCode === 1) {
    console.error("\nEVIDENCE SMOKE TEST FAILED.");
  } else {
    console.log("\nAll evidence smoke checks passed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
