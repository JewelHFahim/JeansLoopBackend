import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { Product } from '../models/Product';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { CreateReviewInput, ReviewQueryInput } from '../schemas/review.schema';

// Helper to resolve product ID from either ObjectId string or product slug
async function resolveProductId(identifier: string): Promise<mongoose.Types.ObjectId> {
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const product = await Product.findById(identifier).select('_id');
    if (product) return product._id as mongoose.Types.ObjectId;
  }

  const product = await Product.findOne({ slug: identifier.toLowerCase().trim() }).select('_id');
  if (!product) {
    throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
  }
  return product._id as mongoose.Types.ObjectId;
}

export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const productIdOrSlug = String(req.params.productIdOrSlug);
  const queryInput = req.query as unknown as ReviewQueryInput;

  const targetProductId = await resolveProductId(productIdOrSlug);

  // 1. Calculate aggregated summary for all reviews of this product
  const allProductReviews = await Review.find({ productId: targetProductId }).select('rating fit helpfulCount');

  const totalReviews = allProductReviews.length;
  let averageRating = 0;
  const ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const fitBreakdown: Record<string, number> = { true_to_size: 0, runs_small: 0, runs_large: 0 };

  if (totalReviews > 0) {
    let sum = 0;
    allProductReviews.forEach((r) => {
      sum += r.rating;
      if (ratingBreakdown[r.rating] !== undefined) {
        ratingBreakdown[r.rating] += 1;
      }
      if (r.fit && fitBreakdown[r.fit] !== undefined) {
        fitBreakdown[r.fit] += 1;
      }
    });
    averageRating = Number((sum / totalReviews).toFixed(1));
  }

  const highRatingsCount = (ratingBreakdown[5] || 0) + (ratingBreakdown[4] || 0);
  const recommendPercentage = totalReviews > 0 ? Math.round((highRatingsCount / totalReviews) * 100) : 100;

  // 2. Query filtered & sorted reviews list
  const filter: any = { productId: targetProductId };
  if (queryInput.rating) {
    filter.rating = Number(queryInput.rating);
  }

  let sortOption: any = { createdAt: -1 };
  if (queryInput.sort === 'highest') {
    sortOption = { rating: -1, createdAt: -1 };
  } else if (queryInput.sort === 'lowest') {
    sortOption = { rating: 1, createdAt: -1 };
  } else if (queryInput.sort === 'helpful') {
    sortOption = { helpfulCount: -1, createdAt: -1 };
  }

  const page = Number(queryInput.page) || 1;
  const limit = Number(queryInput.limit) || 20;
  const skip = (page - 1) * limit;

  const [reviews, filteredTotal] = await Promise.all([
    Review.find(filter).sort(sortOption).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    {
      summary: {
        totalReviews,
        averageRating,
        recommendPercentage,
        ratingBreakdown,
        fitBreakdown,
      },
      reviews,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit) || 1,
      },
    },
    'Product reviews retrieved successfully'
  );
});

export const createProductReview = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateReviewInput;
  const targetProductId = await resolveProductId(body.productId);

  const review = await Review.create({
    productId: targetProductId,
    name: body.name.trim(),
    email: body.email?.trim() || undefined,
    rating: body.rating,
    title: body.title.trim(),
    comment: body.comment.trim(),
    fit: body.fit || 'true_to_size',
    verifiedPurchase: true,
    helpfulCount: 0,
  });

  return sendSuccess(res, review, 'Thank you! Your review has been posted.', 201);
});

export const voteReviewHelpful = asyncHandler(async (req: Request, res: Response) => {
  const reviewId = String(req.params.reviewId);

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new AppError('Invalid review ID', 400, 'INVALID_ID');
  }

  const review = await Review.findByIdAndUpdate(
    reviewId,
    { $inc: { helpfulCount: 1 } },
    { new: true }
  );

  if (!review) {
    throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');
  }

  return sendSuccess(res, review, 'Marked review as helpful');
});
