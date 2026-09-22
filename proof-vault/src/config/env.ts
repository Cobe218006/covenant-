import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  sessionCookieMaxAgeMs: Number(process.env.SESSION_COOKIE_MAX_AGE_MS ?? 86_400_000),
  aiProvider: process.env.AI_PROVIDER ?? "mock",
};

if (env.nodeEnv === "production" && env.sessionSecret.includes("replace-me")) {
  throw new Error("SESSION_SECRET must be changed before running in production.");
}
