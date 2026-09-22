import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const storageDriver = process.env.STORAGE_DRIVER ?? "local";
if (storageDriver !== "local" && storageDriver !== "s3") {
  throw new Error(`STORAGE_DRIVER must be "local" or "s3", got: ${storageDriver}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  sessionCookieMaxAgeMs: Number(process.env.SESSION_COOKIE_MAX_AGE_MS ?? 86_400_000),
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 26_214_400), // 25 MB
  storage: {
    driver: storageDriver as "local" | "s3",
    // Only used by the "local" driver.
    localDir: process.env.STORAGE_LOCAL_DIR ?? "./data/evidence",
    // Only used by the "s3" driver -- validated lazily in s3ObjectStore.ts
    // (via `required` there) rather than here, so a "local"-driver dev
    // setup never needs S3 vars defined at all.
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT, // set for MinIO / non-AWS S3-compatible services
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
};

if (env.nodeEnv === "production" && env.sessionSecret.includes("replace-me")) {
  throw new Error("SESSION_SECRET must be changed before running in production.");
}
