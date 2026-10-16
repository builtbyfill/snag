import { describe, expect, it } from 'vitest';
import { clientIp, hashIp } from '@/lib/auth/rate-limit';

const SECRET = 'x'.repeat(44);

describe('hashIp', () => {
  it('is a deterministic 64-character hex HMAC', () => {
    expect(hashIp('192.168.1.20', SECRET)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('192.168.1.20', SECRET)).toBe(hashIp('192.168.1.20', SECRET));
  });

  it('changes with the IP and with the secret', () => {
    expect(hashIp('192.168.1.20', SECRET)).not.toBe(hashIp('192.168.1.21', SECRET));
    expect(hashIp('192.168.1.20', SECRET)).not.toBe(hashIp('192.168.1.20', 'y'.repeat(44)));
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for value, trimmed', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7');
  });

  it('falls back to "unknown" so a missing header still shares one bucket', () => {
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
