import { Request, Response } from 'express';
import { Category } from '../models/Category';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { cache } from '../services/cache.service';

const CATEGORIES_CACHE_KEY = 'categories:all';

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const cached = await cache.get(CATEGORIES_CACHE_KEY);
  if (cached) {
    return sendSuccess(res, cached);
  }

  const categories = await Category.find().sort({ order: 1, name: 1 });
  await cache.set(CATEGORIES_CACHE_KEY, categories, 300); // 5 min TTL
  sendSuccess(res, categories);
});

export const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await Category.findById(id);
  if (!category) {
    throw AppError.notFound('Category not found');
  }
  sendSuccess(res, category);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Category.findOne({ slug: req.body.slug });
  if (existing) {
    throw AppError.conflict('A category with this slug already exists');
  }

  const category = await Category.create(req.body);
  await cache.del(CATEGORIES_CACHE_KEY);
  sendSuccess(res, category, 'Category created successfully', 201);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await Category.findById(id);
  if (!category) {
    throw AppError.notFound('Category not found');
  }

  if (req.body.slug && req.body.slug !== category.slug) {
    const existing = await Category.findOne({ slug: req.body.slug });
    if (existing) {
      throw AppError.conflict('A category with this slug already exists');
    }
  }

  Object.assign(category, req.body);
  const updated = await category.save();
  await cache.del(CATEGORIES_CACHE_KEY);

  sendSuccess(res, updated, 'Category updated successfully');
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const category = await Category.findByIdAndDelete(id);
  if (!category) {
    throw AppError.notFound('Category not found');
  }
  await cache.del(CATEGORIES_CACHE_KEY);
  sendSuccess(res, null, 'Category deleted successfully');
});
