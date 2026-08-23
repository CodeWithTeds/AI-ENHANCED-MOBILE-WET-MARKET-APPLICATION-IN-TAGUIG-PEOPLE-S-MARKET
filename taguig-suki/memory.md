# Project Memory — Taguig Suki

> Last updated: 2026-08-22

A digital marketplace platform for a public market in Taguig (wet-market style e-commerce with vendor stalls, inventory, ordering, and AI recipe search).

## Repo Layout

Single git repo at `cap-taguig/` containing **two apps**:

| Path | Stack | Purpose |
|---|---|---|
| `taguig-suki/` | Laravel 13 + Inertia 3 + React 19 (Vite) | Backend API + Admin/Settings web UI |
| `mobile/client/` | Expo SDK 57 (expo-router, RN 0.86) | Mobile app: customer + vendor flows |

- Backend serves the mobile app via a **JSON API** (`/api/v1`), and the web admin via **Inertia**.
- Web UI (pages under `resources/js/pages/`): `admin/{pending,documents,stalls,vendors,inventory,orders,recommendations,reports,feedback}` + `auth/` + `settings/` + `dashboard` + `welcome`.
- Mobile UI (routes under `mobile/client/src/app/`): `(customer)/` home, explore, cart, orders, track/[id], profile + `(vendor)/` dashboard, products, inventory, orders, profile + auth/registration screens.

## Tech Stack

- **Backend:** PHP 8.3, Laravel 13, Sanctum (API tokens), Fortify (web auth + 2FA), spatie/laravel-query-builder, Wayfinder, laravel/boost
- **Frontend (web):** Inertia 3, React 19, Tailwind 4, shadcn/ui (radix + CVA), sonner toasts, lucide-react
- **Mobile:** Expo 57, expo-router, React Native 0.86, AsyncStorage, expo-image-picker (vendor doc uploads), vector icons
- **Testing:** Pest + PHPUnit (`tests/Feature`, `tests/Unit`); Pint for PHP lint; ESLint + Prettier + `tsc --noEmit` for JS
- **DB:** MySQL `taguig_suki` (XAMPP localhost, root, no password) — see `.env`

## Architecture Patterns (backend)

- **Service layer:** domain logic lives in `app/Services/*` — core: `OrderService`, `MarketplaceService`, `RecipeService`, `InventoryService`, `AuthService`, `VendorRegistrationService`, `CustomerProfileService`, `VendorProfileService`, `StallService`, `ProductService`, `ReviewService` + **Admin/**: `SectionService`, `StallManagementService`, `VendorApprovalService`, `VendorManagementService`, `InventoryMonitoringService`, `OrderManagementService`, `AiRecommendationManagementService`, `ReportsAnalyticsService`, `FeedbackManagementService`.
- **Repository pattern (partial):** `app/Repositories/` for Task + Vendor + Product (`BaseRepository` + interfaces), registered in `RepositoryServiceProvider`.
- **API responses:** controllers `use ApiResponse` trait (`successResponse` / `errorResponse` → `{status, message, data}`); errors centralized in `ApiExceptionHandler` (Validation → 422, ModelNotFound → 404, etc.).
- **Form Requests** validate input in `app/Http/Requests/`; admin controllers return `back()->with('success', ...)` for Inertia flash. Admin `UpdateOrderStatusRequest` validates order status transitions.
- **Enums:** `app/Enums/` with `label()` — includes Taglish labels for stock adjustments (Restock = "Bagong Dating", Sold = "Nabenta", Spoiled = "Nasira"), plus `StallStatus`, `StallSize`, `VendorStatus`, `InventoryStatus`, `TaskStatus`.
- **Policies:** `BasePolicy`, `TaskPolicy`; admin gated by `users.is_admin`.

## Domain Model

- `users` — customers + vendors + admins (`is_admin` flag, Fortify 2FA columns, Sanctum tokens, `notification_preferences` JSON)
- `sections` — market areas (name, slug, color, is_active)
- `stalls` — physical stalls (section_id, stall_number, store_name, vendor_id, status: occupied/vacant/under_maintenance, size: small/medium/large, monthly_rent, image)
- `vendors` — vendor profiles (user_id, stall_name, stall_location, product_categories JSON, status: pending/approved/rejected/suspended, rejection_reason, approved_at, notification_preferences JSON) → hasMany products/inventories/documents
- `vendor_documents` — business_permit / stall_lease / valid_id uploads
- `products` — vendor products (vendor_id, name, category, price, unit: kg/pcs/bundle/pack, image, is_available)
- `inventories` — stock per product (product_id, vendor_id, stock_quantity, reorder_level, max_stock_level, cost_price/puhunan, selling_price, markup_percentage, status: active/inactive/seasonal/discontinued) + computed `profit_per_unit`, `inventory_value`, scopes `lowStock`/`outOfStock`/`forVendor`/`active`
- `inventory_logs` — stock movements (restock, sold, returned, spoiled, adjustment, reserved, unreserved, transferred, initial) with quantity_before/change/after, unit_cost, performed_by, reference_number
- `orders` + `order_items` — customer orders (order_number `ORD-YYYYMMDD-NNNN`, status: pending→confirmed→processing→ready→completed/cancelled, payment_method: cash/gcash/maya, item snapshots with vendor_id, unit_price, subtotal)
- `order_status_histories` — full status timeline per order (every status change logged with timestamp + note; powers the tracking screen and admin timeline)
- `reviews` — polymorphic reviews: vendors + products (gated on COMPLETED orders, unique per user+target) and AI recipes (keyed by `recipe_name`, auth only) + **admin fields** `status` (pending/in_review/resolved/dismissed, default pending), `admin_response` text, `resolved_at` datetime — added in `2026_08_18_000000_add_admin_fields_to_reviews_table`
- `recipe_recommendations` — log of every AI recipe search (query, recipe_name, status: found/not_found/error, payload + matching_products JSON, error_message, nullable user_id) — powers the admin AI Recommendations dashboard
- `tasks` — todo/demo feature (TaskRepository + TaskResource + TaskPolicy, auth:sanctum — public `apiResource` outside auth group, kept for scaffolding)

## API v1 (`routes/api/v1.php`)

Public: `POST /login`, `POST /register`, `POST /vendor/register`, `GET /sections`, `GET /stalls/vacant`, `GET /marketplace/{featured,products,products/search,products/{id},categories}`, `GET /recipes/search` (Gemini AI).

Auth (`auth:sanctum`): logout, `GET /user`, `GET /vendor/status`, product CRUD, vendor profile (business/password/notifications), **customer profile** (`GET /profile`, `PUT /profile`, `PUT /profile/password`, `PUT /profile/notifications`), inventory CRUD + `GET /inventory/summary` + `GET /inventory/logs` + `POST /inventory/{id}/adjust` + `GET /inventory/{id}/history`, `POST /orders` (atomic), `GET /orders` (customer history), `GET /orders/{id}` + `GET /orders/{id}/track` (status timeline), reviews (`GET /reviews/eligible`, `POST /reviews/{vendor,product,recipe}`, `PUT/DELETE /reviews/{review}`), vendor orders + status updates (`GET /vendor/orders`, `PATCH /vendor/orders/{id}/status`). Plus `GET /vendor/profile` + `PUT /vendor/profile/*`.

Public reviews: `GET /reviews/vendor/{vendor}`, `GET /reviews/product/{product}`, `GET /reviews/recipe?q=` (listing + aggregates).

`apiResource('tasks')` is **public** (outside auth group) — `GET|POST /tasks`, `GET|PUT|DELETE /tasks/{id}`.

## Admin Web Routes (`routes/web.php` — `auth` + `verified`, prefix `admin`)

- `GET /` → `welcome` (Inertia, `canRegister` flag)
- `GET /admin/dashboard` → Inertia dashboard
- **Sections:** `GET|POST /admin/dashboard/vendors/sections`, `PUT|DELETE /admin/dashboard/vendors/sections/{section}` → `SectionController`
- **Stalls:** `GET /admin/dashboard/vendors/stalls` (+ store/update/destroy) → `StallController@index` renders `admin/stalls/index` (filters: section, status, size, is_active, search, sort)
- **All Vendors:** `GET /admin/dashboard/vendors` → `VendorManagementController@index` (`admin/vendors/index`); `POST /{vendor}/suspend|activate`
- **Pending Approval:** `GET /admin/dashboard/vendors/pending` → `VendorApprovalController@index` (`admin/pending/index`); `POST /{vendor}/approve|reject`
- **Documents:** `GET /admin/dashboard/vendors/documents` → `VendorApprovalController@documents` (`admin/documents/index`)
- **Inventory Monitoring:** `GET /admin/dashboard/inventory` → `InventoryMonitoringController@index` (`admin/inventory/index`) — read-only cross-vendor view with filters (stock_status, category, vendor, search)
- **Order Management:** `GET /admin/dashboard/orders` + `PATCH /orders/{order}/status` → `OrderManagementController` (`admin/orders/index`)
- **Reports & Analytics:** `GET /admin/dashboard/reports` → `ReportsAnalyticsController@index` (`admin/reports/index`) — range param `7d|30d|90d|12m|all`
- **AI Recommendations:** `GET /admin/dashboard/recommendations` + `DELETE /{rec}` + `DELETE /` (clear all) → `AiRecommendationManagementController` (`admin/recommendations/index`)
- **Feedback & Complaints:** `GET /admin/dashboard/feedback` + `POST /{review}/respond` + `PATCH /{review}/status` → `FeedbackController` (`admin/feedback/index`)

## Admin Dashboards — Details

- **Vendor Management (`admin/vendors`)** — `VendorManagementService`: paginated vendors with user/docs/products/inventories counts, stall_number lookup, stats (total/approved/pending/suspended/rejected), status+category+search filters, suspend/activate actions.
- **Inventory Monitoring (`admin/inventory`)** — `InventoryMonitoringService`: cross-vendor inventory read-only view (product + vendor), stock_status (in/low/out), category/vendor/search filters, stats (total/in_stock/low/out/total_value/vendor_count).
- **Order Management (`admin/orders`)** — `OrderManagementService`: paginated orders with customer + items + vendors + statusHistory, stats (total/pending/in_progress/completed/cancelled), status/payment/search filters, `updateStatus` writes `OrderStatusHistory`.
- **AI Recommendations (`admin/recommendations`)** — `AiRecommendationManagementService`: paginated `RecipeRecommendation` logs with user + review aggregates (avg rating grouped by recipe_name), stats (found/not_found/error/unique_recipes/recipe_reviews), top 5 recipes, single + bulk delete.
- **Reports & Analytics (`admin/reports`)** — `ReportsAnalyticsService`: windowed (`7d/30d/90d/12m/all`) with granularity day/week/month; sections: **Overview** (revenue/orders/AOV/users/vendors/products/inventory value), **Sales** (revenue trend, status & payment breakdowns, top products/vendors via OrderItem joins), **Users** (roles donut, new_users trend), **Vendors** (approval status donut, locations), **Inventory** (stock health, value by category, stock movements, low-stock table), **System** (active/total sessions, queue failed/pending, AI success rate, reviews avg, pending tasks). Time-series via `buildTimeSeries`/`makeBuckets`.
- **Feedback & Complaints (`admin/feedback`)** — `FeedbackManagementService`: all `Review` types (vendor/product/recipe) with user+order, resolve by type (recipe_name vs reviewable_type), stats (total/pending/in_review/resolved/dismissed/low_ratings/avg), filters (status/type/rating/search), `respond` (sets resolved + admin_response) and `updateStatus`.

## Notable Business Logic

- **`OrderService::placeOrder`** — fully atomic (DB transaction): locks products + inventories (`lockForUpdate`), validates stock (out-of-stock and insufficient messages), creates order + items (snapshot vendor_id/product_name/category/unit), deducts stock and logs each sale as `sold` (`InventoryLog` with before/after + reference_number), seeds the first `pending` entry in `order_status_histories`. Vendor legacy products without inventory record skip stock check.
- **`OrderService::getVendorOrders / updateOrderStatus`** — scoped to vendor's `vendor_id` via `whereHas('items')`; vendor status updates append to `OrderStatusHistory`.
- **`OrderManagementService::updateStatus`** (admin) — same but admin-origin note.
- **`ReviewService`** — vendor/product reviews verified against the customer's **completed** orders (item must be in a completed order owned by the user); one review per user per target; recipes keyed by `recipe_name`. `getEligibleItems()` powers the "what can I still review" list.
- **`FeedbackManagementService`** — admin-only; `present()` resolves `type` (recipe/vendor/product) and `target_name` (recipe_name or reviewable stall_name/name). Filters cover comment/user/order_number search.
- **`RecipeService`** — calls Gemini (`config/services.gemini.api_key`, `GEMINI_API_KEY` env, model fallback chain) with a strict prompt that only returns *standard* Metro Manila Filipino recipes, matches ingredients against marketplace products (`available_in_market`). Every generation is logged to `recipe_recommendations` (best-effort, never breaks search) for the admin AI Recommendations dashboard.
- **`ReportsAnalyticsService`** — builds all report data server-side with Carbon windows; revenue excludes `cancelled` orders; inventory value at cost (`cost_price * stock_quantity`); AI success rate = found / total.
- **`AuthService::login`** — blocks pending/rejected/suspended vendors with contextual messages.
- **`VendorRegistrationService`** — transactional: creates user+vendor, reserves stall (must be vacant), uploads documents.

## Mobile App Notes

- API base: `http://192.168.1.3:8080/api/v1` (hardcoded in `mobile/client/src/config/api.ts` via `API_CONFIG` host/port — must match `php artisan serve --host=0.0.0.0 --port=8080`).
- Contexts: `AuthContext` (vendor), `CustomerAuthContext`, `CartContext`, `FavoritesContext` — storage keys synced so customer+vendor share token.
- Services mirror API v1 endpoints (`services/auth.ts`, `customer-auth.ts`, `customer-profile.ts`, `marketplace.ts`, `inventory.ts`, `orders.ts`, `recipe.ts`, `reviews.ts`, `vendor-registration.ts`, etc.).
- Vendor dashboard at `(vendor)/dashboard.tsx` — fullscreen single-screen layout (refactored to green header design).
- Customer order tracking: `app/(customer)/track/[id].tsx` (hidden tab via `href: null`) polls `/orders/{id}/track` every 5s while focused + on app foreground; reviews open from completed orders (bottom-sheet rating UI in `components/customer/StarRating.tsx` + `services/reviews.ts`).

## Commands

- Backend dev (runs server + queue + logs + vite): `composer dev`
- Web lint/format/types: `npm run lint`, `npm run format`, `npm run types:check` (also `lint:check`/`format:check` in `ci:check`)
- PHP lint: `composer lint` (Pint) + `composer lint:check` (test mode)
- Tests: `composer test` (clears config, runs pint check, then `php artisan test` via Pest)
- Seed: `php artisan db:seed` → admin user `admin@taguig-suki.com` / `password`
- Vite build output `public/build` is committed (for XAMPP).

## Gotchas / Conventions

- `mobile/` and `taguig-suki/` share one git repo at the parent (`cap-taguig`); the subfolder is NOT its own repo. Commit from the parent. `.agents/skills/` contains project skills (laravel-specialist, laravel-security, context.md with the Place Order requirements spec).
- Mobile app screens are NOT in the Laravel web app — web is admin-only (Inertia); customer/vendor features live in the Expo app.
- Customer order tracking polls via `useFocusEffect` + app foreground listener — avoid duplicate intervals.
- UI copy mixes English and Taglish (e.g. "Bagong Dating", "Nabenta"); keep it consistent.
- Prices/quantities: `decimal:2` casts; stock never goes negative (validated before deduction, `max(0, before-qty)`).
- `SectionController@index` currently returns raw data via `SectionService::getAll()` (no Inertia render) — legacy; admin section UI not under `resources/js/pages/admin/sections`.
- Reviews table has dual use: customer ratings + admin complaints queue — `status` column drives the Feedback dashboard; low ratings (≤2) surfaced in stats.
