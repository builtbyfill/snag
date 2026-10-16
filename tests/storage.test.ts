import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorage, MapStorage } from '@/lib/storage';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'snag-storage-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('LocalDiskStorage', () => {
  it('writes into the project subfolder and reads the same bytes back', async () => {
    const storage = createLocalStorage(dir);
    await storage.put('project-1/ticket-1.png', Buffer.from('png bytes'), 'image/png');
    expect((await storage.get('project-1/ticket-1.png')).toString()).toBe('png bytes');
    expect(await readdir(path.join(dir, 'project-1'))).toEqual(['ticket-1.png']);
  });

  it('leaves no temporary file behind after a write', async () => {
    const storage = createLocalStorage(dir);
    await storage.put('p/t.jpg', Buffer.from('x'), 'image/jpeg');
    await storage.put('p/t.jpg', Buffer.from('y'), 'image/jpeg');
    expect(await readdir(path.join(dir, 'p'))).toEqual(['t.jpg']);
    expect((await storage.get('p/t.jpg')).toString()).toBe('y');
  });

  it.each(['../outside.png', 'p/../../outside.png', path.resolve(tmpdir(), 'abs.png')])(
    'refuses a key that resolves outside the uploads folder: %s',
    async (key) => {
      const storage = createLocalStorage(dir);
      await expect(storage.put(key, Buffer.from('x'), 'image/png')).rejects.toThrow(/outside/);
      await expect(storage.get(key)).rejects.toThrow(/outside/);
    },
  );

  it('fails to read a key that was never written', async () => {
    await expect(createLocalStorage(dir).get('p/missing.png')).rejects.toThrow();
  });
});

describe('MapStorage', () => {
  it('keeps bytes in memory for tests', async () => {
    const storage = new MapStorage();
    await storage.put('a/b.png', Buffer.from('z'), 'image/png');
    expect((await storage.get('a/b.png')).toString()).toBe('z');
    await expect(storage.get('a/c.png')).rejects.toThrow();
  });
});
