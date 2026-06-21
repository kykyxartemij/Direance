import sharp from 'sharp';
import { ApiError } from '@/models/api-error';
import { LOGO_ACCEPTED_MIME_TYPES } from '@/models/logo.model';

async function processImage(buffer: Buffer, maxBytes: number, maxWidth: number): Promise<{ data: Buffer; mime: string }> {
  const limit = Math.floor(maxBytes * 0.95);
  let width = maxWidth;

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await sharp(buffer)
      .resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    if (result.length <= limit) return { data: result, mime: 'image/webp' };

    width = Math.floor(width * Math.sqrt(limit / result.length));
  }

  throw new ApiError('Image too large to compress within limits', 400);
}

export async function processImageFile(file: File, maxBytes: number, maxWidth: number): Promise<{ data: Buffer; mime: string; name: string }> {
  if (!(LOGO_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError('Image must be PNG, JPEG, WebP, or GIF', 400);
  }
  const raw = Buffer.from(await file.arrayBuffer());
  const processed = await processImage(raw, maxBytes, maxWidth);
  return { ...processed, name: file.name };
}