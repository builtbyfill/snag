// Prepares a chosen screenshot in the browser before it is sent. A phone photo of a clinic
// monitor is often 8–50 MB; rejecting it would lose the report, so the browser shrinks it
// instead and only gives up when the image can't be read at all. The server still enforces
// its own limits (4 MB, 8000 px, real format) regardless of what arrives.
import { ACCEPTED_TYPES } from './validate';

export const UPLOAD_MAX_EDGE = 2560; // the model's high-resolution limit; more pixels add nothing
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // at most the server's MAX_BYTES (4 MB)
export const THUMB_EDGE = 240;
export const PREVIEW_EDGE = 1600; // the full-size copy kept on this device: sharp on any phone or laptop
const JPEG_QUALITY = 0.85;

export type UploadPlan =
  | { action: 'keep' }
  | { action: 'reencode'; width: number; height: number; type: 'image/jpeg'; quality: number };

function fit(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Keep an ordinary screenshot untouched; otherwise shrink and re-encode as JPEG. */
export function planUpload(img: { width: number; height: number; bytes: number; type: string }): UploadPlan {
  const accepted = (ACCEPTED_TYPES as readonly string[]).includes(img.type);
  if (accepted && Math.max(img.width, img.height) <= UPLOAD_MAX_EDGE && img.bytes <= UPLOAD_MAX_BYTES) {
    return { action: 'keep' };
  }
  return { action: 'reencode', ...fit(img.width, img.height, UPLOAD_MAX_EDGE), type: 'image/jpeg', quality: JPEG_QUALITY };
}

export function thumbSize(width: number, height: number) {
  return fit(width, height, THUMB_EDGE);
}

export function previewSize(width: number, height: number) {
  return fit(width, height, PREVIEW_EDGE);
}

export type PreparedScreenshot =
  | { ok: true; file: File; thumb: string; preview: Blob }
  | { ok: false; error: 'unreadableImage' | 'tooLarge' };

/**
 * Browser only: decode (honouring EXIF orientation), shrink if needed, and make the history
 * thumbnail plus the full-size copy that the report opens on this device.
 */
export async function prepareScreenshot(file: File): Promise<PreparedScreenshot> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { ok: false, error: 'unreadableImage' };
  }
  try {
    const plan = planUpload({ width: bitmap.width, height: bitmap.height, bytes: file.size, type: file.type });
    let upload = file;
    if (plan.action === 'reencode') {
      let blob = await draw(bitmap, plan.width, plan.height, plan.type, plan.quality);
      // A noisy photo can stay heavy at 0.85; one lower-quality pass before giving up.
      if (blob.size > UPLOAD_MAX_BYTES) blob = await draw(bitmap, plan.width, plan.height, plan.type, 0.7);
      if (blob.size > UPLOAD_MAX_BYTES) return { ok: false, error: 'tooLarge' };
      upload = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: plan.type });
    }
    const t = thumbSize(bitmap.width, bitmap.height);
    const thumbBlob = await draw(bitmap, t.width, t.height, 'image/jpeg', 0.7);
    const p = previewSize(bitmap.width, bitmap.height);
    const preview = await draw(bitmap, p.width, p.height, 'image/jpeg', 0.85);
    return { ok: true, file: upload, thumb: await toDataUrl(thumbBlob), preview };
  } catch {
    return { ok: false, error: 'unreadableImage' };
  } finally {
    bitmap.close();
  }
}

async function draw(bitmap: ImageBitmap, width: number, height: number, type: string, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), type, quality),
  );
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
