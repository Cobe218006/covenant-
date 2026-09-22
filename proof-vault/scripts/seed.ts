import { withSystemClient, pool } from "../src/db/pool";
import { hashPassword } from "../src/auth/password";

async function seed() {
  const passwordHash = await hashPassword("DemoPassword123!");

  const result = await withSystemClient(async (client) => {
    const tenantRes = await client.query(
      `INSERT INTO tenants (name, slug) VALUES ('Acme Freight Demo', 'acme-freight-demo')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    const tenantId = tenantRes.rows[0].id;

    const userRes = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, status)
       VALUES ($1, 'owner@acme-demo.test', $2, 'Demo Owner', 'active')
       ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [tenantId, passwordHash]
    );
    const userId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO roles (tenant_id, user_id, role) VALUES ($1, $2, 'owner')
       ON CONFLICT (tenant_id, user_id, role) DO NOTHING`,
      [tenantId, userId]
    );

    return { tenantId, userId };
  });

  console.log("Seeded demo tenant:");
  console.log("  tenant slug:  acme-freight-demo");
  console.log("  login email:  owner@acme-demo.test");
  console.log("  password:     DemoPassword123!");
  console.log("  tenantId:", result.tenantId);
  console.log("  userId:  ", result.userId);

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
