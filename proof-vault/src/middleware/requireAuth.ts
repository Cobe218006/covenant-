import { NextFunction, Request, Response } from "express";

/**
 * Confirms the request carries an authenticated session. Does NOT by
 * itself grant any tenant-scoped data access — that only happens once a
 * handler calls withTenant(req.session.tenantId, ...), which is where RLS
 * takes over as the real enforcement boundary.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.tenantId) {
    return res.status(401).json({ error: "unauthenticated" });
  }
  next();
}
