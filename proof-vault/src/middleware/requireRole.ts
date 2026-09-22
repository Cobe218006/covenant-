import { NextFunction, Request, Response } from "express";
import { withTenant } from "../db/pool";

export type Role = "owner" | "admin" | "analyst" | "auditor" | "viewer";

/**
 * Phase 1 RBAC gate: confirms the session's user holds at least one of
 * `allowed` roles within their current tenant. Runs the check itself
 * inside withTenant so it, too, is subject to RLS — a bug here fails
 * closed (no rows => no access) rather than open.
 *
 * Phase 3's policy engine will supersede this for fine-grained,
 * resource-level authorization; this remains the coarse gate for
 * route-level access (e.g. "must be admin or owner to invite a user").
 */
export function requireRole(...allowed: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.tenantId) {
      return res.status(401).json({ error: "unauthenticated" });
    }
    try {
      const hasRole = await withTenant(req.session.tenantId, async (client) => {
        const { rows } = await client.query(
          "SELECT 1 FROM roles WHERE tenant_id = $1 AND user_id = $2 AND role = ANY($3) LIMIT 1",
          [req.session.tenantId, req.session.userId, allowed]
        );
        return rows.length > 0;
      });
      if (!hasRole) return res.status(403).json({ error: "forbidden", requiredRoles: allowed });
      next();
    } catch (err) {
      next(err);
    }
  };
}
