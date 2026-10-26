// Screenshot files behind one interface: local disk (the default, and Compose) or a private
// Supabase Storage bucket. Keys are built by the app ("<projectId>/<ticketId>.<ext>") and never
// contain client input.
import { readStorageEnv } from '@/lib/env';
import { LocalDiskStorage } from './local';
import { SupabaseStorage } from './supabase';

export interface Storage {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Removes the file. A key that was never written is not an error. */
  delete(key: string): Promise<void>;
  /** A short-lived URL the browser can load directly, or null when the app serves the bytes itself. */
  signedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
}

export function createLocalStorage(dir: string): Storage {
  return new LocalDiskStorage(dir);
}

/** The adapter the environment asks for (lib/env.ts > readStorageEnv). Throws on a half-set config. */
export function getStorage(source: Record<string, string | undefined> = process.env): Storage {
  const env = readStorageEnv(source);
  return env.kind === 'supabase' ? new SupabaseStorage({ url: env.url, key: env.key }) : new LocalDiskStorage(env.dir);
}

/** In-memory storage for tests. */
export class MapStorage implements Storage {
  readonly files = new Map<string, { bytes: Buffer; mimeType: string }>();

  async put(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    this.files.set(key, { bytes, mimeType });
  }

  async get(key: string): Promise<Buffer> {
    const file = this.files.get(key);
    if (!file) throw new Error(`No file stored under ${key}`);
    return file.bytes;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async signedUrl(): Promise<string | null> {
    return null;
  }
}
