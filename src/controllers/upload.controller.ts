import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { sanitizeSafeFilename } from '../middleware/upload';
import { optimizeImage, ensureUploadDir } from '../services/image.service';

// Configure Cloudinary if configured
if (env.STORAGE_TYPE === 'CLOUDINARY' && env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export const uploadSingleImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw AppError.badRequest('No image file provided');
  }

  // 1. Optimize image in-memory via Sharp before saving
  // Prioritizes visual quality (preserves denim texture, stitching, sRGB colors, auto-rotates, strips metadata)
  const optimized = await optimizeImage(req.file.buffer, {
    maxDimension: 2048,
    quality: 88,
    effort: 5,
    format: 'webp',
  });

  // 2. Cloudinary upload if configured
  if (env.STORAGE_TYPE === 'CLOUDINARY' && env.CLOUDINARY_CLOUD_NAME) {
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'jeansloop/products',
          format: 'webp',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(optimized.buffer);
    });

    return sendSuccess(
      res,
      {
        image: uploadResult.secure_url,
        width: optimized.width,
        height: optimized.height,
        size: optimized.size,
        originalSize: optimized.originalSize,
        savingsPercentage: optimized.savingsPercentage,
      },
      'Image uploaded to Cloudinary'
    );
  }

  // 3. Local disk upload: save ONLY the optimized WebP asset (never save the bloated 5-6MB original)
  const uploadDir = await ensureUploadDir();
  const filename = sanitizeSafeFilename(req.file.originalname, optimized.extension);
  const targetPath = path.join(uploadDir, filename);

  try {
    await fs.writeFile(targetPath, optimized.buffer);
  } catch (err: any) {
    // Clean up partial file if write failed
    if (existsSync(targetPath)) {
      await fs.unlink(targetPath).catch(() => {});
    }
    throw AppError.internal(`Failed to save image to disk: ${err.message}`);
  }

  const fileUrl = `${env.BACKEND_URL}/uploads/${filename}`;
  sendSuccess(
    res,
    {
      image: fileUrl,
      width: optimized.width,
      height: optimized.height,
      size: optimized.size,
      originalSize: optimized.originalSize,
      savingsPercentage: optimized.savingsPercentage,
    },
    'Image optimized and uploaded locally'
  );
});

export const uploadMultipleImages = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    throw AppError.badRequest('No image files provided');
  }

  const uploadDir = await ensureUploadDir();
  const uploadedUrls: string[] = [];
  const details: any[] = [];
  const writtenFiles: string[] = [];

  try {
    for (const file of files) {
      // 1. Optimize image in-memory
      const optimized = await optimizeImage(file.buffer, {
        maxDimension: 2048,
        quality: 88,
        effort: 5,
        format: 'webp',
      });

      // 2. Cloudinary branch
      if (env.STORAGE_TYPE === 'CLOUDINARY' && env.CLOUDINARY_CLOUD_NAME) {
        const uploadResult = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: 'jeansloop/products',
              format: 'webp',
              resource_type: 'image',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(optimized.buffer);
        });

        uploadedUrls.push(uploadResult.secure_url);
        details.push({
          url: uploadResult.secure_url,
          width: optimized.width,
          height: optimized.height,
          size: optimized.size,
          savingsPercentage: optimized.savingsPercentage,
        });
      } else {
        // 3. Local disk branch: save only optimized WebP
        const filename = sanitizeSafeFilename(file.originalname, optimized.extension);
        const targetPath = path.join(uploadDir, filename);

        await fs.writeFile(targetPath, optimized.buffer);
        writtenFiles.push(targetPath);

        const fileUrl = `${env.BACKEND_URL}/uploads/${filename}`;
        uploadedUrls.push(fileUrl);
        details.push({
          url: fileUrl,
          width: optimized.width,
          height: optimized.height,
          size: optimized.size,
          savingsPercentage: optimized.savingsPercentage,
        });
      }
    }
  } catch (err: any) {
    // If any file fails in batch processing, safely roll back files written in this batch
    for (const filePath of writtenFiles) {
      if (existsSync(filePath)) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
    throw AppError.badRequest(`Batch upload failed: ${err.message}`);
  }

  sendSuccess(
    res,
    {
      images: uploadedUrls,
      details,
    },
    'Images optimized and uploaded successfully'
  );
});
