import dotenv from 'dotenv';
dotenv.config();

import sharp from 'sharp';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { optimizeImage, deleteLocalImage, extractLocalFilename } from '../src/services/image.service';
import { sanitizeSafeFilename, detectImageMime } from '../src/middleware/upload';
import { Product } from '../src/models/Product';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('   RUNNING IMAGE OPTIMIZATION PIPELINE TEST SUITE   ');
  console.log('====================================================\n');

  // ── TEST 1: Real iPhone Photo Optimization & Storage Savings ──
  console.log('Test 1: Real High-Resolution Photo Optimization & Metrics');
  const samplePhotoPath = path.join(process.cwd(), 'public', 'uploads', '1792483726063-5448-waist-30.jpg');
  
  if (existsSync(samplePhotoPath)) {
    const originalBuf = await fs.readFile(samplePhotoPath);
    const origStat = await fs.stat(samplePhotoPath);
    const origMeta = await sharp(originalBuf).metadata();

    const res = await optimizeImage(originalBuf, {
      maxDimension: 2048,
      quality: 88,
      effort: 5,
      format: 'webp',
    });

    const resMeta = await sharp(res.buffer).metadata();

    assert(res.format === 'webp', `Output format is WebP (got: ${res.format})`);
    assert(res.width <= 2048 && res.height <= 2048, `Dimensions bounded to 2048px (got: ${res.width}x${res.height}, original: ${origMeta.width}x${origMeta.height})`);
    assert(res.savingsPercentage > 85, `Achieved >85% storage savings (got: ${res.savingsPercentage}%, from ${(origStat.size / (1024*1024)).toFixed(2)} MB to ${(res.size / 1024).toFixed(1)} KB)`);
    assert(resMeta.space === 'srgb', `Color space is normalized sRGB (got: ${resMeta.space})`);
    assert(!resMeta.exif, `Unnecessary EXIF metadata stripped for privacy`);
  } else {
    console.log('  ⚠️ Sample waist-30.jpg not found, creating synthetic high-res image...');
    const synthetic = await sharp({
      create: { width: 3024, height: 4032, channels: 3, background: { r: 35, g: 65, b: 120 } }
    }).jpeg().toBuffer();
    const res = await optimizeImage(synthetic);
    assert(res.width <= 2048 && res.height <= 2048, `Dimensions bounded to 2048px`);
  }

  // ── TEST 2: Preserves Smaller Assets Without Upscaling ──
  console.log('\nTest 2: Asset Under Max Dimensions (No Upscaling)');
  const smallBuf = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 50, g: 100, b: 150 } }
  }).png().toBuffer();

  const smallRes = await optimizeImage(smallBuf, { maxDimension: 2048 });
  assert(smallRes.width === 800 && smallRes.height === 600, `Preserved native 800x600 without upscaling (got: ${smallRes.width}x${smallRes.height})`);

  // ── TEST 3: Alpha Channel & Transparency Preservation ──
  console.log('\nTest 3: Alpha Channel & Transparent PNG Preservation');
  const transparentBuf = await sharp({
    create: { width: 400, height: 400, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } }
  }).png().toBuffer();

  const alphaRes = await optimizeImage(transparentBuf);
  const alphaMeta = await sharp(alphaRes.buffer).metadata();
  assert(alphaMeta.hasAlpha === true, `Alpha transparency preserved in WebP output`);

  // ── TEST 4: EXIF Orientation Handling ──
  console.log('\nTest 4: Auto-Orientation from EXIF');
  // Create an image with EXIF orientation tag 6 (Rotate 90 CW)
  const orientedBuf = await sharp({
    create: { width: 600, height: 400, channels: 3, background: { r: 100, g: 150, b: 200 } }
  }).withMetadata({ orientation: 6 }).jpeg().toBuffer();

  const orientedRes = await optimizeImage(orientedBuf);
  // After rotate(), 600x400 with orientation 6 becomes 400 wide and 600 high physically
  assert(orientedRes.width === 400 && orientedRes.height === 600, `EXIF orientation 6 correctly transposed to physical dimensions 400x600`);

  // ── TEST 5: Magic Bytes Detection ──
  console.log('\nTest 5: Magic Bytes Binary Inspection');
  const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const fakeFile = Buffer.from('NOT AN IMAGE FILE CONTENT AT ALL');
  
  assert(detectImageMime(jpegMagic) === 'image/jpeg', `Detected JPEG magic bytes`);
  assert(detectImageMime(pngMagic) === 'image/png', `Detected PNG magic bytes`);
  assert(detectImageMime(fakeFile) === null, `Rejected spoofed text file`);

  // ── TEST 6: Invalid & Corrupted File Error Handling ──
  console.log('\nTest 6: Invalid & Corrupted File Error Handling');
  let threwExpected = false;
  try {
    await optimizeImage(Buffer.from('corrupt image garbage data'));
  } catch (err: any) {
    threwExpected = true;
    assert(err.statusCode === 400, `Properly threw 400 Bad Request error on corrupt input`);
  }
  assert(threwExpected, `Rejected corrupt image buffer without crashing`);

  // ── TEST 7: Filename Sanitization & WebP Extension Enforcement ──
  console.log('\nTest 7: Filename Sanitization & Target Extension');
  const safeName = sanitizeSafeFilename('My Summer Denim Jeans #1 (Draft).JPEG', '.webp');
  assert(safeName.endsWith('.webp'), `Applies .webp extension (got: ${safeName})`);
  assert(!safeName.includes('#') && !safeName.includes('('), `Sanitizes special characters (got: ${safeName})`);

  // ── TEST 8: Local Filename Extraction & Traversal Protection ──
  console.log('\nTest 8: Filename Extraction & Path Traversal Prevention');
  const url1 = 'http://localhost:5000/uploads/12345-my-photo.webp';
  const url2 = 'https://images.unsplash.com/photo-1234';
  const traversal = '../../etc/passwd';

  assert(extractLocalFilename(url1) === '12345-my-photo.webp', `Extracted filename from backend URL`);
  assert(extractLocalFilename(url2) === null, `Ignored external URL`);
  
  const traversalResult = await deleteLocalImage(traversal);
  assert(traversalResult === false, `Blocked directory traversal attempt`);

  // ── TEST 9: Visual Quality Fidelity (PSNR Benchmark) ──
  console.log('\nTest 9: Visual Quality Fidelity (PSNR Benchmark)');
  if (existsSync(samplePhotoPath)) {
    const origBuf = await fs.readFile(samplePhotoPath);
    // Baseline reference: uncompressed PNG at 2048px
    const refPng = await sharp(origBuf)
      .rotate()
      .toColorspace('srgb')
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const optWebp = await optimizeImage(origBuf, { quality: 88, maxDimension: 2048 });

    const refRaw = await sharp(refPng).raw().toBuffer();
    const optRaw = await sharp(optWebp.buffer).raw().toBuffer();

    let mse = 0;
    for (let i = 0; i < refRaw.length; i++) {
      const diff = refRaw[i] - optRaw[i];
      mse += diff * diff;
    }
    mse /= refRaw.length;
    const psnr = 10 * Math.log10((255 * 255) / mse);

    console.log(`  Measured PSNR: ${psnr.toFixed(2)} dB (with adaptive edge sharpening enabled)`);
    assert(psnr > 35, `PSNR ${psnr.toFixed(2)} dB > 35 dB threshold (high visual fidelity with enhanced edge sharpness)`);
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
