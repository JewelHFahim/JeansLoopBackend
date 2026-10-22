import { IProduct } from '../models/Product';
import { OrderItemInput } from '../schemas/order.schema';

/**
 * Calculates delivery fee server-side based on recipient city/district.
 * Dhaka = ৳70. All other districts = ৳140.
 */
export function calculateShippingFee(city: string): number {
  if (!city) return 140;
  const normalized = city.trim().toLowerCase();
  if (normalized === 'dhaka' || normalized === 'dhaka city' || normalized === 'inside dhaka') {
    return 70;
  }
  return 140;
}

/**
 * Resolves the genuine line item unit price directly from the database product record.
 * Priority: product.discountedPrice > matching variant.price > product.price
 */
export function resolveLineItemPrice(product: IProduct, item: OrderItemInput): number {
  // If product has an active discount, use it
  if (product.discountedPrice && product.discountedPrice > 0) {
    return product.discountedPrice;
  }

  // Look for matching variant
  const variant = product.variants.find(
    (v) => (item.variantSku && v.sku === item.variantSku) || (item.size && v.size === item.size)
  );

  if (variant && variant.price > 0) {
    return variant.price;
  }

  return product.price;
}
