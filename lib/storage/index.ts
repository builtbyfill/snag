// Screenshot files behind two methods. Keys are built by the app ("<projectId>/<ticketId>.<ext>")
// and never contain client input; S3 later means one more adapter behind the same interface.
import { LocalDiskStorage } from './local';

export interface Storage {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

export function createLocalStorage(dir: string): Storage {
  return new LocalDiskStorage(dir);
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
}
