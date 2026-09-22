import argon2 from "argon2";

// argon2id per manifest requirement: "Real authentication ... Argon2id/bcrypt
// + sessions, never a bare password_hash column [treated as opaque]."
const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, OWASP 2023 minimum recommendation
  timeCost: 2,
  parallelism: 1,
} satisfies argon2.Options;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTS);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}

export function isPasswordStrongEnough(plain: string): boolean {
  // Minimal Phase 1 policy — length only. Tighten in Phase 3 (Governance)
  // once the policy engine exists, rather than hardcoding more rules here.
  return typeof plain === "string" && plain.length >= 12;
}
