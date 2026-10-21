# JeansLoop Backend REST API

High-performance, secure Node.js & TypeScript REST API service for the JeansLoop e-commerce ecosystem.

## Features & Improvements
- **Strict Server-Side Pricing & Shipping**: Calculates total prices and city-based shipping (Dhaka/Gazipur/Narayanganj: ৳70, Outside: ৳140) strictly on the server to prevent price-tampering attacks.
- **Zod Validation Middleware**: All incoming payloads for auth, products, categories, orders, coupons, settings, and sliders are strongly validated before reaching controllers.
- **Atomic Operations & N+1 Elimination**: Orders utilize batch MongoDB lookups (`Product.find({ _id: { $in: ids } })`) and `Product.bulkWrite` for atomic stock decrementing and rollback.
- **ReDoS Protection**: User search queries are sanitized through `escapeRegex()` to eliminate regular expression denial-of-service vulnerabilities.
- **Cloudinary & Local Storage**: Dynamic file upload provider with MIME validation and filename sanitization.
- **Role-Based Access Control**: Strict `protect` and `admin` middlewares with automated JWT verification and user active-state checks.
- **Security Hardened**: Configured with `helmet`, `cors`, and `express-rate-limit`.

---

## Tech Stack
- **Runtime**: Node.js 22 (LTS)
- **Language**: TypeScript 5.6
- **Framework**: Express 5
- **Database**: MongoDB with Mongoose 8
- **Validation**: Zod 3.23
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) + `bcryptjs`
- **File Uploads**: `multer` + `cloudinary`
- **Testing/Linting**: `tsc --noEmit`

---

## Directory Structure
```
src/
├── config/             # Environment, DB, Cloudinary configuration
├── controllers/        # Request handlers (auth, product, order, coupon, etc.)
├── middleware/         # Auth, validation, error handler, rate limiters
├── models/             # Mongoose models & schemas
├── routes/             # Express route declarations
├── schemas/            # Zod validation schemas
├── services/           # Business logic (pricing, inventory, courier)
├── utils/              # Custom AppError, response formatters, regex helpers
└── server.ts           # Application entry point
```

---

## Setup & Running

### 1. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your MongoDB connection string and JWT secret are configured:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/jeansloop
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long_for_security!
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
STORAGE_TYPE=LOCAL
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Seed Initial Data
```bash
# Seed default admin user (admin@jeansloop.com / Admin@123456)
npm run seed:admin

# Seed sample categories and products
npm run seed

# Seed hero sliders
npm run seed:sliders
```

### 4. Development & Build
```bash
# Run in development mode with hot reload
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build

# Start production server
npm start
```

---

## Docker Support
```bash
docker build -t jeansloop-backend .
docker run -p 5000:5000 --env-file .env jeansloop-backend
```
