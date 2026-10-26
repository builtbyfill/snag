import type { Storage } from './index';

/** The one private bucket every screenshot lives in. Created by hand in the dashboard (docs/deploy.md). */
export const SCREENSHOT_BUCKET = 'screenshots';

const TIMEOUT_MS = 15_000;

/**
 * Screenshots in a private Supabase Storage bucket, over the Storage REST API (no client library).
 * Server-only: the key is the project's secret key and must never reach a browser. It goes in the
 * `apikey` header; a legacy service_role key (a JWT) also goes in `Authorization: Bearer`, which
 * the new `sb_secret_…` keys must not (they aren't JWTs).
 */
export class SupabaseStorage implements Storage {
  private readonly base: string;
  private readonly key: string;
  private readonly fetch: typeof fetch;

  constructor(opts: { url: string; key: string; fetch?: typeof fetch }) {
    this.base = `${opts.url.replace(/\/+$/, '')}/storage/v1`;
    this.key = opts.key;
    this.fetch = opts.fetch ?? fetch;
  }

  async put(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    // Upsert: the seed writes the same keys again on every run.
    const res = await this.request('POST', `/object/${SCREENSHOT_BUCKET}/${path(key)}`, {
      body: new Uint8Array(bytes),
      headers: { 'Content-Type': mimeType, 'x-upsert': 'true' },
    });
    await check(res, 'put');
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.request('GET', `/object/authenticated/${SCREENSHOT_BUCKET}/${path(key)}`);
    await check(res, 'get');
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.request('DELETE', `/object/${SCREENSHOT_BUCKET}/${path(key)}`);
    if (res.status === 404) return;
    await check(res, 'delete');
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string | null> {
    const res = await this.request('POST', `/object/sign/${SCREENSHOT_BUCKET}/${path(key)}`, {
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
      headers: { 'Content-Type': 'application/json' },
    });
    await check(res, 'signedUrl');
    const { signedURL } = (await res.json()) as { signedURL?: string };
    if (!signedURL) throw new Error('Supabase Storage signedUrl failed: no URL in the answer');
    return `${this.base}${signedURL}`;
  }

  private request(method: string, route: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { apikey: this.key, ...init.headers };
    if (this.key.startsWith('eyJ')) headers.Authorization = `Bearer ${this.key}`;
    return this.fetch(`${this.base}${route}`, { method, body: init.body, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
}

// Belt and braces, as on local disk: keys never contain client input, but a key must still stay
// a plain path inside the bucket.
function path(key: string): string {
  const segments = key.split('/');
  if (!key || key.startsWith('/') || segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new Error(`Storage key is not a plain path inside the bucket: ${key}`);
  }
  return segments.map(encodeURIComponent).join('/');
}

/** Throws on a non-2xx answer with the status and Supabase's own message; never the request or its headers. */
async function check(res: Response, op: string): Promise<void> {
  if (res.ok) return;
  let message = '';
  try {
    const body = (await res.json()) as { message?: unknown; error?: unknown };
    message = String(body.message ?? body.error ?? '');
  } catch {
    // Not JSON: the status says enough.
  }
  throw new Error(`Supabase Storage ${op} failed: ${res.status}${message ? ` ${message}` : ''}`);
}
