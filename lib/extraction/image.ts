import sharp from 'sharp';

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * Fit the image inside `limit` × `limit` (never enlarging) and honor EXIF orientation.
 * PNG stays PNG (lossless; screenshots are mostly text); JPEG and WebP become JPEG at quality 90.
 */
export async function downscale(
  data: Buffer,
  mimeType: ImageMime,
  limit: number,
): Promise<{ data: Buffer; mimeType: 'image/png' | 'image/jpeg' }> {
  const pipeline = sharp(data)
    .rotate()
    .resize({ width: limit, height: limit, fit: 'inside', withoutEnlargement: true });

  if (mimeType === 'image/png') return { data: await pipeline.png().toBuffer(), mimeType: 'image/png' };
  return { data: await pipeline.jpeg({ quality: 90 }).toBuffer(), mimeType: 'image/jpeg' };
}
