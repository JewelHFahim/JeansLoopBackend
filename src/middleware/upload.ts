import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sanitizeFilename from 'sanitize-filename';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

// Ensure local uploads directory exists
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage so we can validate and optimize via Sharp in-memory before writing to local disk or Cloudinary
const storage = multer.memoryStorage();

export const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
];

export const allowedExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.heic',
  '.heif',
];

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB to comfortably accept modern high-res iPhone photos
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        AppError.badRequest(
          `Only image files (JPEG, PNG, WebP, AVIF, HEIC) are allowed. Received: ${file.originalname}`
        )
      );
    }
    cb(null, true);
  },
});

/**
 * Detects MIME type by inspecting buffer magic bytes (JPEG, PNG, WebP, AVIF, HEIC/HEIF).
 * Rock-solid native buffer inspection that avoids ESM-only package issues.
 */
export function detectImageMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  // AVIF / HEIC / HEIF: buffer[4..8] is 'ftyp'
  const ftyp = buffer.toString('ascii', 4, 8);
  if (ftyp === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (['avif', 'avis'].includes(brand)) {
      return 'image/avif';
    }
    if (['heic', 'heix', 'hevc', 'heim', 'msf1', 'mif1'].includes(brand)) {
      return 'image/heic';
    }
  }

  return null;
}

/**
 * Validates actual binary content via magic bytes to prevent file extension spoofing.
 */
export async function validateMagicBytes(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const files: Express.Multer.File[] = [];

  if (req.file) {
    files.push(req.file);
  } else if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((fileArr) => files.push(...fileArr));
  }

  for (const file of files) {
    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime || !allowedMimeTypes.includes(detectedMime)) {
      return next(
        AppError.badRequest(
          `File content in "${file.originalname}" does not match a valid image format.`
        )
      );
    }
  }

  next();
}

/**
 * Helper to sanitize filenames to prevent path traversal or special character execution.
 * Allows specifying a target output extension (e.g. '.webp').
 */
export function sanitizeSafeFilename(originalName: string, targetExtension?: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext);
  const cleanBase = sanitizeFilename(baseName).replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const finalExt = targetExtension !== undefined ? targetExtension : ext;
  const formattedExt = finalExt ? (finalExt.startsWith('.') ? finalExt : `.${finalExt}`) : '';
  return `${timestamp}-${randomSuffix}-${cleanBase || 'upload'}${formattedExt}`;
}
