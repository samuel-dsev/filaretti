import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { MediaVisibility } from '@prisma/client';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';

export const storageKeyPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(?:jpg|png|webp|avif|pdf)$/u;

@Injectable()
export class StorageService {
  private readonly root: string;
  private readonly r2?: S3Client;
  constructor(@Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment) {
    this.root = resolve(environment.STORAGE_LOCAL_PATH);
    if (environment.R2_ENABLED) {
      this.r2 = new S3Client({
        region: 'auto',
        endpoint: `https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: environment.R2_ACCESS_KEY_ID!,
          secretAccessKey: environment.R2_SECRET_ACCESS_KEY!,
        },
        maxAttempts: 2,
      });
    }
  }
  private key(key: string) {
    if (!storageKeyPattern.test(key))
      throw new ServiceUnavailableException({ code: 'STORAGE_UNAVAILABLE' });
    return key;
  }
  private bucket(visibility: MediaVisibility) {
    return visibility === 'PUBLIC'
      ? this.environment.R2_PUBLIC_BUCKET
      : this.environment.R2_PRIVATE_BUCKET;
  }
  private client() {
    if (!this.r2) throw new ServiceUnavailableException({ code: 'STORAGE_UNAVAILABLE' });
    return this.r2;
  }
  async put(key: string, visibility: MediaVisibility, mimeType: string, bytes: Buffer) {
    this.key(key);
    try {
      if (this.environment.STORAGE_DRIVER === 'local') {
        const directory = join(this.root, visibility.toLowerCase());
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, key), bytes, { flag: 'wx', mode: 0o600 });
      } else {
        await this.client().send(
          new PutObjectCommand({
            Bucket: this.bucket(visibility),
            Key: key,
            Body: bytes,
            ContentType: mimeType,
            CacheControl: 'no-store',
          }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
      }
    } catch {
      throw new ServiceUnavailableException({ code: 'STORAGE_UNAVAILABLE' });
    }
  }
  async get(key: string, visibility: MediaVisibility, driver: string): Promise<Buffer> {
    this.key(key);
    try {
      if (driver === 'local') return await readFile(join(this.root, visibility.toLowerCase(), key));
      const result = await this.client().send(
        new GetObjectCommand({ Bucket: this.bucket(visibility), Key: key }),
        { abortSignal: AbortSignal.timeout(10000) },
      );
      if (!result.Body) throw new Error('Empty object');
      return Buffer.from(await result.Body.transformToByteArray());
    } catch {
      throw new ServiceUnavailableException({ code: 'STORAGE_UNAVAILABLE' });
    }
  }
  async remove(key: string, visibility: MediaVisibility, driver: string): Promise<void> {
    this.key(key);
    try {
      if (driver === 'local') {
        await unlink(join(this.root, visibility.toLowerCase(), key)).catch((error: unknown) => {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        });
      } else {
        await this.client().send(
          new DeleteObjectCommand({ Bucket: this.bucket(visibility), Key: key }),
          { abortSignal: AbortSignal.timeout(10000) },
        );
      }
    } catch {
      throw new ServiceUnavailableException({ code: 'STORAGE_UNAVAILABLE' });
    }
  }
}
