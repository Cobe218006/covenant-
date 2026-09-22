import { env } from "../config/env";
import { LocalObjectStore } from "./local";
import { S3ObjectStore } from "./s3";

/**
 * Storage abstraction evidence files are written to and read back from.
 * Two implementations exist (local.ts, s3.ts), selected by STORAGE_DRIVER;
 * evidenceController never talks to the filesystem or an S3 client
 * directly, only through this interface, so a Phase 6/7 adapter can swap
 * drivers without touching the evidence domain logic.
 */
export interface ObjectStore {
  readonly driver: "local" | "s3";
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/**
 * Deterministic, tenant-scoped storage key for one evidence file. Keying
 * by tenantId + evidenceId (both server-generated UUIDs) means the only
 * untrusted input here is the filename, which is sanitized -- this is
 * what keeps LocalObjectStore's path-traversal guard from ever actually
 * needing to fire in normal operation, not a substitute for it.
 */
export function buildObjectKey(tenantId: string, evidenceId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "file";
  return `${tenantId}/${evidenceId}/${safeName}`;
}

let cached: ObjectStore | undefined;

// S3 credentials/bucket are only validated (see s3.ts) when this branch
// actually runs, i.e. when STORAGE_DRIVER=s3 -- a "local"-driver dev setup
// never needs S3 env vars defined at all.
export function getObjectStore(): ObjectStore {
  if (!cached) {
    cached = env.storage.driver === "s3" ? new S3ObjectStore() : new LocalObjectStore(env.storage.localDir);
  }
  return cached;
}
