import fs from "fs/promises";
import path from "path";
import { ObjectStore } from "./objectStore";

/**
 * Filesystem-backed store, rooted at `rootDir`. The zero-config default
 * (STORAGE_DRIVER=local) -- no external service required, matching Phase
 * 1's "no paid provider required" ethos for this foundation.
 */
export class LocalObjectStore implements ObjectStore {
  readonly driver = "local" as const;

  constructor(private readonly rootDir: string) {}

  // Defense-in-depth against path traversal: keys are built exclusively by
  // buildObjectKey() (objectStore.ts) from server-generated UUIDs plus a
  // sanitized filename, so this should never actually reject anything in
  // normal operation -- but a storage layer that trusts its caller's key
  // unconditionally is one bug away from an arbitrary file read/write.
  private resolve(key: string): string {
    const root = path.resolve(this.rootDir);
    const target = path.resolve(root, key);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`Refusing to access storage path outside root: ${key}`);
    }
    return target;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}
