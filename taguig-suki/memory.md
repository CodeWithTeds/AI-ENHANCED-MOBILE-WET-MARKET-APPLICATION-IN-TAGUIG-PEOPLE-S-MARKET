# Project Memory — Taguig Suki

A digital marketplace platform for a public market in Taguig (wet-market style e-commerce with vendor stalls, inventory, ordering, and AI recipe search).

## Repo Layout

Single git repo at `cap-taguig/` containing **two apps**:

| Path | Stack | Purpose |
|---|---|---|
| `taguig-suki/` | Laravel 13 + Inertia 3 + React 19 (Vite) | Backend API + Admin/Settings web UI |
| `mobile/client/` | Expo SDK 57 (expo-router, RN 0.86) | Mobile app: customer + vendor flows |

- Backend serves the mobile app via a **JSON API** (`/api/v1`), and the web admin via **Inertia**.
- Web UI (pages under `resources/js/pages/`): `admin/` (sections, stalls, pending vendors, documents, inventory, orders, recommendations), `auth/`, `settings/`, `dashboard`, `welcome`.
- Mobile UI (routes under `mobile/client/src/app/`): `(customer)/` home, explore, cart, orders, profile + `(vendor)/` dashboard, products, inventory, orders, profile + auth/registration screens.

## Tech Stack

- **Backend:** PHP 8.3, Laravel 13, Sanctum (API tokens), Fortify (web auth + 2FA), spatie/laravel-query-builder, Wayfinder, laravel/boost
- **Frontend (web):** Inertia 3, React 19, Tailwind 4, shadcn/ui (radix + CVA), sonner toasts, lucide-react
- **Mobile:** Expo 57, expo-router, React Native 0.86, AsyncStorage, expo-image-picker (vendor doc uploads), vector icons
- **Testing:** Pest + PHPUnit (`tests/Feature`, `tests/Unit`); Pint for PHP lint; ESLint + Prettier + `tsc --noEmit` for JS
- **DB:** MySQL `taguig_suki` (XAMPP localhost, root, no password) — see `.env`

## Architecture Patterns (backend)

- **Service layer:** domain logic lives in `app/Services/*` (e.g. `OrderService`, `MarketplaceService`, `RecipeService`, `InventoryService`, `AuthService`, `VendorRegistrationService`, `Admin/SectionService`, `StallManagementService`, `VendorApprovalService`).
- **Repository pattern (partial):** `app/Repositories/` for Task + Vendor (`BaseRepository` + interfaces), registered in `RepositoryServiceProvider`.
- **API responses:** controllers `use ApiResponse` trait (`successResponse` / `errorResponse` → `{status, message, data}`); errors centralized in `ApiExceptionHandler` (Validation → 422, ModelNotFound → 404, etc.).
- **Form Requests** validate input in `app/Http/Requests/`; admin controllers return `back()->with('success', ...)` for Inertia flash.
- **Enums:** `app/Enums/` with `label()` — includes Taglish labels for stock adjustments (Restock = "Bagong Dating", Sold = "Nabenta", Spoiled = "Nasira").
- **Policies:** `BasePolicy`, `TaskPolicy`; admin gated by `users.is_admin`.

## Domain Model

- `users` — customers + vendors + admins (`is_admin` flag, Fortify 2FA columns, Sanctum tokens)
- `sections` — market areas (name, slug, color, is_active)
- `stalls` — physical stalls (section_id, stall_number, store_name, vendor_id, status: occupied/vacant/under_maintenance, size: small/medium/large, monthly_rent, image)
- `vendors` — vendor profiles (user_id, stall_name, stall_location, product_categories JSON, status: pending/approved/rejected/suspended, rejection_reason, notification_preferences JSON)
- `vendor_documents` — business_permit / stall_lease / valid_id uploads
- `products` — vendor products (name, category, price, unit: kg/pcs/bundle/pack, is_available)
- `inventories` — stock per product (stock_quantity, reorder_level, max_stock_level, cost_price/puhunan, selling_price, markup_percentage, status: active/inactive/seasonal/discontinued) + computed `profit_per_unit`, `inventory_value`, low/out-of-stock helpers
- `inventory_logs` — stock movements (restock, sold, returned, spoiled, adjustment, reserved, unreserved, transferred, initial) with quantity_before/change/after
- `orders` + `order_items` — customer orders (order_number `ORD-YYYYMMDD-NNNN`, status: pending→confirmed→processing→ready→completed/cancelled, payment_method: cash/gcash/maya, item snapshots with vendor_id)
- `order_status_histories` — full status timeline per order (every status change logged with timestamp; powers the tracking screen)
- `reviews` — polymorphic reviews: vendors + products (gated on COMPLETED orders, unique per user+target) and AI recipes (keyed by `recipe_name`, auth only)
- `recipe_recommendations` — log of every AI recipe search (query, recipe_name, status: found/not_found/error, payload + matching_products JSON, error_message, nullable user_id) — powers the admin AI Recommendations dashboard
- `tasks` — todo/demo feature (TaskRepository + TaskResource + TaskPolicy, auth:sanctum)

## API v1 (`routes/api/v1.php`)

Public: `POST /login`, `POST /register`, `POST /vendor/register`, `GET /sections`, `GET /stalls/vacant`, `GET /marketplace/{featured,products,products/search,products/{id},categories}`, `GET /recipes/search` (Gemini AI).

Auth (`auth:sanctum`): logout, user profile, vendor status, product CRUD, vendor profile (business/password/notifications), inventory CRUD + adjust stock + logs/history, `POST /orders` (atomic order placement), customer order history, `GET /orders/{id}/track` (status timeline), reviews (`GET /reviews/eligible`, `POST /reviews/{vendor,product,recipe}`, `PUT/DELETE /reviews/{review}`), vendor orders + status updates. Plus `apiResource('tasks')`.

Public: review listings + aggregates (`GET /reviews/vendor/{vendor}`, `GET /reviews/product/{product}`, `GET /reviews/recipe?q=`).

## Notable Business Logic

- **`OrderService::placeOrder`** — fully atomic (DB transaction): locks products + inventories (`lockForUpdate`), validates stock, creates order + items, deducts stock and logs each sale as `sold`. Throws `UnprocessableEntityHttpException` with friendly messages ("Only X item(s) of ... remaining in stock"). Seeds the first `pending` entry in `order_status_histories`.
- **`ReviewService`** — vendor/product reviews verified against the customer's **completed** orders (item must be in a completed order owned by the user); one review per user per target; recipes keyed by `recipe_name`. `getEligibleItems()` powers the "what can I still review" list.
- **`RecipeService`** — calls Gemini (`config/services.gemini.api_key`, `GEMINI_API_KEY` env, model fallback chain) with a strict prompt that only returns *standard* Metro Manila Filipino recipes, matches ingredients against marketplace products (`available_in_market`). Every generation is logged to `recipe_recommendations` (best-effort, never breaks search) for the admin AI Recommendations dashboard (`AiRecommendationManagementService`).
- **`AuthService::login`** — blocks pending/rejected/suspended vendors with contextual messages.
- **`VendorRegistrationService`** — transactional: creates user+vendor, reserves stall (must be vacant), uploads documents.

## Mobile App Notes

- API base: `http://192.168.1.3:8080/api/v1` (hardcoded in `mobile/client/src/config/api.ts` — must match the host serving Laravel, `php artisan serve --host=0.0.0.0 --port=8080`).
- Contexts: `AuthContext` (vendor), `CustomerAuthContext`, `CartContext`, `FavoritesContext`.
- Services mirror API v1 endpoints (`services/auth.ts`, `marketplace.ts`, `inventory.ts`, `orders.ts`, `recipe.ts`, `vendor-registration.ts`, ...).

## Commands

- Backend dev (runs server + queue + logs + vite): `composer dev`
- Web lint/format/types: `npm run lint`, `npm run format`, `npm run types:check`
- PHP lint: `composer lint` (Pint)
- Tests: `composer test`
- Seed: `php artisan db:seed` → admin user `admin@taguig-suki.com` / `password`

## Gotchas / Conventions

- `mobile/` and `taguig-suki/` share one git repo at the parent (`cap-taguig`); the subfolder is NOT its own repo. Commit from the parent.
- Mobile app screens are NOT in the Laravel web app — web is admin-only (Inertia); customer/vendor features live in the Expo app.
- Customer order tracking: `app/(customer)/track/[id].tsx` (hidden tab via `href: null`) polls `/orders/{id}/track` every 5s while focused + on app foreground; reviews open from completed orders (bottom-sheet rating UI in `components/customer/StarRating.tsx` + `services/reviews.ts`).
- UI copy mixes English and Taglish (e.g. "Bagong Dating", "Nabenta"); keep it consistent.
- Prices/quantities: decimal:2 casts; stock never goes negative (validated before deduction).
- `.agents/skills/` contains project skills (laravel-specialist, laravel-security, context.md with the Place Order requirements spec).
- `public/build` is committed (vite build output for XAMPP).
