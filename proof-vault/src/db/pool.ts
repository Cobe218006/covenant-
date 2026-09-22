import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

// Single shared pool for the whole process. RLS isolation happens per
// checked-out client (see withTenant / withSystemClient below), never by
// filtering in application code — the database is the enforcement boundary.
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

pool.on("error", (err) => {
  // Idle client errors should never crash the process silently.
  // eslint-disable-next-line no-console
  console.error("Unexpected error on idle Postgres client", err);
});

/**
 * Run `fn` inside a transaction on a dedicated client with the Postgres
 * session variable `app.current_tenant_id` set for the duration of the
 * transaction. Every RLS policy in 003_rls_policies.sql keys off this
 * setting, so this function is the ONLY sanctioned way tenant-scoped
 * queries should run in Proof Vault.
 *
 * Golden rule #12 (see manifest): every tenant is isolated at the
 * database layer, not in application logic — this helper is that boundary.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // set_config(..., true) scopes the setting to the current transaction
    // (LOCAL), so it cannot leak to the next query on a pooled connection.
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Escape hatch for genuinely tenant-less operations: signup (creating the
 * first tenant + owner), platform-level admin tooling, and migrations.
 * app.current_tenant_id is intentionally left unset, so RLS policies that
 * require it will deny all rows — this client can only touch tables that
 * explicitly allow a NULL tenant context (see migrations).
 */
export async function withSystemClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
