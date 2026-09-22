import { PoolClient } from "pg";

export type EvidenceAuditAction =
  | "created"
  | "viewed"
  | "downloaded"
  | "hash_verified"
  | "hash_mismatch"
  | "deleted"
  | "restored";

/**
 * Appends one row to evidence_audit_log. Always call this on the same
 * `client` (and therefore the same withTenant transaction) as the action
 * it's recording, so the audit entry can never be committed without the
 * action it describes, or vice versa. The table itself is append-only at
 * the database layer (005_evidence.sql) -- there is no update/delete
 * counterpart to this function.
 */
export async function logEvidenceAudit(
  client: PoolClient,
  params: {
    tenantId: string;
    evidenceId: string;
    actorUserId: string;
    action: EvidenceAuditAction;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO evidence_audit_log (tenant_id, evidence_id, actor_user_id, action, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.tenantId, params.evidenceId, params.actorUserId, params.action, params.detail ?? null]
  );
}
