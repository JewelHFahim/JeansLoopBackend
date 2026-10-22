export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'SUPPORT' | 'CUSTOMER';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'COURIERED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'EXCHANGE';

export type PaymentMethod = 'cod' | 'bkash' | 'card';
export type StorageType = 'LOCAL' | 'CLOUDINARY';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
