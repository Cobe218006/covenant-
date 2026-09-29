import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { withSystemClient, withTenant } from "../db/pool";
import { hashPassword, isPasswordStrongEnough, verifyPassword } from "./password";

const MAX_SLUG_ATTEMPTS = 20;

const signupSchema = z.object({
  tenantName: z.string().min(2).max(200),
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(12).max(200),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "tenant"
  );
}

/**
 * Signup creates a brand-new tenant AND its first user (role=owner) as a
 * single atomic operation. There is no existing tenant to scope to yet, so
 * the tenant id is generated here, client-side, and every query in this
 * function runs via withTenant(tenantId, ...) using that id from the
 * start — `tenants_isolation`'s WITH CHECK (003_rls_policies.sql) requires
 * id = current_tenant_id() for every insert, so this is what lets the
 * bootstrap writes satisfy RLS without any bypass of it.
 *
 * Slug collisions are handled by attempting the insert and retrying with
 * an incremented suffix on a unique_violation of tenants_slug_key, rather
 * than checking availability first — a pre-check would need to read across
 * tenants, which users_isolation/roles_isolation deliberately never allow,
 * and a check-then-insert has a TOCTOU race this doesn't.
 */
export async function signup(req: Request, res: Response) {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { tenantName, fullName, email, password } = parsed.data;

  if (!isPasswordStrongEnough(password)) {
    return res.status(400).json({ error: "weak_password" });
  }

  const passwordHash = await hashPassword(password);
  const baseSlug = slugify(tenantName);
  const tenantId = crypto.randomUUID();

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    try {
      const result = await withTenant(tenantId, async (client) => {
        await client.query("INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)", [
          tenantId,
          tenantName,
          slug,
        ]);

        const userRes = await client.query(
          `INSERT INTO users (tenant_id, email, password_hash, full_name, status)
           VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
          [tenantId, email, passwordHash, fullName]
        );
        const userId: string = userRes.rows[0].id;

        await client.query(
          "INSERT INTO roles (tenant_id, user_id, role) VALUES ($1, $2, 'owner')",
          [tenantId, userId]
        );

        return { userId };
      });

      req.session.userId = result.userId;
      req.session.tenantId = tenantId;

      return res.status(201).json({ tenantId, tenantSlug: slug, userId: result.userId });
    } catch (err: any) {
      if (err?.code === "23505") {
        if (err?.constraint === "tenants_slug_key") continue; // retry with next suffix
        // (tenant_id, email) race — extremely unlikely for a brand-new tenant id
        return res.status(409).json({ error: "conflict" });
      }
      throw err;
    }
  }

  return res.status(409).json({ error: "conflict", detail: "could not allocate a unique tenant slug" });
}

const loginSchema = z.object({
  tenantSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Login must locate the user's tenant BEFORE any tenant-scoped query can
 * run (nothing can be looked up "by RLS" with no tenant context set yet).
 * We resolve tenantSlug -> tenantId first (tenants table lookup is itself
 * RLS-protected per-row by id, but slug lookup for login is an intentional,
 * narrow exception — see comment below).
 */
export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { tenantSlug, email, password } = parsed.data;

  // Narrow, explicit exception: resolving "which tenant does this slug
  // belong to" is inherently a cross-tenant lookup users must be able to
  // do *before* authenticating. It reveals only that a slug exists, never
  // any tenant business data, and only via withSystemClient.
  const tenant = await withSystemClient(async (client) => {
    const { rows } = await client.query("SELECT id FROM tenants WHERE slug = $1 AND status = 'active'", [
      tenantSlug,
    ]);
    return rows[0] as { id: string } | undefined;
  });

  // Constant-shape response whether the tenant, email, or password was
  // wrong, so login cannot be used to enumerate tenants or accounts.
  const genericFailure = () => res.status(401).json({ error: "invalid_credentials" });

  if (!tenant) return genericFailure();

  const user = await withTenant(tenant.id, async (client) => {
    const { rows } = await client.query(
      "SELECT id, password_hash, status FROM users WHERE tenant_id = $1 AND email = $2",
      [tenant.id, email]
    );
    return rows[0] as { id: string; password_hash: string; status: string } | undefined;
  });

  if (!user || user.status !== "active") return genericFailure();

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) return genericFailure();

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "session_error" });
    req.session.userId = user.id;
    req.session.tenantId = tenant.id;
    res.json({ userId: user.id, tenantId: tenant.id });
  });
}

export function logout(req: Request, res: Response) {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "session_error" });
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
}

export async function me(req: Request, res: Response) {
  if (!req.session.userId || !req.session.tenantId) {
    return res.status(401).json({ error: "unauthenticated" });
  }
  const user = await withTenant(req.session.tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT u.id, u.email, u.full_name, u.status, t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
              array_agg(r.role) AS roles
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2
       GROUP BY u.id, t.id`,
      [req.session.userId, req.session.tenantId]
    );
    return rows[0];
  });
  if (!user) return res.status(401).json({ error: "unauthenticated" });
  res.json(user);
}
