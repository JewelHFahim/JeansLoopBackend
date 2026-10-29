import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Product } from '../src/models/Product';
import { SiteSettings } from '../src/models/SiteSettings';
import { Slider } from '../src/models/Slider';
import { optimizeImage } from '../src/services/image.service';

async function run() {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!existsSync(uploadsDir)) {
    console.error('Uploads directory not found:', uploadsDir);
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeansloop';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB:', mongoUri);

  const files = await fs.readdir(uploadsDir);
  const imageFiles = files.filter((f) => {
    if (f.startsWith('.')) return false;
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png'].includes(ext);
  });

  console.log(`Found ${imageFiles.length} unoptimized JPEG/PNG files in public/uploads.\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let optimizedCount = 0;
  const urlReplacements: Record<string, string> = {};

  for (const filename of imageFiles) {
    const inputPath = path.join(uploadsDir, filename);
    const statBefore = await fs.stat(inputPath);
    const sizeMB = statBefore.size / (1024 * 1024);

    // Skip tiny icons under 30KB
    if (statBefore.size < 30 * 1024) {
      continue;
    }

    try {
      const buffer = await fs.readFile(inputPath);
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const newFilename = `${base}.webp`;
      const outputPath = path.join(uploadsDir, newFilename);

      const result = await optimizeImage(buffer, {
        maxDimension: 2048,
        quality: 88,
        effort: 5,
        format: 'webp',
      });

      await fs.writeFile(outputPath, result.buffer);

      totalBefore += statBefore.size;
      totalAfter += result.size;
      optimizedCount++;

      // Record replacement mapping
      const oldRelative = `/uploads/${filename}`;
      const newRelative = `/uploads/${newFilename}`;
      urlReplacements[filename] = newFilename;

      console.log(
        `✓ ${filename} (${(statBefore.size / 1024).toFixed(0)} KB) -> ${newFilename} (${(
          result.size / 1024
        ).toFixed(0)} KB) | Saved: ${result.savingsPercentage}% [${result.width}x${result.height}]`
      );

      // Safe deletion of old raw file only if new webp exists and is valid
      if (existsSync(outputPath) && result.size > 0 && newFilename !== filename) {
        await fs.unlink(inputPath);
      }
    } catch (err: any) {
      console.error(`✗ Failed to optimize ${filename}:`, err.message);
    }
  }

  console.log('\n--- Updating Database References ---');

  let updatedProductsCount = 0;
  const products = await Product.find({});
  for (const prod of products) {
    let modified = false;
    const updatedImages = prod.images.map((imgUrl) => {
      for (const [oldName, newName] of Object.entries(urlReplacements)) {
        if (imgUrl.includes(`/uploads/${oldName}`)) {
          modified = true;
          return imgUrl.replace(`/uploads/${oldName}`, `/uploads/${newName}`);
        }
      }
      return imgUrl;
    });

    if (modified) {
      prod.images = updatedImages;
      await prod.save();
      updatedProductsCount++;
      console.log(`  Updated product: "${prod.name}" (${prod.slug})`);
    }
  }

  // Update site settings if logo changed
  const settings = await SiteSettings.findOne();
  if (settings && (settings as any).logo) {
    let logoModified = false;
    let logo = (settings as any).logo;
    for (const [oldName, newName] of Object.entries(urlReplacements)) {
      if (logo.includes(`/uploads/${oldName}`)) {
        logo = logo.replace(`/uploads/${oldName}`, `/uploads/${newName}`);
        logoModified = true;
      }
    }
    if (logoModified) {
      (settings as any).logo = logo;
      await settings.save();
      console.log('  Updated SiteSettings logo');
    }
  }

  // Update sliders if any
  const sliders = await Slider.find();
  for (const s of sliders) {
    let sMod = false;
    for (const [oldName, newName] of Object.entries(urlReplacements)) {
      if (s.image && s.image.includes(`/uploads/${oldName}`)) {
        s.image = s.image.replace(`/uploads/${oldName}`, `/uploads/${newName}`);
        sMod = true;
      }
    }
    if (sMod) {
      await s.save();
      console.log(`  Updated Slider: "${s.title}"`);
    }
  }

  const savedBytes = totalBefore - totalAfter;
  const savedMB = savedBytes / (1024 * 1024);
  const totalBeforeMB = totalBefore / (1024 * 1024);
  const totalAfterMB = totalAfter / (1024 * 1024);
  const overallPercentage = totalBefore > 0 ? ((savedBytes / totalBefore) * 100).toFixed(1) : '0';

  console.log('\n=============================================');
  console.log(`  OPTIMIZATION SUMMARY`);
  console.log('=============================================');
  console.log(`  Files Optimized:       ${optimizedCount}`);
  console.log(`  Products Updated:      ${updatedProductsCount}`);
  console.log(`  Storage Before:        ${totalBeforeMB.toFixed(2)} MB`);
  console.log(`  Storage After:         ${totalAfterMB.toFixed(2)} MB`);
  console.log(`  Storage Saved:         ${savedMB.toFixed(2)} MB (${overallPercentage}% reduction)`);
  console.log('=============================================\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
