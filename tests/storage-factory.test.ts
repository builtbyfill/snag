import { describe, expect, it } from 'vitest';
import { readStorageEnv } from '@/lib/env';
import { getStorage } from '@/lib/storage';
import { LocalDiskStorage } from '@/lib/storage/local';
import { SupabaseStorage } from '@/lib/storage/supabase';

const SUPABASE = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_factory_test_key' };

describe('readStorageEnv', () => {
  it('defaults to local disk under ./.uploads', () => {
    expect(readStorageEnv({})).toEqual({ kind: 'local', dir: './.uploads' });
  });

  it('uses UPLOAD_DIR when set', () => {
    expect(readStorageEnv({ UPLOAD_DIR: '/data/uploads' })).toEqual({ kind: 'local', dir: '/data/uploads' });
  });

  it('picks Supabase when both variables are set', () => {
    expect(readStorageEnv(SUPABASE)).toEqual({ kind: 'supabase', url: SUPABASE.SUPABASE_URL, key: SUPABASE.SUPABASE_SERVICE_ROLE_KEY });
  });

  it('treats empty strings as unset', () => {
    expect(readStorageEnv({ SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' })).toEqual({ kind: 'local', dir: './.uploads' });
  });

  it('refuses half a Supabase config, naming the missing variable', () => {
    expect(() => readStorageEnv({ SUPABASE_URL: SUPABASE.SUPABASE_URL })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => readStorageEnv({ SUPABASE_SERVICE_ROLE_KEY: SUPABASE.SUPABASE_SERVICE_ROLE_KEY })).toThrow(/SUPABASE_URL/);
  });

  it('refuses a project URL that is not https', () => {
    expect(() => readStorageEnv({ ...SUPABASE, SUPABASE_URL: 'http://abc.supabase.co' })).toThrow(/SUPABASE_URL/);
  });

  it('refuses the .env.example placeholder as a key', () => {
    expect(() => readStorageEnv({ ...SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'replace-with-your-secret-key' })).toThrow(/placeholder/);
  });

  it('refuses local disk on Vercel', () => {
    expect(() => readStorageEnv({ VERCEL: '1' })).toThrow(/SUPABASE_URL: is required on Vercel/);
    expect(readStorageEnv({ VERCEL: '1', ...SUPABASE }).kind).toBe('supabase');
  });

  it('never prints the key', () => {
    let message = '';
    try {
      readStorageEnv({ SUPABASE_SERVICE_ROLE_KEY: SUPABASE.SUPABASE_SERVICE_ROLE_KEY });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/SUPABASE_URL/);
    expect(message).not.toContain(SUPABASE.SUPABASE_SERVICE_ROLE_KEY);
  });
});

describe('getStorage', () => {
  it('gives local disk by default', () => {
    expect(getStorage({})).toBeInstanceOf(LocalDiskStorage);
  });

  it('gives Supabase Storage when both variables are set', () => {
    expect(getStorage(SUPABASE)).toBeInstanceOf(SupabaseStorage);
  });
});
