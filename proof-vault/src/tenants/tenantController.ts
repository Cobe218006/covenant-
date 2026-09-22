import { Request, Response } from "express";
import { z } from "zod";
import { withTenant } from "../db/pool";
import { hashPassword } from "../auth/password";
import { Role } from "../middleware/requireRole";

export async function listMembers(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const members = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT u.id, u.email, u.full_name, u.status, array_agg(r.role) AS roles
       FROM users u
       LEFT JOIN roles r ON r.user_id = u.id AND r.tenant_id = u.tenant_id
       WHERE u.tenant_id = $1
       GROUP BY u.id
       ORDER BY u.created_at`,
      [tenantId]
    );
    return rows;
  });
  res.json(members);
}

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200),
  role: z.enum(["admin", "analyst", "auditor", "viewer"]), // 'owner' is not invite-able; see transferOwnership below
  temporaryPassword: z.string().min(12).max(200),
});

export async function inviteMember(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const { email, fullName, role, temporaryPassword } = parsed.data;
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const result = await withTenant(tenantId, async (client) => {
      const userRes = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, full_name, status)
         VALUES ($1, $2, $3, $4, 'invited') RETURNING id`,
        [tenantId, email, passwordHash, fullName]
      );
      const userId: string = userRes.rows[0].id;
      await client.query("INSERT INTO roles (tenant_id, user_id, role, granted_by) VALUES ($1, $2, $3, $4)", [
        tenantId,
        userId,
        role,
        req.session.userId,
      ]);
      return { userId };
    });
    res.status(201).json(result);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "conflict", detail: "email already in tenant" });
    throw err;
  }
}

const removeRoleSchema = z.object({
  role: z.enum(["owner", "admin", "analyst", "auditor", "viewer"] as [Role, ...Role[]]),
});

/**
 * Removing a role must never leave a tenant with zero owners — this is
 * the cross-row invariant noted in 002_rbac.sql that Postgres CHECK
 * constraints can't express directly, so it is enforced here, inside the
 * same transaction as the delete, to close the race window.
 */
export async function removeMemberRole(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const targetUserId = req.params.userId;
  const parsed = removeRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const { role } = parsed.data;

  try {
    await withTenant(tenantId, async (client) => {
      if (role === "owner") {
        const { rows } = await client.query(
          "SELECT count(*)::int AS n FROM roles WHERE tenant_id = $1 AND role = 'owner'",
          [tenantId]
        );
        if (rows[0].n <= 1) {
          throw Object.assign(new Error("last_owner"), { httpStatus: 409 });
        }
      }
      await client.query("DELETE FROM roles WHERE tenant_id = $1 AND user_id = $2 AND role = $3", [
        tenantId,
        targetUserId,
        role,
      ]);
    });
    res.status(204).end();
  } catch (err: any) {
    if (err?.httpStatus === 409) return res.status(409).json({ error: "cannot_remove_last_owner" });
    throw err;
  }
}
