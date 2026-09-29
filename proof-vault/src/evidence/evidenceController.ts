import crypto from "crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { withTenant } from "../db/pool";
import { buildObjectKey, getObjectStore } from "../storage/objectStore";
import { logEvidenceAudit } from "./auditLog";

const EVIDENCE_FIELDS = `id, title, description, content_hash, hash_algorithm, mime_type,
  size_bytes, status, created_by, created_at, updated_at`;

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
});

/**
 * Creates one evidence record from an uploaded file: hashes it (sha256),
 * writes the bytes to the configured ObjectStore, then inserts the DB row
 * inside the same withTenant transaction as the "created" audit entry.
 *
 * Bytes are written before the DB row exists. A crash in between leaves an
 * orphaned object with no DB row -- harmless, cheap to garbage-collect --
 * rather than a DB row that claims to have backing bytes that were never
 * written. If the DB insert itself then fails, the just-written object is
 * deleted again (best-effort) so it doesn't linger.
 */
export async function createEvidence(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const userId = req.session.userId!;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "invalid_input", details: "file is required" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const { title, description } = parsed.data;

  const contentHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const evidenceId = crypto.randomUUID();
  const store = getObjectStore();
  const storageKey = buildObjectKey(tenantId, evidenceId, file.originalname);

  await store.put(storageKey, file.buffer, file.mimetype);

  try {
    const evidence = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO evidence
           (id, tenant_id, title, description, content_hash, hash_algorithm,
            mime_type, size_bytes, storage_driver, storage_key, created_by)
         VALUES ($1, $2, $3, $4, $5, 'sha256', $6, $7, $8, $9, $10)
         RETURNING ${EVIDENCE_FIELDS}`,
        [
          evidenceId,
          tenantId,
          title,
          description ?? null,
          contentHash,
          file.mimetype,
          file.size,
          store.driver,
          storageKey,
          userId,
        ]
      );
      await logEvidenceAudit(client, {
        tenantId,
        evidenceId,
        actorUserId: userId,
        action: "created",
        detail: { originalName: file.originalname, sizeBytes: file.size },
      });
      return rows[0];
    });
    res.status(201).json(evidence);
  } catch (err) {
    await store.delete(storageKey).catch(() => undefined);
    throw err;
  }
}

export async function listEvidence(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const rows = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT ${EVIDENCE_FIELDS} FROM evidence WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return rows;
  });
  res.json(rows);
}

export async function getEvidence(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const userId = req.session.userId!;
  const evidenceId = req.params.id;

  const evidence = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT ${EVIDENCE_FIELDS} FROM evidence WHERE tenant_id = $1 AND id = $2`,
      [tenantId, evidenceId]
    );
    if (rows.length === 0) return undefined;
    await logEvidenceAudit(client, { tenantId, evidenceId, actorUserId: userId, action: "viewed" });
    return rows[0];
  });

  if (!evidence) return res.status(404).json({ error: "not_found" });
  res.json(evidence);
}

function contentDispositionHeader(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function downloadEvidence(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const userId = req.session.userId!;
  const evidenceId = req.params.id;

  const evidence = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      "SELECT storage_key, mime_type, title, status FROM evidence WHERE tenant_id = $1 AND id = $2",
      [tenantId, evidenceId]
    );
    return rows[0] as { storage_key: string; mime_type: string; title: string; status: string } | undefined;
  });
  if (!evidence || evidence.status === "deleted") return res.status(404).json({ error: "not_found" });

  const buffer = await getObjectStore().get(evidence.storage_key);

  await withTenant(tenantId, (client) =>
    logEvidenceAudit(client, { tenantId, evidenceId, actorUserId: userId, action: "downloaded" })
  );

  res.setHeader("Content-Type", evidence.mime_type);
  res.setHeader("Content-Disposition", contentDispositionHeader(evidence.title));
  res.send(buffer);
}

/**
 * Re-hashes the bytes currently in storage and compares against the hash
 * recorded at ingest time -- this is the core "verification" promise: has
 * this evidence's content changed (or its stored bytes been corrupted or
 * tampered with) since it was submitted. Every check, pass or fail, is
 * itself logged to the audit trail.
 */
export async function verifyEvidence(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const userId = req.session.userId!;
  const evidenceId = req.params.id;

  const evidence = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      "SELECT storage_key, content_hash, hash_algorithm, status FROM evidence WHERE tenant_id = $1 AND id = $2",
      [tenantId, evidenceId]
    );
    return rows[0] as
      | { storage_key: string; content_hash: string; hash_algorithm: string; status: string }
      | undefined;
  });
  if (!evidence) return res.status(404).json({ error: "not_found" });

  const buffer = await getObjectStore().get(evidence.storage_key);
  const actualHash = crypto.createHash(evidence.hash_algorithm).update(buffer).digest("hex");
  const verified = actualHash === evidence.content_hash;

  await withTenant(tenantId, (client) =>
    logEvidenceAudit(client, {
      tenantId,
      evidenceId,
      actorUserId: userId,
      action: verified ? "hash_verified" : "hash_mismatch",
      detail: { expected: evidence.content_hash, actual: actualHash },
    })
  );

  res.json({ verified, algorithm: evidence.hash_algorithm, expectedHash: evidence.content_hash, actualHash });
}

/**
 * Soft-delete only: evidence is provenance-bearing, so the row (and its
 * full audit trail) is never actually removed, just marked. The backing
 * object is intentionally left in storage too -- Phase 3's dispute/audit
 * chain may need to reference or restore it.
 */
export async function deleteEvidence(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const userId = req.session.userId!;
  const evidenceId = req.params.id;

  const deleted = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      "UPDATE evidence SET status = 'deleted' WHERE tenant_id = $1 AND id = $2 AND status = 'active' RETURNING id",
      [tenantId, evidenceId]
    );
    if (rows.length === 0) return false;
    await logEvidenceAudit(client, { tenantId, evidenceId, actorUserId: userId, action: "deleted" });
    return true;
  });

  if (!deleted) return res.status(404).json({ error: "not_found" });
  res.status(204).end();
}

export async function getEvidenceAuditLog(req: Request, res: Response) {
  const tenantId = req.session.tenantId!;
  const evidenceId = req.params.id;

  const rows = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT eal.id, eal.action, eal.detail, eal.created_at, eal.actor_user_id, u.email AS actor_email
       FROM evidence_audit_log eal
       LEFT JOIN users u ON u.id = eal.actor_user_id AND u.tenant_id = eal.tenant_id
       WHERE eal.tenant_id = $1 AND eal.evidence_id = $2
       ORDER BY eal.created_at ASC`,
      [tenantId, evidenceId]
    );
    return rows;
  });
  res.json(rows);
}
