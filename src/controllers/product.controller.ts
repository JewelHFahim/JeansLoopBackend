import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { recordActivity } from '../services/activity.service';
import { escapeRegex } from '../utils/escapeRegex';
import { ProductQueryInput } from '../schemas/product.schema';
import { deleteLocalImage } from '../services/image.service';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const queryInput = req.query as unknown as ProductQueryInput;
  const page = Number(queryInput.page) || 1;
  const limit = Number(queryInput.limit) || 20;
  const skip = (page - 1) * limit;

  const conditions: any[] = [];

  // Status / Draft filter
  if (queryInput.status === 'published') {
    conditions.push({ isDraft: false });
  } else if (queryInput.status === 'draft') {
    conditions.push({ isDraft: true });
  } else if (!queryInput.includeDrafts && queryInput.status !== 'all') {
    // Default public storefront behavior: only published
    conditions.push({ isDraft: false });
  }

  // 1. Keyword search with ReDoS protection
  if (queryInput.keyword) {
    const escaped = escapeRegex(queryInput.keyword);
    conditions.push({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
        { 'variants.sku': { $regex: escaped, $options: 'i' } },
      ],
    });
  }

  // 2. Category filter
  if (queryInput.category && queryInput.category !== 'all') {
    const cat = queryInput.category.toLowerCase();
    if (cat === 'formal' || cat === 'trouser') {
      conditions.push({ category: { $regex: '^(formal|trouser)$', $options: 'i' } });
    } else {
      const escapedCat = escapeRegex(queryInput.category);
      conditions.push({ category: { $regex: `^${escapedCat}$`, $options: 'i' } });
    }
  }

  // 3. Discount filter (doesn't overwrite keyword $or)
  if (queryInput.hasDiscount) {
    conditions.push({
      $or: [
        { discountPercentage: { $gt: 0 } },
        { discountAmount: { $gt: 0 } },
        { discountedPrice: { $gt: 0 } },
      ],
    });
  }

  // 4. Price range filter
  if (queryInput.minPrice !== undefined || queryInput.maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (queryInput.minPrice !== undefined) priceFilter.$gte = Number(queryInput.minPrice);
    if (queryInput.maxPrice !== undefined) priceFilter.$lte = Number(queryInput.maxPrice);
    conditions.push({ price: priceFilter });
  }

  // 5. Size filter on variants array
  if (queryInput.size) {
    conditions.push({ 'variants.size': queryInput.size });
  }

  // 6. Stock status filter
  if (queryInput.stockStatus === 'inStock') {
    conditions.push({ 'variants.stock': { $gt: 0 } });
  } else if (queryInput.stockStatus === 'outOfStock') {
    conditions.push({ 'variants.stock': { $not: { $gt: 0 } } });
  } else if (queryInput.stockStatus === 'lowStock') {
    conditions.push({ 'variants.stock': { $gt: 0, $lte: 5 } });
  }

  const mongoQuery = conditions.length > 1 ? { $and: conditions } : conditions.length === 1 ? conditions[0] : {};

  // Sorting
  let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
  if (queryInput.sort === 'price-low') sortOption = { price: 1 };
  if (queryInput.sort === 'price-high') sortOption = { price: -1 };
  if (queryInput.sort === 'name') sortOption = { name: 1 };

  const [products, total] = await Promise.all([
    Product.find(mongoQuery).sort(sortOption).skip(skip).limit(limit),
    Product.countDocuments(mongoQuery),
  ]);

  sendPaginated(res, products, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const product = await Product.findOne({ slug: slug.toLowerCase() });
  if (!product) {
    throw AppError.notFound(`Product with slug "${slug}" not found`);
  }
  sendSuccess(res, product);
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound(`Product with ID "${id}" not found`);
  }
  sendSuccess(res, product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  // Check slug uniqueness
  const existing = await Product.findOne({ slug: req.body.slug });
  if (existing) {
    throw AppError.conflict('A product with this slug already exists');
  }

  const productData = {
    ...req.body,
    createdBy: {
      userId: req.user!.userId,
      email: req.user!.email,
    },
  };

  const product = await Product.create(productData);

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'PRODUCT_CREATED',
    entityType: 'PRODUCT',
    entityId: product._id.toString(),
    entityTitle: product.name,
    description: `Created new product "${product.name}"`,
  });

  sendSuccess(res, product, 'Product created successfully', 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }

  if (req.body.slug && req.body.slug !== product.slug) {
    const existing = await Product.findOne({ slug: req.body.slug });
    if (existing) {
      throw AppError.conflict('A product with this slug already exists');
    }
  }

  Object.assign(product, req.body);
  product.updatedBy = {
    userId: req.user!.userId as any,
    email: req.user!.email,
  };
  const updated = await product.save();

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'PRODUCT_UPDATED',
    entityType: 'PRODUCT',
    entityId: updated._id.toString(),
    entityTitle: updated.name,
    description: `Updated product details/pricing for "${updated.name}"`,
  });

  sendSuccess(res, updated, 'Product updated successfully');
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }

  // File cleanup: delete product images from local storage if not referenced by any other product
  if (Array.isArray(product.images) && product.images.length > 0) {
    for (const imgUrl of product.images) {
      try {
        const stillInUse = await Product.exists({ images: imgUrl });
        if (!stillInUse) {
          await deleteLocalImage(imgUrl);
        }
      } catch (err) {
        console.warn(`[deleteProduct] Image cleanup error for "${imgUrl}":`, err);
      }
    }
  }

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'PRODUCT_DELETED',
    entityType: 'PRODUCT',
    entityId: id,
    entityTitle: product.name,
    description: `Deleted product "${product.name}" permanently`,
  });

  sendSuccess(res, null, 'Product deleted successfully');
});
