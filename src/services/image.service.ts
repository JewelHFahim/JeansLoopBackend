import sharp, { Metadata } from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';

export interface OptimizeImageOptions {
  /** Maximum width or height; aspect ratio is strictly preserved */
  maxDimension?: number;
  /** Compression quality (1-100). Default: 88 (prioritizes fabric & stitching visual fidelity) */
  quality?: number;
  /** Encoding effort (1-6). Default: 5 for strong compression without excessive CPU */
  effort?: number;
  /** Format to output. Default: 'webp' */
  format?: 'webp' | 'jpeg' | 'png';
}

export interface OptimizedImageResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  originalSize: number;
  savingsPercentage: number;
  mimeType: string;
  extension: string;
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * Ensures the uploads directory exists on disk.
 */
export async function ensureUploadDir(): Promise<string> {
  if (!existsSync(UPLOAD_DIR)) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

/**
 * Optimizes an input image buffer for e-commerce production:
 * 1. Validates image integrity and structure via Sharp.
 * 2. Auto-rotates using EXIF orientation tags (handles iPhone orientation).
 * 3. Normalizes color space to calibrated sRGB (prevents iPhone Display P3 color fade).
 * 4. Preserves aspect ratio, resizing only if dimension > maxDimension (without enlarging smaller assets).
 * 5. Applies gentle micro-contrast sharpening when downscaled to preserve denim twill weave & stitching.
 * 6. Strips unnecessary metadata (GPS, device info, timestamps).
 * 7. Encodes to WebP (with smart chroma subsampling & high alpha quality for transparency).
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  if (!inputBuffer || inputBuffer.length === 0) {
    throw AppError.badRequest('Empty image buffer provided');
  }

  const {
    maxDimension = 2048,
    quality = 88,
    effort = 5,
    format = 'webp',
  } = options;

  let image = sharp(inputBuffer, { failOn: 'none' });

  let metadata: Metadata;
  try {
    metadata = await image.metadata();
  } catch (err: any) {
    throw AppError.badRequest(
      `Failed to process image: The file content is invalid or corrupted (${err.message})`
    );
  }

  if (!metadata.width || !metadata.height) {
    throw AppError.badRequest('Unable to read image dimensions. File may be corrupted.');
  }

  // 1. Correct physical orientation based on EXIF tag, then strip EXIF orientation tag
  image = image.rotate();

  // 2. Normalize color space to sRGB to ensure clothing colors, indigo shades, and denim wash appear identical across all screens
  image = image.toColorspace('srgb');

  // Determine if resizing is needed
  // Note: after .rotate(), dimensions may flip if orientation was 90 or 270 deg
  const orientation = metadata.orientation || 1;
  const isRotated90 = orientation >= 5 && orientation <= 8;
  const originalWidth = isRotated90 ? metadata.height : metadata.width;
  const originalHeight = isRotated90 ? metadata.width : metadata.height;

  const needsResize =
    (originalWidth && originalWidth > maxDimension) ||
    (originalHeight && originalHeight > maxDimension);

  if (needsResize) {
    image = image.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
      fastShrinkOnLoad: true,
    });

    // 3. Subtle unsharp mask to restore micro-contrast lost during lanczos downscaling
    // Preserves denim fabric twill lines, fading gradient, and stitching definition
    image = image.sharpen({
      sigma: 0.6,
      m1: 0.5,
      m2: 2.0,
    });
  }

  // 4. Output encoding
  let mimeType = 'image/webp';
  let extension = '.webp';

  if (format === 'webp') {
    image = image.webp({
      quality,
      effort,
      smartSubsample: true, // Prevents chromatic aberration on high-contrast stitch lines and labels
      alphaQuality: 90,     // Preserves transparent logos and graphics cleanly
      force: true,
    });
  } else if (format === 'jpeg') {
    mimeType = 'image/jpeg';
    extension = '.jpg';
    image = image.jpeg({
      quality,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
      force: true,
    });
  } else if (format === 'png') {
    mimeType = 'image/png';
    extension = '.png';
    image = image.png({
      compressionLevel: 9,
      effort,
      force: true,
    });
  }

  try {
    const { data: outputBuffer, info } = await image.toBuffer({ resolveWithObject: true });

    const originalSize = inputBuffer.length;
    const size = outputBuffer.length;
    const savingsPercentage = Number(
      Math.max(0, ((originalSize - size) / originalSize) * 100).toFixed(2)
    );

    return {
      buffer: outputBuffer,
      format: info.format,
      width: info.width,
      height: info.height,
      size,
      originalSize,
      savingsPercentage,
      mimeType,
      extension,
    };
  } catch (err: any) {
    throw AppError.badRequest(`Image optimization failed: ${err.message}`);
  }
}

/**
 * Extracts local filename from an upload URL or relative path.
 * Returns null if the URL points to an external host (e.g. Cloudinary, Unsplash).
 */
export function extractLocalFilename(imageUrl: string): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  try {
    // If it's a full URL
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const parsed = new URL(imageUrl);
      // Only handle URLs pointing to our backend or localhost
      if (
        parsed.pathname.startsWith('/uploads/')
      ) {
        return path.basename(parsed.pathname);
      }
      return null;
    }

    // Relative /uploads/xyz.webp
    if (imageUrl.startsWith('/uploads/')) {
      return path.basename(imageUrl);
    }

    // Just a filename xyz.webp
    if (!imageUrl.includes('/') && !imageUrl.includes('\\')) {
      return imageUrl;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Safely deletes an uploaded image file from local storage.
 * Includes strict path traversal protection.
 */
export async function deleteLocalImage(imageUrlOrFilename: string): Promise<boolean> {
  const filename = extractLocalFilename(imageUrlOrFilename);
  if (!filename) return false;

  // Protect against directory traversal
  const safeFilename = path.basename(filename);
  const targetPath = path.resolve(UPLOAD_DIR, safeFilename);

  // Safety check: ensure targetPath is directly inside UPLOAD_DIR
  if (!targetPath.startsWith(path.resolve(UPLOAD_DIR))) {
    return false;
  }

  try {
    if (existsSync(targetPath)) {
      await fs.unlink(targetPath);
      return true;
    }
  } catch (error) {
    console.warn(`[ImageService] Failed to delete local image "${safeFilename}":`, error);
  }

  return false;
}
