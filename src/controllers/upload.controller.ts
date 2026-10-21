import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { sanitizeSafeFilename } from '../middleware/upload';

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

  // 1. Cloudinary upload
  if (env.STORAGE_TYPE === 'CLOUDINARY' && env.CLOUDINARY_CLOUD_NAME) {
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'jeansloop/products' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file!.buffer);
    });

    return sendSuccess(res, { image: uploadResult.secure_url }, 'Image uploaded to Cloudinary');
  }

  // 2. Local disk upload
  const filename = sanitizeSafeFilename(req.file.originalname);
  const targetPath = path.join(process.cwd(), 'public', 'uploads', filename);

  await fs.writeFile(targetPath, req.file.buffer);

  const fileUrl = `${env.BACKEND_URL}/uploads/${filename}`;
  sendSuccess(res, { image: fileUrl }, 'Image uploaded locally');
});

export const uploadMultipleImages = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    throw AppError.badRequest('No image files provided');
  }

  const uploadedUrls: string[] = [];

  for (const file of files) {
    if (env.STORAGE_TYPE === 'CLOUDINARY' && env.CLOUDINARY_CLOUD_NAME) {
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'jeansloop/products' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(file.buffer);
      });
      uploadedUrls.push(uploadResult.secure_url);
    } else {
      const filename = sanitizeSafeFilename(file.originalname);
      const targetPath = path.join(process.cwd(), 'public', 'uploads', filename);
      await fs.writeFile(targetPath, file.buffer);
      uploadedUrls.push(`${env.BACKEND_URL}/uploads/${filename}`);
    }
  }

  sendSuccess(res, { images: uploadedUrls }, 'Images uploaded successfully');
});
