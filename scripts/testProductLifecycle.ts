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

async function runLifecycleTest() {
  console.log('====================================================');
  console.log('     PRODUCT LIFECYCLE & IMAGE CLEANUP TEST         ');
  console.log('====================================================\n');

  await mongoose.connect(env.MONGODB_URI);

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  const token = jwt.sign(
    { userId: new mongoose.Types.ObjectId().toString(), email: 'admin@jeansloop.com', role: 'ADMIN' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    // Step 1: Upload a new test product image via /api/v1/upload
    console.log('Step 1: Uploading image for new product test...');
    const testImgBuf = await sharp({
      create: { width: 1800, height: 2400, channels: 3, background: { r: 30, g: 60, b: 100 } }
    }).jpeg().toBuffer();

    const fd = new FormData();
    fd.append('image', new Blob([testImgBuf], { type: 'image/jpeg' }), 'lifecycle-test-jeans.jpg');

    const upRes = await fetch(`${baseUrl}/api/v1/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const upJson: any = await upRes.json();
    assert(upRes.status === 200, `Image uploaded successfully`);
    const imageUrl = upJson.data.image;
    assert(imageUrl.endsWith('.webp'), `Uploaded image is .webp: ${imageUrl}`);

    const filename = path.basename(new URL(imageUrl).pathname);
    const diskPath = path.join(process.cwd(), 'public', 'uploads', filename);
    assert(existsSync(diskPath), `Uploaded image exists on disk at ${filename}`);

    // Step 2: Create product referencing this image
    console.log('\nStep 2: Creating product referencing uploaded image...');
    const testSlug = `lifecycle-denim-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Lifecycle Test Raw Denim',
        slug: testSlug,
        price: 2450,
        category: 'jeans',
        images: [imageUrl],
        variants: [{ sku: `${testSlug}-32`, size: '32', color: 'Dark Indigo', price: 2450, stock: 15 }],
        isDraft: false,
      }),
    });

    const createJson: any = await createRes.json();
    assert(createRes.status === 201, `Product created successfully with status 201`);
    const productId = createJson.data._id;

    // Step 3: Fetch product by slug
    console.log('\nStep 3: Fetching product by slug via public storefront endpoint...');
    const getRes = await fetch(`${baseUrl}/api/v1/products/${testSlug}`);
    const getJson: any = await getRes.json();
    assert(getRes.status === 200, `Fetched product by slug with 200 OK`);
    assert(getJson.data.images[0] === imageUrl, `Returned images array matches uploaded URL`);

    // Step 4: Update product
    console.log('\nStep 4: Updating product price and highlights...');
    const updateRes = await fetch(`${baseUrl}/api/v1/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        price: 2200,
        highlights: ['100% Selvedge Denim', 'Hand-stitched hems'],
      }),
    });
    const updateJson: any = await updateRes.json();
    assert(updateRes.status === 200, `Updated product successfully`);
    assert(updateJson.data.price === 2200, `Updated price is reflected: ${updateJson.data.price}`);

    // Step 5: Delete product and verify automatic image cleanup
    console.log('\nStep 5: Deleting product and testing automatic image cleanup...');
    const delRes = await fetch(`${baseUrl}/api/v1/products/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(delRes.status === 200, `Product deleted successfully via DELETE /api/v1/products/${productId}`);

    // Verify image was removed from disk
    const stillOnDisk = existsSync(diskPath);
    assert(!stillOnDisk, `Unreferenced product image was safely cleaned up from disk (${filename})`);

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`LIFECYCLE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLifecycleTest().catch((err) => {
  console.error('Lifecycle test error:', err);
  process.exit(1);
});
