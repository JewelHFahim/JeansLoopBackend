import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review, ReviewStatus } from '../models/Review';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/escapeRegex';
import { recordActivity } from '../services/activity.service';
import {
  CreateReviewInput,
  ReviewQueryInput,
  AdminReviewQueryInput,
  UpdateReviewStatusInput,
} from '../schemas/review.schema';

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

/**
 * Public: Get reviews for a product (Approved reviews ONLY)
 */
export const getProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const productIdOrSlug = String(req.params.productIdOrSlug);
  const queryInput = req.query as unknown as ReviewQueryInput;

  const targetProductId = await resolveProductId(productIdOrSlug);

  // 1. Query filter & sorting options for approved review list
  const filter: any = {
    productId: targetProductId,
    status: 'approved',
  };

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

  // 2. Parallel aggregation for approved reviews stats & paginated list
  const [statsResult, reviews, filteredTotal] = await Promise.all([
    Review.aggregate([
      { $match: { productId: targetProductId, status: 'approved' } },
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

/**
 * User: Create a review for a product (Logged-in users only; initial status: pending)
 */
export const createProductReview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw AppError.unauthorized('Please log in to submit a review');
  }

  const body = req.body as CreateReviewInput;
  const targetProductId = await resolveProductId(body.productId);

  // Retrieve user record to ensure accurate display name & email
  const user = await User.findById(userId).select('name email phone');
  if (!user) {
    throw AppError.unauthorized('User account not found');
  }

  // Check buyer verification from historical completed orders
  const matchingOrder = await Order.exists({
    userId: new mongoose.Types.ObjectId(userId),
    'items.productId': targetProductId,
    status: { $in: ['DELIVERED', 'COURIERED', 'ACCEPTED'] },
  });
  const verifiedPurchase = Boolean(matchingOrder);

  // Initial review created with status 'pending' (requires admin approval)
  const review = await Review.create({
    productId: targetProductId,
    userId: new mongoose.Types.ObjectId(userId),
    name: body.name?.trim() || user.name,
    email: body.email?.trim() || user.email,
    rating: body.rating,
    title: body.title.trim(),
    comment: body.comment.trim(),
    fit: body.fit || 'true_to_size',
    verifiedPurchase,
    helpfulCount: 0,
    status: 'pending',
  });

  return sendSuccess(
    res,
    review,
    'Thank you! Your review has been submitted and will appear once approved by our moderation team.',
    201
  );
});

/**
 * Public: Vote a review as helpful
 */
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

/**
 * Admin: List all reviews with filters, status tabs, search & pagination
 */
export const getAllReviewsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const queryInput = req.query as unknown as AdminReviewQueryInput;
  const { status, productId, rating, keyword } = queryInput;

  const filter: any = {};

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (productId) {
    if (mongoose.Types.ObjectId.isValid(productId)) {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }
  }

  if (rating) {
    filter.rating = Number(rating);
  }

  if (keyword && keyword.trim()) {
    const escaped = escapeRegex(keyword.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { title: { $regex: escaped, $options: 'i' } },
      { comment: { $regex: escaped, $options: 'i' } },
    ];
  }

  const page = Number(queryInput.page) || 1;
  const limit = Number(queryInput.limit) || 20;
  const skip = (page - 1) * limit;

  const [reviews, total, pendingCount, approvedCount, rejectedCount, totalCount] = await Promise.all([
    Review.find(filter)
      .populate('productId', 'name slug images price category')
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    Review.countDocuments({ status: 'pending' }),
    Review.countDocuments({ status: 'approved' }),
    Review.countDocuments({ status: 'rejected' }),
    Review.countDocuments({}),
  ]);

  return sendSuccess(
    res,
    {
      items: reviews,
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: totalCount,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    },
    'Admin reviews retrieved successfully'
  );
});

/**
 * Admin: Approve, Reject, or reset Review status
 */
export const updateReviewStatus = asyncHandler(async (req: Request, res: Response) => {
  const reviewId = String(req.params.reviewId);
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new AppError('Invalid review ID', 400, 'INVALID_ID');
  }

  const { status } = req.body as UpdateReviewStatusInput;

  const review = await Review.findByIdAndUpdate(
    reviewId,
    { status },
    { new: true }
  )
    .populate('productId', 'name slug images')
    .populate('userId', 'name email phone');

  if (!review) {
    throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');
  }

  // Record administrative activity log
  if (req.user?.userId) {
    const productName = (review.productId as any)?.name || 'Product';
    recordActivity({
      userId: req.user.userId,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'UPDATE',
      entityType: 'REVIEW',
      entityId: review._id.toString(),
      entityTitle: `Review for ${productName}`,
      description: `Review by ${review.name} marked as ${status.toUpperCase()}`,
      details: {
        status,
        rating: review.rating,
        reviewId: review._id.toString(),
      },
    }).catch(() => {});
  }

  return sendSuccess(
    res,
    review,
    `Review status updated to ${status}`
  );
});

/**
 * Admin: Delete a review permanently
 */
export const deleteReviewAdmin = asyncHandler(async (req: Request, res: Response) => {
  const reviewId = String(req.params.reviewId);
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new AppError('Invalid review ID', 400, 'INVALID_ID');
  }

  const review = await Review.findByIdAndDelete(reviewId);
  if (!review) {
    throw new AppError('Review not found', 404, 'REVIEW_NOT_FOUND');
  }

  // Record administrative activity log
  if (req.user?.userId) {
    recordActivity({
      userId: req.user.userId,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'DELETE',
      entityType: 'REVIEW',
      entityId: reviewId,
      entityTitle: `Review by ${review.name}`,
      description: `Review by ${review.name} permanently removed`,
      details: {
        rating: review.rating,
        reviewId,
      },
    }).catch(() => {});
  }

  return sendSuccess(res, null, 'Review deleted successfully');
});
