import { describe, expect, it } from 'vitest';
import { planUpload, thumbSize, UPLOAD_MAX_EDGE, UPLOAD_MAX_BYTES } from '@/lib/reports/prepare-image';

const MB = 1024 * 1024;

describe('planUpload (what the browser does with a chosen image before sending)', () => {
  it('keeps an ordinary phone screenshot as it is', () => {
    expect(planUpload({ width: 1170, height: 2532, bytes: 400_000, type: 'image/png' })).toEqual({ action: 'keep' });
  });

  it('shrinks a large camera photo of a monitor to the long-edge limit, as JPEG', () => {
    expect(planUpload({ width: 8064, height: 6048, bytes: 9 * MB, type: 'image/jpeg' })).toEqual({
      action: 'reencode', width: UPLOAD_MAX_EDGE, height: 1920, type: 'image/jpeg', quality: 0.85,
    });
  });

  it('re-encodes a file that is within the edge limit but too heavy', () => {
    const plan = planUpload({ width: 2400, height: 1800, bytes: 6 * MB, type: 'image/png' });
    expect(plan).toEqual({ action: 'reencode', width: 2400, height: 1800, type: 'image/jpeg', quality: 0.85 });
  });

  it('converts a format the server does not take (HEIC, GIF) instead of rejecting it', () => {
    expect(planUpload({ width: 3024, height: 4032, bytes: 2 * MB, type: 'image/heic' })).toMatchObject({ action: 'reencode', width: 1920, height: UPLOAD_MAX_EDGE });
    expect(planUpload({ width: 300, height: 200, bytes: 50_000, type: 'image/gif' })).toMatchObject({ action: 'reencode', width: 300, height: 200 });
  });

  it('never enlarges', () => {
    expect(planUpload({ width: 200, height: 100, bytes: 6 * MB, type: 'image/png' })).toMatchObject({ width: 200, height: 100 });
  });

  it('stays under the server limit with room for form overhead', () => {
    expect(UPLOAD_MAX_BYTES).toBeLessThan(5 * MB);
  });
});

describe('thumbSize (the small copy kept in this device\'s history)', () => {
  it('fits the long edge to 240px', () => {
    expect(thumbSize(1170, 2532)).toEqual({ width: 111, height: 240 });
    expect(thumbSize(2560, 1920)).toEqual({ width: 240, height: 180 });
  });

  it('never enlarges a tiny image', () => {
    expect(thumbSize(100, 50)).toEqual({ width: 100, height: 50 });
  });
});
