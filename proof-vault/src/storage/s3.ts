import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env";
import { ObjectStore } from "./objectStore";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var for STORAGE_DRIVER=s3: ${name}`);
  return value;
}

/**
 * S3-compatible store. Works against real AWS S3 (leave S3_ENDPOINT unset,
 * credentials from the SDK's default chain) or a self-hosted S3-compatible
 * service such as MinIO (set S3_ENDPOINT + S3_FORCE_PATH_STYLE=true +
 * S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY).
 */
export class S3ObjectStore implements ObjectStore {
  readonly driver = "s3" as const;
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    this.bucket = required("S3_BUCKET", env.storage.s3.bucket);
    const hasExplicitCreds = env.storage.s3.accessKeyId && env.storage.s3.secretAccessKey;
    this.client = new S3Client({
      region: env.storage.s3.region,
      endpoint: env.storage.s3.endpoint,
      forcePathStyle: env.storage.s3.forcePathStyle,
      // Omitted (not just left undefined-but-present) when unset, so the
      // SDK's default credential chain (IAM role, shared config, etc.)
      // still applies for real AWS S3 deployments.
      ...(hasExplicitCreds
        ? {
            credentials: {
              accessKeyId: env.storage.s3.accessKeyId!,
              secretAccessKey: env.storage.s3.secretAccessKey!,
            },
          }
        : {}),
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType })
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = res.Body as { transformToByteArray: () => Promise<Uint8Array> };
    return Buffer.from(await body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
