import { describe, expect, it } from 'vitest';
import { SupabaseStorage } from '@/lib/storage/supabase';

const URL_ = 'https://abc.supabase.co';
const SECRET = 'sb_secret_test_key_value';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig';

type Call = { url: string; init: RequestInit };

/** A fetch that records every request and answers with the scripted responses, in order. */
function fakeFetch(...responses: Response[]) {
  const calls: Call[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('no scripted response');
    return next;
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('SupabaseStorage', () => {
  it('put sends the bytes to the private bucket with upsert', async () => {
    const { calls, fetch } = fakeFetch(json({ Key: 'screenshots/p1/t1.png' }));
    await new SupabaseStorage({ url: URL_, key: SECRET, fetch }).put('p1/t1.png', Buffer.from('png bytes'), 'image/png');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://abc.supabase.co/storage/v1/object/screenshots/p1/t1.png');
    expect(calls[0].init.method).toBe('POST');
    expect(header(calls[0], 'x-upsert')).toBe('true');
    expect(header(calls[0], 'content-type')).toBe('image/png');
    expect(header(calls[0], 'apikey')).toBe(SECRET);
    expect(Buffer.from(calls[0].init.body as Uint8Array).toString()).toBe('png bytes');
  });

  it('trims a trailing slash from the project URL', async () => {
    const { calls, fetch } = fakeFetch(json({}));
    await new SupabaseStorage({ url: `${URL_}/`, key: SECRET, fetch }).put('p1/t1.png', Buffer.from('x'), 'image/png');
    expect(calls[0].url).toBe('https://abc.supabase.co/storage/v1/object/screenshots/p1/t1.png');
  });

  it('get returns the stored bytes', async () => {
    const { calls, fetch } = fakeFetch(new Response(Buffer.from('jpeg bytes')));
    const bytes = await new SupabaseStorage({ url: URL_, key: SECRET, fetch }).get('p1/t1.jpg');
    expect(bytes.toString()).toBe('jpeg bytes');
    expect(calls[0].url).toBe('https://abc.supabase.co/storage/v1/object/authenticated/screenshots/p1/t1.jpg');
    expect(calls[0].init.method ?? 'GET').toBe('GET');
  });

  it('get throws on 404 with the status in the message', async () => {
    const { fetch } = fakeFetch(json({ message: 'Object not found' }, 404));
    await expect(new SupabaseStorage({ url: URL_, key: SECRET, fetch }).get('p1/t1.jpg')).rejects.toThrow(/get failed: 404 Object not found/);
  });

  it('delete treats 404 as success', async () => {
    const { calls, fetch } = fakeFetch(json({ message: 'Object not found' }, 404));
    await expect(new SupabaseStorage({ url: URL_, key: SECRET, fetch }).delete('p1/t1.png')).resolves.toBeUndefined();
    expect(calls[0].url).toBe('https://abc.supabase.co/storage/v1/object/screenshots/p1/t1.png');
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('delete throws on 500', async () => {
    const { fetch } = fakeFetch(json({ message: 'boom' }, 500));
    await expect(new SupabaseStorage({ url: URL_, key: SECRET, fetch }).delete('p1/t1.png')).rejects.toThrow(/delete failed: 500/);
  });

  it('signedUrl asks for the given lifetime and returns an absolute URL', async () => {
    const { calls, fetch } = fakeFetch(json({ signedURL: '/object/sign/screenshots/p1/t1.png?token=xyz' }));
    const url = await new SupabaseStorage({ url: URL_, key: SECRET, fetch }).signedUrl('p1/t1.png', 600);
    expect(url).toBe('https://abc.supabase.co/storage/v1/object/sign/screenshots/p1/t1.png?token=xyz');
    expect(calls[0].url).toBe('https://abc.supabase.co/storage/v1/object/sign/screenshots/p1/t1.png');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ expiresIn: 600 });
  });

  it('an sb_secret_ key goes in apikey only', async () => {
    const { calls, fetch } = fakeFetch(json({}));
    await new SupabaseStorage({ url: URL_, key: SECRET, fetch }).put('p1/t1.png', Buffer.from('x'), 'image/png');
    expect(header(calls[0], 'apikey')).toBe(SECRET);
    expect(header(calls[0], 'authorization')).toBeNull();
  });

  it('a legacy service_role JWT also goes in Authorization: Bearer', async () => {
    const { calls, fetch } = fakeFetch(json({}));
    await new SupabaseStorage({ url: URL_, key: JWT, fetch }).put('p1/t1.png', Buffer.from('x'), 'image/png');
    expect(header(calls[0], 'apikey')).toBe(JWT);
    expect(header(calls[0], 'authorization')).toBe(`Bearer ${JWT}`);
  });

  it.each(['../x.png', '/abs.png', 'p/../../x.png', ''])('refuses a key that could leave the bucket path: "%s"', async (key) => {
    const { calls, fetch } = fakeFetch();
    const storage = new SupabaseStorage({ url: URL_, key: SECRET, fetch });
    await expect(storage.put(key, Buffer.from('x'), 'image/png')).rejects.toThrow(/Storage key/);
    await expect(storage.get(key)).rejects.toThrow(/Storage key/);
    await expect(storage.delete(key)).rejects.toThrow(/Storage key/);
    await expect(storage.signedUrl(key, 600)).rejects.toThrow(/Storage key/);
    expect(calls).toHaveLength(0);
  });

  it('never puts the key in an error message', async () => {
    const { fetch } = fakeFetch(json({ message: 'Invalid key' }, 401));
    const error = await new SupabaseStorage({ url: URL_, key: SECRET, fetch }).put('p1/t1.png', Buffer.from('x'), 'image/png').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/put failed: 401 Invalid key/);
    expect((error as Error).message).not.toContain(SECRET);
  });
});
