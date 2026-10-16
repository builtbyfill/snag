import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { downscale } from '@/lib/extraction/image';

const blank = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#ffffff' } });

describe('downscale', () => {
  it('shrinks a tall phone screenshot so its long edge equals the limit, keeping PNG', async () => {
    const input = await blank(1170, 2532).png().toBuffer();
    const out = await downscale(input, 'image/png', 1568);
    const meta = await sharp(out.data).metadata();
    expect(out.mimeType).toBe('image/png');
    expect(meta.format).toBe('png');
    expect(meta.height).toBe(1568);
    expect(meta.width).toBe(Math.round((1170 * 1568) / 2532));
  });

  it('never enlarges a small image', async () => {
    const input = await blank(800, 600).png().toBuffer();
    const meta = await sharp((await downscale(input, 'image/png', 1568)).data).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
  });

  it('re-encodes JPEG and WebP as JPEG', async () => {
    for (const [buffer, mime] of [
      [await blank(400, 300).jpeg().toBuffer(), 'image/jpeg'],
      [await blank(400, 300).webp().toBuffer(), 'image/webp'],
    ] as const) {
      const out = await downscale(buffer, mime, 1568);
      expect(out.mimeType).toBe('image/jpeg');
      expect((await sharp(out.data).metadata()).format).toBe('jpeg');
    }
  });

  it('applies EXIF orientation so a rotated phone photo arrives upright', async () => {
    // Stored 400x300 with orientation 6 (rotate 90° clockwise) displays as 300x400.
    const input = await blank(400, 300).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const meta = await sharp((await downscale(input, 'image/jpeg', 1568)).data).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
  });
});
