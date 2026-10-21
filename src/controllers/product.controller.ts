import { Request, Response } from 'express';
import { Product } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/escapeRegex';
import { ProductQueryInput } from '../schemas/product.schema';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const queryInput = req.query as unknown as ProductQueryInput;
  const page = Number(queryInput.page) || 1;
  const limit = Number(queryInput.limit) || 20;
  const skip = (page - 1) * limit;

  const conditions: any[] = [{ isDraft: false }];

  // 1. Keyword search with ReDoS protection
  if (queryInput.keyword) {
    const escaped = escapeRegex(queryInput.keyword);
    conditions.push({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
      ],
    });
  }

  // 2. Category filter
  if (queryInput.category) {
    const escapedCat = escapeRegex(queryInput.category);
    conditions.push({ category: { $regex: `^${escapedCat}$`, $options: 'i' } });
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

  const mongoQuery = conditions.length > 1 ? { $and: conditions } : conditions[0];

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

  const product = await Product.create(req.body);
  sendSuccess(res, product, 'Product created successfully', 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
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
  const updated = await product.save();

  sendSuccess(res, updated, 'Product updated successfully');
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  sendSuccess(res, null, 'Product deleted successfully');
});
