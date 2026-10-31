import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
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

  // 1. Query filter & sorting options for paginated review list
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

  // 2. Execute parallel aggregation pipeline & paginated slice directly inside MongoDB engine
  const [statsResult, reviews, filteredTotal] = await Promise.all([
    Review.aggregate([
      { $match: { productId: targetProductId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
          fitTrue: { $sum: { $cond: [{ $eq: ['$fit', 'true_to_size'] }, 1, 0] } },
          fitSmall: { $sum: { $cond: [{ $eq: ['$fit', 'runs_small'] }, 1, 0] } },
          fitLarge: { $sum: { $cond: [{ $eq: ['$fit', 'runs_large'] }, 1, 0] } },
        },
      },
    ]),
    Review.find(filter).sort(sortOption).skip(skip).limit(limit),
    Review.countDocuments(filter),
  ]);

  const summaryData = statsResult[0] || {
    totalReviews: 0,
    averageRating: 0,
    rating5: 0,
    rating4: 0,
    rating3: 0,
    rating2: 0,
    rating1: 0,
    fitTrue: 0,
    fitSmall: 0,
    fitLarge: 0,
  };

  const totalReviews = summaryData.totalReviews || 0;
  const averageRating = Number((summaryData.averageRating || 0).toFixed(1));
  const ratingBreakdown: Record<number, number> = {
    5: summaryData.rating5 || 0,
    4: summaryData.rating4 || 0,
    3: summaryData.rating3 || 0,
    2: summaryData.rating2 || 0,
    1: summaryData.rating1 || 0,
  };
  const fitBreakdown: Record<string, number> = {
    true_to_size: summaryData.fitTrue || 0,
    runs_small: summaryData.fitSmall || 0,
    runs_large: summaryData.fitLarge || 0,
  };

  const highRatingsCount = (ratingBreakdown[5] || 0) + (ratingBreakdown[4] || 0);
  const recommendPercentage = totalReviews > 0 ? Math.round((highRatingsCount / totalReviews) * 100) : 100;

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

  // Authenticate buyer verification dynamically from historical completed orders
  let verifiedPurchase = false;

  if (req.user?.userId) {
    const matchingOrder = await Order.exists({
      userId: req.user.userId,
      'items.productId': targetProductId,
      status: { $in: ['DELIVERED', 'COURIERED', 'ACCEPTED'] },
    });
    if (matchingOrder) {
      verifiedPurchase = true;
    }
  } else if (body.email) {
    // If guest provided an email, check if any completed order matches this email
    const matchingOrder = await Order.exists({
      $or: [
        { 'shippingAddress.phone': body.email },
        { bkashNumber: body.email },
      ],
      'items.productId': targetProductId,
      status: { $in: ['DELIVERED', 'COURIERED', 'ACCEPTED'] },
    });
    if (matchingOrder) {
      verifiedPurchase = true;
    }
  }

  const review = await Review.create({
    productId: targetProductId,
    name: body.name.trim(),
    email: body.email?.trim() || undefined,
    rating: body.rating,
    title: body.title.trim(),
    comment: body.comment.trim(),
    fit: body.fit || 'true_to_size',
    verifiedPurchase,
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
