import dotenv from 'dotenv';
dotenv.config();

import sharp from 'sharp';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { Server } from 'http';
import { env } from '../src/config/env';

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

async function runE2ETests() {
  console.log('====================================================');
  console.log('       E2E UPLOAD CONTROLLER & API TEST SUITE        ');
  console.log('====================================================\n');

  // 1. Connect MongoDB
  await mongoose.connect(env.MONGODB_URI);

  // 2. Start Express app on random port
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  // 3. Generate valid admin JWT
  const token = jwt.sign(
    { userId: new mongoose.Types.ObjectId().toString(), email: 'admin@jeansloop.com', role: 'ADMIN' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const cleanupFiles: string[] = [];

  try {
    // ── TEST 1: Upload Single High-Res Image ──
    console.log('Test 1: Single High-Res Image Upload via POST /api/v1/upload');
    // Create a 3000x4000 synthetic denim photo
    const highResBuf = await sharp({
      create: {
        width: 3000,
        height: 4000,
        channels: 3,
        background: { r: 28, g: 54, b: 90 }, // Raw denim indigo
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer();

    const formData1 = new FormData();
    formData1.append(
      'image',
      new Blob([highResBuf], { type: 'image/jpeg' }),
      'raw-denim-3000x4000.jpg'
    );

    const res1 = await fetch(`${baseUrl}/api/v1/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData1,
    });

    const json1: any = await res1.json();
    assert(res1.status === 200, `HTTP status is 200 OK (got: ${res1.status})`);
    assert(json1.success === true, `API response indicates success`);
    assert(typeof json1.data.image === 'string', `Returns data.image URL string: ${json1.data.image}`);
    assert(json1.data.image.endsWith('.webp'), `Output URL is .webp format`);
    assert(json1.data.width <= 2048 && json1.data.height <= 2048, `Dimensions bounded to 2048 max`);
    assert(json1.data.savingsPercentage > 50, `Reports storage savings: ${json1.data.savingsPercentage}%`);

    // Verify file exists on disk
    const filename1 = path.basename(new URL(json1.data.image).pathname);
    const diskPath1 = path.join(process.cwd(), 'public', 'uploads', filename1);
    assert(existsSync(diskPath1), `Optimized file exists on disk at ${filename1}`);
    cleanupFiles.push(diskPath1);

    // Verify file is accessible via static GET /uploads/:filename
    const staticRes1 = await fetch(`${baseUrl}/uploads/${filename1}`);
    assert(staticRes1.status === 200, `Static file served with 200 OK via /uploads/${filename1}`);
    assert(staticRes1.headers.get('content-type')?.includes('image/webp') === true, `Served with image/webp content-type`);

    // ── TEST 2: Upload Multiple Images ──
    console.log('\nTest 2: Multiple Images Upload via POST /api/v1/upload/multiple');
    const imgBufA = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: { r: 40, g: 70, b: 120 } } }).jpeg().toBuffer();
    const imgBufB = await sharp({ create: { width: 1500, height: 2000, channels: 3, background: { r: 50, g: 80, b: 130 } } }).jpeg().toBuffer();

    const formData2 = new FormData();
    formData2.append('images', new Blob([imgBufA], { type: 'image/jpeg' }), 'jeans-angle-1.jpg');
    formData2.append('images', new Blob([imgBufB], { type: 'image/jpeg' }), 'jeans-angle-2.jpg');

    const res2 = await fetch(`${baseUrl}/api/v1/upload/multiple`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData2,
    });

    const json2: any = await res2.json();
    assert(res2.status === 200, `HTTP status is 200 OK (got: ${res2.status})`);
    assert(Array.isArray(json2.data.images), `Returns data.images array`);
    assert(json2.data.images.length === 2, `Contains exactly 2 uploaded URLs`);
    assert(json2.data.images.every((u: string) => u.endsWith('.webp')), `All uploaded files are .webp`);

    for (const url of json2.data.images) {
      const fn = path.basename(new URL(url).pathname);
      const fp = path.join(process.cwd(), 'public', 'uploads', fn);
      cleanupFiles.push(fp);
      assert(existsSync(fp), `Batch file exists on disk: ${fn}`);
    }

    // ── TEST 3: Reject Non-Image or Corrupted Upload ──
    console.log('\nTest 3: Reject Non-Image or Corrupted Upload');
    const fakeData = new FormData();
    fakeData.append('image', new Blob(['console.log("hello malicious script");'], { type: 'text/javascript' }), 'malicious.js');

    const res3 = await fetch(`${baseUrl}/api/v1/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: fakeData,
    });

    const json3: any = await res3.json();
    assert(res3.status === 400, `Rejects unauthorized non-image file with 400 Bad Request (got: ${res3.status})`);
    assert(json3.success === false, `Error response indicates failure`);

  } finally {
    // Clean up temporary test files
    for (const fp of cleanupFiles) {
      if (existsSync(fp)) {
        await fs.unlink(fp).catch(() => {});
      }
    }
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`API TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error('API Test Error:', err);
  process.exit(1);
});
