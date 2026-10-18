import { describe, expect, it } from 'vitest';
import { screenshotKey, staleScreenshotKeys } from '@/lib/reports/screenshot-store';

describe('screenshot store keys (full-size copies kept on this device)', () => {
  it('keys a copy by report link and ticket id', () => {
    expect(screenshotKey('slugA', 'id-1')).toBe('slugA:id-1');
  });

  it('drops copies for this link whose report left the history, and never touches other links', () => {
    const keys = ['slugA:id-1', 'slugA:id-2', 'slugA:id-3', 'slugB:id-9'];
    expect(staleScreenshotKeys(keys, 'slugA', ['id-2', 'id-3'])).toEqual(['slugA:id-1']);
  });
});
