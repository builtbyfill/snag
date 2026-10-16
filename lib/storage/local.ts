import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from './index';

/** Files on local disk under UPLOAD_DIR, outside public/ and the build output. */
export class LocalDiskStorage implements Storage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Write to a temp file in the same folder, then rename: a reader never sees half a file.
    const temp = `${target}.${randomUUID()}.tmp`;
    await writeFile(temp, bytes);
    await rename(temp, target);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  // Belt and braces: keys never contain client input, but a key must still land inside the root.
  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error(`Storage key resolves outside the uploads folder: ${key}`);
    return target;
  }
}
