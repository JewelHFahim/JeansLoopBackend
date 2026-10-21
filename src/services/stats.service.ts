import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  salesHistory: Array<{ _id: string; totalSales: number; orderCount: number }>;
  orderStatusDistribution: Array<{ _id: string; count: number }>;
}

let cachedStats: DashboardStats | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateStatsCache(): void {
  cachedStats = null;
  lastCacheTime = 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = Date.now();
  if (cachedStats && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedStats;
  }

  // Run aggregations and counts in parallel
  const [
    totalOrders,
    totalProducts,
    totalUsers,
    totalSalesResult,
    salesHistory,
    orderStatusDistribution,
  ] = await Promise.all([
    Order.countDocuments(),
    Product.countDocuments({ isDraft: false }),
    User.countDocuments({ role: 'CUSTOMER' }),

    // Total sales from delivered or paid orders
    Order.aggregate([
      { $match: { status: { $nin: ['CANCELLED', 'RETURNED'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),

    // Sales over the last 30 days
    Order.aggregate([
      {
        $match: {
          status: { $nin: ['CANCELLED', 'RETURNED'] },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Order status breakdown
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const totalSales = totalSalesResult[0]?.total || 0;

  cachedStats = {
    totalSales,
    totalOrders,
    totalProducts,
    totalUsers,
    salesHistory,
    orderStatusDistribution,
  };

  lastCacheTime = now;
  return cachedStats;
}
